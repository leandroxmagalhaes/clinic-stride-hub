import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(unsafe: string): string {
  return String(unsafe ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const provided = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const ok =
      provided === serviceKey ||
      (!!cronSecret && provided === cronSecret) ||
      (!!anonKey && provided === anonKey);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Optional test flags (body or query)
    let dryRun = false;
    try {
      const u = new URL(req.url);
      if (u.searchParams.get("dry_run") === "1") dryRun = true;
      if (req.method === "POST") {
        const raw = await req.clone().text();
        if (raw) {
          const b = JSON.parse(raw);
          if (b?.dry_run === true) dryRun = true;
        }
      }
    } catch (_e) { /* ignore */ }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const resend = new Resend(resendApiKey);

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000);

    const { data: settingsRows } = await supabase
      .from("clinic_settings")
      .select(
        "clinic_id, timezone, reminder_ativo, reminder_antecedencia_horas, reminder_saudacao, mbway_nome_1, mbway_numero_1, mbway_nome_2, mbway_numero_2, iban_nome, iban"
      );
    const settingsMap = new Map<string, any>();
    for (const r of settingsRows || []) settingsMap.set((r as any).clinic_id, r);

    const { data: sessions, error: sessionsError } = await supabase
      .from("sessoes")
      .select(`
        id, start_time, status, clinic_id, isento, pack_id, payment_status, pagamento_estado, sem_cobranca, confirmation_token,
        pacientes!sessoes_paciente_id_fkey ( full_name, email ),
        profiles!sessoes_profissional_id_fkey ( full_name ),
        servicos!sessoes_servico_id_fkey ( name ),
        clinics!sessoes_clinic_id_fkey ( name, phone, email )
      `)
      .gte("start_time", now.toISOString())
      .lte("start_time", windowEnd.toISOString())
      .in("status", ["agendado", "confirmado"]);
    if (sessionsError) throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);

    const results = { sent: 0, skipped: 0, pending: 0, errors: [] as string[] };

    for (const session of sessions || []) {
      try {
        const patient = (session as any).pacientes;
        const professional = (session as any).profiles;
        const service = (session as any).servicos;
        const clinic = (session as any).clinics;
        const settings = settingsMap.get((session as any).clinic_id) || {};

        if (settings.reminder_ativo === false) {
          results.skipped++;
          continue;
        }

        const antecedencia = Number(settings.reminder_antecedencia_horas ?? 3);
        const hoursUntil =
          (new Date((session as any).start_time).getTime() - now.getTime()) / 3600000;
        if (hoursUntil > antecedencia) {
          results.pending++;
          continue;
        }
        if (!patient?.email) {
          results.skipped++;
          continue;
        }

        const { data: existingLog } = await supabase
          .from("reminder_logs")
          .select("id")
          .eq("sessao_id", (session as any).id)
          .eq("canal", "email")
          .maybeSingle();
        if (existingLog) {
          results.skipped++;
          continue;
        }

        const tz = settings.timezone || "Europe/Lisbon";
        const apt = new Date((session as any).start_time);
        const formattedDate = apt.toLocaleDateString("pt-PT", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: tz,
        });
        const formattedTime = apt.toLocaleTimeString("pt-PT", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: tz,
        });

        const jaPago =
          (session as any).payment_status === "pago" ||
          (session as any).pagamento_estado === "pago";
        const temDados = !!(settings.mbway_numero_1 || settings.iban);
        const mostrarPagamento =
          !(session as any).isento && !(session as any).pack_id && !(session as any).sem_cobranca && !jaPago && temDados;

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const tokenSessao = (session as any).confirmation_token;
        const baseMetodo = tokenSessao
          ? `${supabaseUrl}/functions/v1/confirmar-metodo-pagamento?token=${encodeURIComponent(tokenSessao)}`
          : "";
        const botoesMetodoHtml = tokenSessao
          ? `
              <p style="margin:14px 0 8px;color:#0c4a6e;font-size:14px;font-weight:600;">Como vai preferir pagar?</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0;">
                <tr>
                  <td style="padding-right:8px;">
                    <a href="${baseMetodo}&metodo=numerario" style="display:inline-block;background-color:#16a34a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;">Numerário</a>
                  </td>
                  <td>
                    <a href="${baseMetodo}&metodo=mbway_transferencia" style="display:inline-block;background-color:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;">MB WAY ou transferência</a>
                  </td>
                </tr>
              </table>`
          : "";

        const pagamentoHtml = mostrarPagamento
          ? `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin:16px 0;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 8px;color:#0c4a6e;font-size:14px;line-height:1.5;">
                Se preferir adiantar o pagamento e agilizar a chegada, deixamos os dados (é totalmente opcional):
              </p>
              <p style="margin:6px 0;color:#0c4a6e;font-size:14px;">
                <strong>MB WAY:</strong> ${escapeHtml(settings.mbway_nome_1 || "")} — ${escapeHtml(settings.mbway_numero_1 || "")}
              </p>
              ${
                settings.mbway_numero_2
                  ? `<p style="margin:6px 0;color:#0c4a6e;font-size:13px;">Alternativa (caso o 1.º atinja o limite): ${escapeHtml(settings.mbway_nome_2 || "")} — ${escapeHtml(settings.mbway_numero_2)}</p>`
                  : ""
              }
              ${
                settings.iban
                  ? `<p style="margin:6px 0;color:#0c4a6e;font-size:14px;"><strong>IBAN:</strong> ${escapeHtml(settings.iban_nome || "")} — ${escapeHtml(settings.iban)}</p>`
                  : ""
              }
              <p style="margin:10px 0 0;color:#0c4a6e;font-size:13px;line-height:1.5;">
                Também pode pagar no local, em numerário, sem qualquer problema. Se já efetuou o pagamento, agradecemos que responda só a confirmar.
              </p>
              ${botoesMetodoHtml}
            </td>
          </tr>
        </table>`
          : "";

        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:20px;">
    <tr>
      <td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e4e4e7;">
          <h1 style="margin:0;color:#f59e0b;font-size:22px;">Lembrete da sua consulta</h1>
        </div>
        <div style="padding:24px 0 8px;">
          <p style="margin:0;color:#3f3f46;font-size:15px;line-height:1.6;">${
            escapeHtml(settings.reminder_saudacao || "Olá! Lembramos a consulta do/a {nome} no dia {data} às {hora}. Estamos a contar consigo 💙")
              .replace(/\{nome\}/g, "<strong>" + escapeHtml(patient.full_name) + "</strong>")
              .replace(/\{data\}/g, formattedDate)
              .replace(/\{hora\}/g, formattedTime)
          }</p>
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:8px;margin:16px 0;">
          <tr><td style="padding:20px;">
            <p style="margin:0 0 10px;color:#78350f;font-size:15px;"><strong>Data:</strong> ${formattedDate}</p>
            <p style="margin:0 0 10px;color:#78350f;font-size:15px;"><strong>Hora:</strong> ${formattedTime}</p>
            <p style="margin:0 0 10px;color:#78350f;font-size:15px;"><strong>Profissional:</strong> ${escapeHtml(professional?.full_name || "A confirmar")}</p>
            <p style="margin:0;color:#78350f;font-size:15px;"><strong>Serviço:</strong> ${escapeHtml(service?.name || "Consulta")}</p>
          </td></tr>
        </table>
        ${pagamentoHtml}
        <div style="padding:16px 0;border-top:1px solid #e4e4e7;">
          <p style="margin:0;color:#71717a;font-size:14px;line-height:1.5;">
            Em caso de impedimento, por favor contacte-nos o mais rapidamente possível. Até já!
          </p>
        </div>
        <div style="padding-top:20px;border-top:1px solid #e4e4e7;text-align:center;">
          <p style="margin:0 0 6px;color:#18181b;font-size:16px;font-weight:600;">${escapeHtml(clinic?.name || "Clínica")}</p>
          ${clinic?.phone ? `<p style="margin:0 0 4px;color:#71717a;font-size:14px;">📞 ${escapeHtml(clinic.phone)}</p>` : ""}
          ${clinic?.email ? `<p style="margin:0;color:#71717a;font-size:14px;">✉️ ${escapeHtml(clinic.email)}</p>` : ""}
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

        if (!dryRun) {
          await resend.emails.send({
            from: `${clinic?.name || "Respira & Desenvolve"} <noreply@respiraedesenvolve.com>`,
            to: [patient.email],
            subject: `Lembrete da sua consulta às ${formattedTime} — ${clinic?.name || "Respira & Desenvolve"}`,
            html: emailHtml,
          });
          await supabase.from("reminder_logs").insert({ sessao_id: (session as any).id, canal: "email" });
        }
        results.sent++;
      } catch (e) {
        results.errors.push(
          `Session ${(session as any).id}: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    // ============================================================
    // Follow-up de metodo de pagamento apos a consulta
    // ============================================================
    const followupResults = { sent: 0, skipped: 0, errors: [] as string[] };
    try {
      // Central de Automações: followup_pagamento
      const followupMap = new Map<string, { ativo: boolean; atrasoMin: number }>();
      try {
        const { data: autoRows } = await supabase
          .from("automacoes_config")
          .select("clinic_id, ativo, config")
          .eq("chave", "followup_pagamento");
        for (const r of autoRows || []) {
          const cfg = (r as any).config || {};
          const raw = Number(cfg.atraso_minutos);
          followupMap.set((r as any).clinic_id, {
            ativo: (r as any).ativo !== false,
            atrasoMin: Number.isFinite(raw) && raw >= 0 ? raw : 30,
          });
        }
      } catch (_e) { /* fallback silencioso */ }
      const getFollowup = (clinicId: string) =>
        followupMap.get(clinicId) || { ativo: true, atrasoMin: 30 };

      const cutoff = now.toISOString();
      const dayFloor = new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString();

      const { data: pastSessions, error: pastErr } = await supabase
        .from("sessoes")
        .select(`
          id, start_time, end_time, status, clinic_id, isento, pack_id, payment_status, pagamento_estado, sem_cobranca, metodo_pagamento_previsto, confirmation_token,
          pacientes!sessoes_paciente_id_fkey ( full_name, email ),
          clinics!sessoes_clinic_id_fkey ( name, phone, email )
        `)
        .lte("end_time", cutoff)
        .gte("end_time", dayFloor)
        .in("status", ["agendado", "confirmado", "realizado"])
        .eq("payment_status", "pendente")
        .is("metodo_pagamento_previsto", null);

      if (pastErr) throw new Error(pastErr.message);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

      for (const session of pastSessions || []) {
        try {
          const s: any = session;
          const patient = s.pacientes;
          const clinic = s.clinics;
          const settings = settingsMap.get(s.clinic_id) || {};

          const followupCfg = getFollowup(s.clinic_id);
          if (!followupCfg.ativo) { followupResults.skipped++; continue; }
          // Só depois de passado o atraso configurado desde o fim da consulta
          const endMs = new Date(s.end_time).getTime();
          if (now.getTime() - endMs < followupCfg.atrasoMin * 60 * 1000) { followupResults.skipped++; continue; }

          if (settings.reminder_ativo === false) { followupResults.skipped++; continue; }
          if (s.isento || s.pack_id || (s as any).sem_cobranca) { followupResults.skipped++; continue; }
          if (!patient?.email) { followupResults.skipped++; continue; }
          if (!s.confirmation_token) { followupResults.skipped++; continue; }

          const temDados = !!(settings.mbway_numero_1 || settings.iban);
          if (!temDados) { followupResults.skipped++; continue; }

          const { data: existingLog } = await supabase
            .from("reminder_logs")
            .select("id")
            .eq("sessao_id", s.id)
            .eq("canal", "email_metodo_followup")
            .maybeSingle();
          if (existingLog) { followupResults.skipped++; continue; }

          const tz = settings.timezone || "Europe/Lisbon";
          const apt = new Date(s.start_time);
          const formattedTime = apt.toLocaleTimeString("pt-PT", {
            hour: "2-digit", minute: "2-digit", timeZone: tz,
          });

          const baseMetodo = `${supabaseUrl}/functions/v1/confirmar-metodo-pagamento?token=${encodeURIComponent(s.confirmation_token)}`;

          const pagamentoHtml = `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin:16px 0;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 8px;color:#0c4a6e;font-size:14px;font-weight:600;">Como foi ou será efetuado o pagamento?</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 12px;">
                <tr>
                  <td style="padding-right:8px;">
                    <a href="${baseMetodo}&metodo=numerario" style="display:inline-block;background-color:#16a34a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;">Numerário</a>
                  </td>
                  <td>
                    <a href="${baseMetodo}&metodo=mbway_transferencia" style="display:inline-block;background-color:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;">MB WAY ou transferência</a>
                  </td>
                </tr>
              </table>
              <p style="margin:6px 0;color:#0c4a6e;font-size:14px;">
                <strong>MB WAY:</strong> ${escapeHtml(settings.mbway_nome_1 || "")} — ${escapeHtml(settings.mbway_numero_1 || "")}
              </p>
              ${settings.mbway_numero_2 ? `<p style="margin:6px 0;color:#0c4a6e;font-size:13px;">Alternativa (caso o 1.º atinja o limite): ${escapeHtml(settings.mbway_nome_2 || "")} — ${escapeHtml(settings.mbway_numero_2)}</p>` : ""}
              ${settings.iban ? `<p style="margin:6px 0;color:#0c4a6e;font-size:14px;"><strong>IBAN:</strong> ${escapeHtml(settings.iban_nome || "")} — ${escapeHtml(settings.iban)}</p>` : ""}
            </td>
          </tr>
        </table>`;

          const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:20px;">
    <tr><td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e4e4e7;">
        <h1 style="margin:0;color:#0ea5e9;font-size:22px;">Sobre o pagamento da consulta de hoje</h1>
      </div>
      <div style="padding:24px 0 8px;">
        <p style="margin:0;color:#3f3f46;font-size:15px;line-height:1.6;">
          Olá <strong>${escapeHtml(patient.full_name)}</strong>, obrigado pela presença na consulta de hoje às <strong>${formattedTime}</strong>. Para fecharmos o registo, pode indicar-nos por que forma foi ou será efetuado o pagamento?
        </p>
      </div>
      ${pagamentoHtml}
      <div style="padding-top:20px;border-top:1px solid #e4e4e7;text-align:center;">
        <p style="margin:0 0 6px;color:#18181b;font-size:16px;font-weight:600;">${escapeHtml(clinic?.name || "Clínica")}</p>
        ${clinic?.phone ? `<p style="margin:0 0 4px;color:#71717a;font-size:14px;">📞 ${escapeHtml(clinic.phone)}</p>` : ""}
        ${clinic?.email ? `<p style="margin:0;color:#71717a;font-size:14px;">✉️ ${escapeHtml(clinic.email)}</p>` : ""}
      </div>
    </td></tr>
  </table>
</body></html>`;

          if (!dryRun) {
            await resend.emails.send({
              from: `${clinic?.name || "Respira & Desenvolve"} <noreply@respiraedesenvolve.com>`,
              to: [patient.email],
              subject: `Sobre o pagamento da consulta de hoje`,
              html: emailHtml,
            });
            await supabase.from("reminder_logs").insert({ sessao_id: s.id, canal: "email_metodo_followup" });
          }
          followupResults.sent++;
        } catch (e) {
          followupResults.errors.push(
            `Session ${(session as any).id}: ${e instanceof Error ? e.message : "Unknown error"}`
          );
        }
      }
    } catch (e) {
      followupResults.errors.push(`Followup block: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    return new Response(JSON.stringify({ success: true, dry_run: dryRun, results, followup: followupResults }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
