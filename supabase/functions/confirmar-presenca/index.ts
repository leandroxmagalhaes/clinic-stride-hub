import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function html(body: string, status = 200): Response {
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    ...corsHeaders,
  });
  headers.delete("Content-Disposition");
  return new Response(body, { status, headers });
}

function isUuid(s: string | null): s is string {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function layout(opts: {
  clinicName?: string;
  inner: string;
  clinicPhone?: string;
  clinicEmail?: string;
}): string {
  const { clinicName, inner, clinicPhone, clinicEmail } = opts;
  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(clinicName || "Clinica")}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;color:#18181b;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="text-align:center;padding:12px 0 24px;">
      <h1 style="margin:0;color:#be123c;font-size:20px;letter-spacing:1px;text-transform:uppercase;">${esc(clinicName || "Clinica")}</h1>
    </div>
    <div style="background:#ffffff;border-radius:14px;padding:32px 24px;box-shadow:0 2px 6px rgba(0,0,0,0.06);">
      ${inner}
    </div>
    ${(clinicPhone || clinicEmail) ? `
    <div style="text-align:center;padding:20px 8px;color:#71717a;font-size:13px;line-height:1.6;">
      ${clinicPhone ? `<div>Tel: ${esc(clinicPhone)}</div>` : ""}
      ${clinicEmail ? `<div>${esc(clinicEmail)}</div>` : ""}
    </div>` : ""}
  </div>
</body>
</html>`;
}

function errorPage(msg: string, clinicName?: string, phone?: string, email?: string): string {
  const inner = `
    <div style="text-align:center;">
      <div style="width:72px;height:72px;border-radius:50%;background:#fee2e2;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
        <span style="font-size:36px;color:#dc2626;">!</span>
      </div>
      <h2 style="margin:0 0 8px;color:#18181b;font-size:22px;">Link invalido</h2>
      <p style="margin:0;color:#52525b;font-size:15px;line-height:1.6;">${esc(msg)}</p>
    </div>`;
  return layout({ clinicName, inner, clinicPhone: phone, clinicEmail: email });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const accao = url.searchParams.get("accao");
    const confirmar = url.searchParams.get("confirmar") === "1";

    if (!isUuid(token) || (accao !== "confirmar" && accao !== "remarcar")) {
      return html(errorPage("O link que recebeu nao e valido ou ja expirou."), 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: session, error } = await supabase
      .from("sessoes")
      .select(`
        id, start_time, status, clinic_id, paciente_id, confirmacao_estado,
        pacientes!sessoes_paciente_id_fkey ( full_name ),
        profiles!sessoes_profissional_id_fkey ( full_name ),
        servicos!sessoes_servico_id_fkey ( name ),
        clinics!sessoes_clinic_id_fkey ( name, phone, email )
      `)
      .eq("confirmation_token", token)
      .maybeSingle();

    if (error || !session) {
      return html(errorPage("Nao foi possivel encontrar a sua consulta. Por favor contacte-nos."), 404);
    }

    const s: any = session;
    const patient = s.pacientes;
    const professional = s.profiles;
    const service = s.servicos;
    const clinic = s.clinics;
    const clinicName = clinic?.name || "Clinica";
    const clinicPhone = clinic?.phone || "";
    const clinicEmail = clinic?.email || "";
    const patientName = patient?.full_name || "";

    const apt = new Date(s.start_time);
    const tz = "Europe/Lisbon";
    const dataFormatada = apt.toLocaleDateString("pt-PT", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz,
    });
    const horaFormatada = apt.toLocaleTimeString("pt-PT", {
      hour: "2-digit", minute: "2-digit", timeZone: tz,
    });

    const detailsBox = `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px;margin:20px 0;">
        <p style="margin:0 0 8px;color:#14532d;font-size:14px;"><strong>Data:</strong> ${esc(dataFormatada)}</p>
        <p style="margin:0 0 8px;color:#14532d;font-size:14px;"><strong>Hora:</strong> ${esc(horaFormatada)}</p>
        <p style="margin:0 0 8px;color:#14532d;font-size:14px;"><strong>Servico:</strong> ${esc(service?.name || "Consulta")}</p>
        <p style="margin:0;color:#14532d;font-size:14px;"><strong>Profissional:</strong> ${esc(professional?.full_name || "A confirmar")}</p>
      </div>`;

    // === CONFIRMAR ===
    if (accao === "confirmar") {
      if (s.status === "cancelado") {
        const inner = `
          <div style="text-align:center;">
            <div style="width:72px;height:72px;border-radius:50%;background:#fee2e2;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
              <span style="font-size:36px;color:#dc2626;">!</span>
            </div>
            <h2 style="margin:0 0 8px;color:#18181b;font-size:22px;">Esta consulta foi cancelada</h2>
            <p style="margin:0;color:#52525b;font-size:15px;line-height:1.6;">A consulta de ${esc(dataFormatada)} as ${esc(horaFormatada)} ja nao se encontra ativa. Por favor contacte-nos para mais informacoes.</p>
          </div>`;
        return html(layout({ clinicName, inner, clinicPhone, clinicEmail }));
      }

      if (s.confirmacao_estado !== "confirmado") {
        await supabase
          .from("sessoes")
          .update({ confirmacao_estado: "confirmado", confirmacao_em: new Date().toISOString() })
          .eq("id", s.id);
      }

      const inner = `
        <div style="text-align:center;">
          <div style="width:80px;height:80px;border-radius:50%;background:#dcfce7;display:inline-flex;align-items:center;justify-content:center;margin-bottom:18px;">
            <span style="font-size:44px;color:#16a34a;line-height:1;">&#10004;</span>
          </div>
          <h2 style="margin:0 0 10px;color:#15803d;font-size:24px;">Presenca confirmada</h2>
          <p style="margin:0 0 4px;color:#3f3f46;font-size:16px;line-height:1.6;">Obrigado, <strong>${esc(patientName)}</strong>!</p>
          <p style="margin:0;color:#52525b;font-size:15px;line-height:1.6;">Ficamos a contar consigo. Ate ja!</p>
        </div>
        ${detailsBox}`;
      return html(layout({ clinicName, inner, clinicPhone, clinicEmail }));
    }

    // === REMARCAR ===
    if (!confirmar) {
      const here = url.origin + url.pathname + "?token=" + encodeURIComponent(token) + "&accao=remarcar&confirmar=1";
      const inner = `
        <div style="text-align:center;">
          <div style="width:72px;height:72px;border-radius:50%;background:#dbeafe;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
            <span style="font-size:36px;color:#2563eb;">?</span>
          </div>
          <h2 style="margin:0 0 10px;color:#18181b;font-size:22px;">Quer mesmo pedir para remarcar?</h2>
          <p style="margin:0 0 18px;color:#52525b;font-size:15px;line-height:1.6;">Vamos cancelar esta consulta e entrar em contacto consigo para combinar uma nova data.</p>
        </div>
        ${detailsBox}
        <div style="text-align:center;margin-top:8px;">
          <a href="${esc(here)}" style="display:inline-block;background:#be123c;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:16px 28px;border-radius:10px;min-width:240px;">Sim, pedir remarcacao</a>
        </div>`;
      return html(layout({ clinicName, inner, clinicPhone, clinicEmail }));
    }

    // confirmar=1
    if (s.confirmacao_estado !== "remarcacao") {
      await supabase
        .from("sessoes")
        .update({
          status: "cancelado",
          confirmacao_estado: "remarcacao",
          confirmacao_em: new Date().toISOString(),
        })
        .eq("id", s.id);

      await supabase.from("notifications").insert({
        clinic_id: s.clinic_id,
        type: "remarcacao",
        title: "Pedido de remarcacao",
        message: `${patientName} pediu para remarcar a consulta de ${dataFormatada} as ${horaFormatada}.`,
        patient_id: s.paciente_id,
        read: false,
      });

      try {
        const { data: settings } = await supabase
          .from("clinic_settings")
          .select("notificar_clinica_email_remarcacao")
          .eq("clinic_id", s.clinic_id)
          .maybeSingle();

        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (settings?.notificar_clinica_email_remarcacao && clinicEmail && resendKey) {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: `${clinicName} <noreply@respiraedesenvolve.com>`,
            to: [clinicEmail],
            subject: `Pedido de remarcacao - ${patientName}`,
            html: `<p><strong>${esc(patientName)}</strong> pediu para remarcar a consulta de <strong>${esc(dataFormatada)}</strong> as <strong>${esc(horaFormatada)}</strong>.</p><p>Servico: ${esc(service?.name || "Consulta")}<br>Profissional: ${esc(professional?.full_name || "-")}</p>`,
          });
        }
      } catch (_e) { /* nao bloquear */ }
    }

    const phoneDigits = (clinicPhone || "").replace(/\D+/g, "");
    const waLink = phoneDigits ? `https://wa.me/${phoneDigits}` : "";
    const telLink = clinicPhone ? `tel:${clinicPhone.replace(/\s+/g, "")}` : "";

    const inner = `
      <div style="text-align:center;">
        <div style="width:80px;height:80px;border-radius:50%;background:#dbeafe;display:inline-flex;align-items:center;justify-content:center;margin-bottom:18px;">
          <span style="font-size:42px;color:#2563eb;line-height:1;">&#8634;</span>
        </div>
        <h2 style="margin:0 0 10px;color:#1d4ed8;font-size:24px;">Vamos remarcar consigo</h2>
        <p style="margin:0 0 6px;color:#3f3f46;font-size:16px;line-height:1.6;">Recebemos o seu pedido, <strong>${esc(patientName)}</strong>.</p>
        <p style="margin:0;color:#52525b;font-size:15px;line-height:1.6;">Vamos entrar em contacto consigo para combinarmos uma nova data.</p>
      </div>
      ${detailsBox}
      <div style="text-align:center;margin-top:8px;">
        ${waLink ? `<a href="${esc(waLink)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 22px;border-radius:10px;margin:6px;min-width:220px;">Falar por WhatsApp</a>` : ""}
        ${telLink ? `<a href="${esc(telLink)}" style="display:inline-block;background:#be123c;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 22px;border-radius:10px;margin:6px;min-width:220px;">Ligar ${esc(clinicPhone)}</a>` : ""}
      </div>`;
    return html(layout({ clinicName, inner, clinicPhone, clinicEmail }));
  } catch (e) {
    return html(errorPage("Ocorreu um erro inesperado. Por favor tente novamente ou contacte-nos."), 500);
  }
});
