import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token, password } = await req.json();
    if (!token || !password) throw new Error("token and password are required");
    if (password.length < 8) throw new Error("Password deve ter pelo menos 8 caracteres");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Validate invite
    const { data: invite, error: invErr } = await admin
      .from("portal_convites")
      .select("*")
      .eq("link_token", token)
      .maybeSingle();

    if (invErr || !invite) throw new Error("Link inválido");
    if (invite.utilizado) throw new Error("Este link já foi usado");
    if (new Date(invite.expira_em) < new Date()) throw new Error("Este link expirou");
    if (invite.tipo !== "magic_link") throw new Error("Tipo de convite inválido");

    const email = invite.enviado_para_email;
    if (!email) throw new Error("Convite sem email associado");

    // 2. Patient
    const { data: patient } = await admin
      .from("pacientes")
      .select("full_name")
      .eq("id", invite.paciente_id)
      .single();

    // 3. Create or update auth user
    let userId: string | null = null;
    const { data: existing } = await admin.auth.admin.listUsers();
    const found = existing?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    if (found) {
      userId = found.id;
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: patient?.full_name || "Utente", portal: true },
      });
      if (createErr) throw createErr;
      userId = created.user.id;
    }

    if (!userId) throw new Error("Falha a criar utilizador");

    // 4. Ensure portal_contas + portal_conta_pacientes
    // Look up by auth_user_id OR paciente_id (paciente_id has a unique constraint)
    let { data: conta } = await admin
      .from("portal_contas")
      .select("id, auth_user_id")
      .or(`auth_user_id.eq.${userId},paciente_id.eq.${invite.paciente_id}`)
      .maybeSingle();

    if (conta) {
      // If existing conta has different/null auth_user_id, update it to current
      if (conta.auth_user_id !== userId) {
        const { error: updErr } = await admin
          .from("portal_contas")
          .update({ auth_user_id: userId, email, status: "active" })
          .eq("id", conta.id);
        if (updErr) throw updErr;
      }
    } else {
      const { data: novaConta, error: contaErr } = await admin
        .from("portal_contas")
        .insert({
          paciente_id: invite.paciente_id,
          auth_user_id: userId,
          email,
          provider: "email",
          status: "active",
        })
        .select("id")
        .single();
      if (contaErr) throw contaErr;
      conta = novaConta;
    }

    const { data: link } = await admin
      .from("portal_conta_pacientes")
      .select("id")
      .eq("conta_id", conta.id)
      .eq("paciente_id", invite.paciente_id)
      .maybeSingle();

    if (!link) {
      await admin.from("portal_conta_pacientes").insert({
        conta_id: conta.id,
        paciente_id: invite.paciente_id,
        relacao: "responsavel",
        is_primary: true,
      });
    }

    // 5. Mark invite as used
    await admin.from("portal_convites").update({ utilizado: true }).eq("id", invite.id);

    // 6. Sign in to return access token
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: session, error: signErr } = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr) throw signErr;

    return new Response(
      JSON.stringify({
        success: true,
        access_token: session.session?.access_token,
        refresh_token: session.session?.refresh_token,
        paciente_id: invite.paciente_id,
        template_id: invite.template_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("activate-portal-magic-link error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
