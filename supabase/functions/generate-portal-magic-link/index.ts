import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateToken(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (const byte of arr) result += chars[byte % chars.length];
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { paciente_id, email, template_id } = await req.json();
    if (!paciente_id) throw new Error("paciente_id is required");
    if (!email) throw new Error("email is required for magic link");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Generate magic link (24h, single-use)
    const link_token = generateToken(32);
    const codigo = "000000"; // not used for magic_link, but column is NOT NULL
    const expira_em = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("portal_convites").insert({
      paciente_id,
      codigo,
      link_token,
      enviado_para_email: email,
      expira_em,
      template_id: template_id || null,
      tipo: "magic_link",
      max_tentativas: 1,
    });

    if (insertError) throw insertError;

    // Patient + clinic info
    const { data: patient } = await supabase
      .from("pacientes")
      .select("full_name, clinic_id")
      .eq("id", paciente_id)
      .single();

    let clinicName = "Clínica";
    if (patient?.clinic_id) {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("name")
        .eq("id", patient.clinic_id)
        .single();
      if (clinic?.name) clinicName = clinic.name;
    }

    const baseUrl = "https://physione.app";
    const link = `${baseUrl}/portal/ativar/${link_token}`;
    const firstName = patient?.full_name?.split(" ")[0] || "Utente";

    if (resendKey) {
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafc;">
          <div style="background:#fff;border-radius:16px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <h1 style="color:#3b82f6;margin:0 0 8px;font-size:22px;">${clinicName}</h1>
            <p style="color:#64748b;margin:0 0 32px;font-size:14px;">Portal do Utente</p>
            <h2 style="color:#0f172a;font-size:20px;margin:0 0 16px;">Olá, ${firstName} 👋</h2>
            <p style="color:#475569;line-height:1.6;font-size:15px;">A clínica <strong>${clinicName}</strong> ativou o seu acesso ao Portal. Clique no botão abaixo para criar a sua password e começar a utilizar.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${link}" style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">Ativar a minha conta</a>
            </div>
            <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:8px;margin:24px 0;">
              <p style="margin:0;color:#78350f;font-size:13px;">⏱ Este link é válido por <strong>24 horas</strong> e pode ser usado <strong>uma única vez</strong>.</p>
            </div>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
            <p style="color:#3b82f6;font-size:12px;word-break:break-all;">${link}</p>
          </div>
        </div>
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${clinicName} <noreply@respiraedesenvolve.com>`,
          to: [email],
          subject: `${clinicName} — Active o seu acesso ao Portal`,
          html,
        }),
      });
    }

    return new Response(JSON.stringify({ link, expira_em }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("generate-portal-magic-link error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
