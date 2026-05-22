// Envia emails de automação relacionados com o link do Portal do Utente.
// Triggers suportados:
//   - portal_link_enviado          (após onboarding público completo)
//   - lembrete_portal_expiracao    (cron — ~24h antes do link expirar)
//
// Proteções:
//   A) Estado verificado em tempo real (BD na hora)
//   B) Anti-duplicação lógica + índice único parcial em automation_logs
//   C) Janela do cron (24h) tratada pelo cron caller, mas validamos estado aqui
//   D) Respeita is_active do flow
//   E) Falhas são registadas com status='error' e NÃO contam como enviadas
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

const MAX_ERROR_ATTEMPTS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const pacienteId: string | undefined = body.pacienteId || body.paciente_id;
    const clinicIdInput: string | undefined = body.clinicId || body.clinic_id;
    const triggerType: string = body.triggerType || body.trigger_type;

    if (!pacienteId || !triggerType) {
      throw new Error("Missing required: pacienteId, triggerType");
    }
    if (!["portal_link_enviado", "lembrete_portal_expiracao"].includes(triggerType)) {
      throw new Error("Invalid triggerType");
    }

    // 1. Patient + clinic
    const { data: patient, error: patErr } = await admin
      .from("pacientes")
      .select("id, full_name, email, clinic_id, onboarding_completed_at")
      .eq("id", pacienteId)
      .single();
    if (patErr || !patient) throw new Error("Patient not found");

    const clinicId = clinicIdInput || patient.clinic_id;
    if (!clinicId) throw new Error("Missing clinic_id");
    if (!patient.email) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "patient has no email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // (A) Real-time state checks
    if (triggerType === "portal_link_enviado") {
      if (!patient.onboarding_completed_at) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "onboarding not completed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }
    if (triggerType === "lembrete_portal_expiracao") {
      const { data: quest } = await admin
        .from("portal_questionario")
        .select("completo")
        .eq("paciente_id", pacienteId)
        .maybeSingle();
      if (quest?.completo === true) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "anamnese already completed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // (D) Get active flow
    const { data: flow } = await admin
      .from("automation_flows")
      .select("id, name, message_template, is_active")
      .eq("clinic_id", clinicId)
      .eq("trigger_type", triggerType)
      .eq("channel", "email")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!flow) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no active flow" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // (B) Anti-dup: any prior sent log
    const { data: priorSent } = await admin
      .from("automation_logs")
      .select("id")
      .eq("paciente_id", pacienteId)
      .eq("trigger_type", triggerType)
      .eq("status", "sent")
      .limit(1);

    if (priorSent && priorSent.length > 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "already sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // (E) Break runaway error loops
    const { count: errorCount } = await admin
      .from("automation_logs")
      .select("id", { count: "exact", head: true })
      .eq("paciente_id", pacienteId)
      .eq("trigger_type", triggerType)
      .eq("status", "error");

    if ((errorCount ?? 0) >= MAX_ERROR_ATTEMPTS) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "max error attempts reached" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Clinic name
    const { data: clinic } = await admin
      .from("clinics")
      .select("name")
      .eq("id", clinicId)
      .single();
    const clinicName = clinic?.name || "Clínica";

    // Generate fresh magic link (7 days, single-use)
    const link_token = generateToken(32);
    const expira_em = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: inviteErr } = await admin.from("portal_convites").insert({
      paciente_id: pacienteId,
      codigo: "000000",
      link_token,
      enviado_para_email: patient.email,
      expira_em,
      tipo: "magic_link",
      max_tentativas: 1,
    });
    if (inviteErr) {
      await admin.from("automation_logs").insert({
        clinic_id: clinicId,
        flow_id: flow.id,
        paciente_id: pacienteId,
        trigger_type: triggerType,
        channel: "email",
        recipient_email: patient.email,
        subject: flow.name,
        status: "error",
        error_message: `invite insert failed: ${inviteErr.message}`,
      });
      throw inviteErr;
    }

    const baseUrl = "https://physione.app";
    const linkPortal = `${baseUrl}/portal/ativar/${link_token}`;
    const firstName = patient.full_name?.split(" ")[0] || "Utente";

    const processed = (flow.message_template || "")
      .replace(/\{\{nome_paciente\}\}/gi, patient.full_name)
      .replace(/\{\{patient_name\}\}/gi, patient.full_name)
      .replace(/\{\{first_name\}\}/gi, firstName)
      .replace(/\{\{clinica\}\}/gi, clinicName)
      .replace(/\{\{clinic_name\}\}/gi, clinicName)
      .replace(/\{\{link_portal\}\}/gi, linkPortal)
      .replace(/\{\{portal_link\}\}/gi, linkPortal);

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;">
  <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
    <h1 style="color:#3b82f6;margin:0 0 6px;font-size:20px;">${clinicName}</h1>
    <p style="color:#64748b;margin:0 0 24px;font-size:13px;">Portal do Utente</p>
    <div style="white-space:pre-line;line-height:1.6;color:#0f172a;font-size:15px;">${processed.replace(/{{link_portal}}/gi, linkPortal)}</div>
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${linkPortal}" style="display:inline-block;background:#3b82f6;color:#fff;padding:13px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Aceder ao Portal</a>
    </div>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Se o botão não funcionar, copie este endereço:</p>
    <p style="color:#3b82f6;font-size:12px;word-break:break-all;">${linkPortal}</p>
  </div>
</body></html>`;

    const subject =
      triggerType === "portal_link_enviado"
        ? `${clinicName} — Active o seu acesso ao Portal`
        : `${clinicName} — Lembrete: complete a sua Anamnese`;

    if (!resendKey) {
      await admin.from("automation_logs").insert({
        clinic_id: clinicId,
        flow_id: flow.id,
        paciente_id: pacienteId,
        trigger_type: triggerType,
        channel: "email",
        recipient_email: patient.email,
        subject,
        status: "error",
        error_message: "RESEND_API_KEY not configured",
      });
      throw new Error("RESEND_API_KEY not configured");
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${clinicName} <noreply@respiraedesenvolve.com>`,
        to: [patient.email],
        subject,
        html,
      }),
    });
    const resendData = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      const errMsg = (resendData as any)?.message || JSON.stringify(resendData);
      await admin.from("automation_logs").insert({
        clinic_id: clinicId,
        flow_id: flow.id,
        paciente_id: pacienteId,
        trigger_type: triggerType,
        channel: "email",
        recipient_email: patient.email,
        subject,
        status: "error",
        error_message: `resend ${resendRes.status}: ${errMsg}`,
      });
      throw new Error(`Resend failed: ${errMsg}`);
    }

    // (B) Final anti-dup at DB level — unique partial index
    const { error: logErr } = await admin.from("automation_logs").insert({
      clinic_id: clinicId,
      flow_id: flow.id,
      paciente_id: pacienteId,
      trigger_type: triggerType,
      channel: "email",
      recipient_email: patient.email,
      subject,
      status: "sent",
    });
    if (logErr) {
      // Duplicate sent — race condition; treat as success
      console.warn("automation_logs insert race:", logErr.message);
    }

    return new Response(
      JSON.stringify({ success: true, link: linkPortal, expira_em }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("send-portal-link-automation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
