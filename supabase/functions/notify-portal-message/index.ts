import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Sends "you have a new message" email — but only the FIRST one per conversation per day.
// Anti-spam: subsequent messages on the same day only generate in-app notifications (already handled by trigger).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { paciente_id, autor_nome } = await req.json();
    if (!paciente_id) throw new Error("paciente_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Find patient + portal account email
    const { data: patient } = await supabase
      .from("pacientes")
      .select("full_name, clinic_id")
      .eq("id", paciente_id)
      .single();

    if (!patient) throw new Error("Paciente não encontrado");

    const { data: conta } = await supabase
      .from("portal_contas")
      .select("email")
      .eq("paciente_id", paciente_id)
      .maybeSingle();

    if (!conta?.email) {
      return new Response(JSON.stringify({ skipped: "no_portal_account" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Anti-spam: check if email was already sent today for this conversation
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: alreadySent } = await supabase
      .from("automation_logs")
      .select("id")
      .eq("paciente_id", paciente_id)
      .eq("trigger_type", "portal_chat_email")
      .gte("sent_at", todayStart.toISOString())
      .limit(1)
      .maybeSingle();

    if (alreadySent) {
      return new Response(JSON.stringify({ skipped: "already_sent_today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Clinic name
    let clinicName = "Clínica";
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", patient.clinic_id)
      .single();
    if (clinic?.name) clinicName = clinic.name;

    const firstName = patient.full_name?.split(" ")[0] || "Utente";
    const portalUrl = "https://physione.app/portal/mensagens";

    // 4. Send email
    if (resendKey) {
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafc;">
          <div style="background:#fff;border-radius:16px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <h1 style="color:#3b82f6;margin:0 0 8px;font-size:22px;">${clinicName}</h1>
            <p style="color:#64748b;margin:0 0 32px;font-size:14px;">Portal do Utente</p>
            <h2 style="color:#0f172a;font-size:20px;margin:0 0 16px;">Tem uma nova mensagem 💬</h2>
            <p style="color:#475569;line-height:1.6;font-size:15px;">Olá <strong>${firstName}</strong>, ${autor_nome ? `<strong>${autor_nome}</strong>` : "a sua clínica"} enviou-lhe uma mensagem no Portal.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${portalUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">Ver mensagem</a>
            </div>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Por motivos de privacidade, o conteúdo da mensagem só está disponível dentro do Portal.</p>
          </div>
        </div>
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${clinicName} <noreply@respiraedesenvolve.com>`,
          to: [conta.email],
          subject: `${clinicName} — Nova mensagem no Portal`,
          html,
        }),
      });
    }

    // 5. Log
    await supabase.from("automation_logs").insert({
      clinic_id: patient.clinic_id,
      paciente_id,
      trigger_type: "portal_chat_email",
      channel: "email",
      recipient_email: conta.email,
      subject: `${clinicName} — Nova mensagem no Portal`,
      status: "sent",
    });

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("notify-portal-message error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
