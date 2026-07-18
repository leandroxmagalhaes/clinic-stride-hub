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

// Data "YYYY-MM-DD" no fuso indicado (robusto a DST: deixa o Intl converter)
function dateInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const pubKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const pubKeysRaw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "";
    let pubKeys: string[] = [];
    if (pubKeysRaw.trim().startsWith("{") || pubKeysRaw.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(pubKeysRaw);
        if (Array.isArray(parsed)) pubKeys = parsed.filter(x => typeof x === "string");
        else if (parsed && typeof parsed === "object") pubKeys = Object.values(parsed).filter((x): x is string => typeof x === "string");
      } catch { /* ignore */ }
    } else {
      pubKeys = pubKeysRaw.split(/[,\s]+/).filter(Boolean);
    }
    const provided = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const legacyAnonJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmenh0aWxkZ2Rhd2NwbHlrYmRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDMyMTksImV4cCI6MjA4MzkxOTIxOX0.ibEeGX85efCDqUgUAjTncPxNQv4GeRIjfqwTD7b3rMk";
    const ok =
      provided === serviceKey ||
      (!!cronSecret && provided === cronSecret) ||
      (!!anonKey && provided === anonKey) ||
      provided === legacyAnonJwt ||
      pubKeys.includes(provided);
    if (!ok) {
      const diag = new URL(req.url).searchParams.get("diag") === "1";
      return new Response(JSON.stringify({
        error: "Unauthorized",
        ...(diag ? {
          providedPrefix: provided.slice(0, 12),
          providedLen: provided.length,
          anonKeyPrefix: (anonKey || "").slice(0, 12),
          anonKeyLen: (anonKey || "").length,
          pubKeyPrefix: (pubKey || "").slice(0, 12),
          pubKeysCount: pubKeys.length,
          pubKeysPrefixes: pubKeys.map(k => k.slice(0, 12)),
        } : {}),
      }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const resend = new Resend(resendApiKey);

    // ---------- Travões de teste (opcionais). Produção/cron não passa nenhum. ----------
    const url = new URL(req.url);
    const qp = url.searchParams;
    let body: Record<string, any> = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { /* sem corpo JSON — ok */ }
    }
    const flag = (k: string): string => {
      const q = qp.get(k);
      if (q != null) return q;
      const b = body[k];
      return b == null ? "" : String(b);
    };
    const isOn = (k: string) => flag(k) === "1" || flag(k) === "true";
    const dryRun = isOn("dry_run");
    const ignoreCutoff = isOn("ignore_cutoff");
    const force = isOn("force");
    const onlyEmail = flag("only_email").trim().toLowerCase();
    const targetDateOverride = flag("target_date").trim();

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data: settingsRows } = await supabase
      .from("clinic_settings")
      .select(
        "clinic_id, timezone, confirmacao_dia_anterior_ativo, confirmacao_hora_corte, confirmacao_saudacao"
      );
    const settingsMap = new Map<string, any>();
    for (const r of settingsRows || []) settingsMap.set((r as any).clinic_id, r);

    // ---------- Central de Automações: confirmacao_vespera ----------
    const automacaoMap = new Map<string, { ativo: boolean; horaCorteMin: number; horaSegundaMin: number; horaAlertaMin: number }>();
    const parseHoraToMin = (v: unknown, fallback: number): number => {
      try {
        if (v == null) return fallback;
        const s = String(v).trim();
        if (!s) return fallback;
        const parts = s.split(":");
        const h = Number(parts[0]);
        const m = parts.length > 1 ? Number(parts[1]) : 0;
        if (!Number.isFinite(h) || h < 0 || h > 23) return fallback;
        if (!Number.isFinite(m) || m < 0 || m > 59) return fallback;
        return h * 60 + m;
      } catch { return fallback; }
    };
    try {
      const { data: autoRows } = await supabase
        .from("automacoes_config")
        .select("clinic_id, ativo, config")
        .eq("chave", "confirmacao_vespera");
      for (const r of autoRows || []) {
        const cfg = (r as any).config || {};
        automacaoMap.set((r as any).clinic_id, {
          ativo: (r as any).ativo !== false,
          horaCorteMin: parseHoraToMin(cfg.hora_corte, 14 * 60),
          horaSegundaMin: parseHoraToMin(cfg.hora_segunda, 18 * 60),
          horaAlertaMin: parseHoraToMin(cfg.hora_alerta, 20 * 60),
        });
      }
    } catch (_e) { /* fallback silencioso */ }
    const getAutomacao = (clinicId: string) =>
      automacaoMap.get(clinicId) || { ativo: true, horaCorteMin: 14 * 60, horaSegundaMin: 18 * 60, horaAlertaMin: 20 * 60 };

    const { data: sessions, error: sessionsError } = await supabase
      .from("sessoes")
      .select(`
        id, start_time, status, clinic_id, confirmation_token, confirmacao_estado,
        pacientes!sessoes_paciente_id_fkey ( full_name, email ),
        profiles!sessoes_profissional_id_fkey ( full_name ),
        servicos!sessoes_servico_id_fkey ( name ),
        clinics!sessoes_clinic_id_fkey ( name, phone, email )
      `)
      .gte("start_time", now.toISOString())
      .lte("start_time", windowEnd.toISOString())
      .in("status", ["agendado", "confirmado"]);
    if (sessionsError) throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);

    const results = {
      sent: 0,
      skipped: 0,
      pending: 0,
      errors: [] as string[],
      preview: [] as any[],
    };

    for (const session of sessions || []) {
      try {
        const patient = (session as any).pacientes;
        const professional = (session as any).profiles;
        const service = (session as any).servicos;
        const clinic = (session as any).clinics;
        const settings = settingsMap.get((session as any).clinic_id) || {};
        const tz = settings.timezone || "Europe/Lisbon";

        const automacao = getAutomacao((session as any).clinic_id);
        if (settings.confirmacao_dia_anterior_ativo === false || automacao.ativo === false) {
          results.skipped++;
          continue;
        }

        if (!ignoreCutoff) {
          const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).formatToParts(now);
          const lh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
          const lm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
          const nowLocalMin = lh * 60 + lm;
          // Se admin definiu no clinic_settings, respeita; senão usa a Central
          const cutoffFromSettings = settings.confirmacao_hora_corte
            ? parseHoraToMin(settings.confirmacao_hora_corte, automacao.horaCorteMin)
            : automacao.horaCorteMin;
          if (nowLocalMin < cutoffFromSettings) {
            results.pending++;
            continue;
          }
        }


        const targetDate =
          targetDateOverride ||
          dateInTz(new Date(now.getTime() + 24 * 60 * 60 * 1000), tz);
        const sessLocalDate = dateInTz(new Date((session as any).start_time), tz);
        if (sessLocalDate !== targetDate) {
          continue;
        }

        if (!patient?.email) {
          results.skipped++;
          continue;
        }
        if (onlyEmail && String(patient.email).toLowerCase() !== onlyEmail) {
          results.skipped++;
          continue;
        }

        if (!force) {
          const { data: existingLog } = await supabase
            .from("reminder_logs")
            .select("id")
            .eq("sessao_id", (session as any).id)
            .eq("canal", "email_dia_anterior")
            .maybeSingle();
          if (existingLog) {
            results.skipped++;
            continue;
          }
        }

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

        const token = (session as any).confirmation_token;
        const baseLink = `${supabaseUrl}/functions/v1/confirmar-presenca?token=${encodeURIComponent(
          token
        )}`;
        const confirmarUrl = `${baseLink}&accao=confirmar`;
        const remarcarUrl = `${baseLink}&accao=remarcar`;

        const saudacao = escapeHtml(
          settings.confirmacao_saudacao ||
            "Olá! Lembramos a consulta do/a {nome} amanhã, {data}, às {hora}. Pode confirmar a presença?"
        )
          .replace(/\{nome\}/g, "<strong>" + escapeHtml(patient.full_name) + "</strong>")
          .replace(/\{data\}/g, formattedDate)
          .replace(/\{hora\}/g, formattedTime);

        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:20px;">
    <tr>
      <td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e4e4e7;">
          <h1 style="margin:0;color:#be123c;font-size:22px;">${escapeHtml(clinic?.name || "Respira & Desenvolve")}</h1>
        </div>
        <div style="padding:24px 0 8px;">
          <p style="margin:0;color:#3f3f46;font-size:15px;line-height:1.6;">${saudacao}</p>
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:8px;margin:16px 0;">
          <tr><td style="padding:20px;">
            <p style="margin:0 0 10px;color:#78350f;font-size:15px;"><strong>Data:</strong> ${formattedDate}</p>
            <p style="margin:0 0 10px;color:#78350f;font-size:15px;"><strong>Hora:</strong> ${formattedTime}</p>
            <p style="margin:0 0 10px;color:#78350f;font-size:15px;"><strong>Profissional:</strong> ${escapeHtml(professional?.full_name || "A confirmar")}</p>
            <p style="margin:0;color:#78350f;font-size:15px;"><strong>Serviço:</strong> ${escapeHtml(service?.name || "Consulta")}</p>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 8px;">
          <tr><td align="center">
            <a href="${confirmarUrl}" style="display:inline-block;background-color:#16a34a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:600;">✓ Confirmar presença</a>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
          <tr><td align="center">
            <a href="${remarcarUrl}" style="display:inline-block;background-color:transparent;color:#be123c;text-decoration:none;padding:12px 24px;border:1px solid #e4e4e7;border-radius:8px;font-size:14px;font-weight:500;">Preciso de remarcar</a>
          </td></tr>
        </table>
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

        if (dryRun) {
          results.preview.push({
            to: patient.email,
            nome: patient.full_name,
            data: formattedDate,
            hora: formattedTime,
          });
          results.sent++;
          continue;
        }

        await resend.emails.send({
          from: `${clinic?.name || "Respira & Desenvolve"} <noreply@respiraedesenvolve.com>`,
          to: [patient.email],
          subject: `Confirma a consulta de amanhã às ${formattedTime} — ${clinic?.name || "Respira & Desenvolve"}`,
          html: emailHtml,
        });

        if (!force) {
          await supabase
            .from("reminder_logs")
            .insert({ sessao_id: (session as any).id, canal: "email_dia_anterior" });
        }
        results.sent++;
      } catch (e) {
        results.errors.push(
          `Session ${(session as any).id}: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    // Helper: minutos locais na tz
    const localMinutes = (tz: string): number => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(now);
      const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
      const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
      return h * 60 + m;
    };

    // ============================================================
    // ALTERACAO 1 — Segunda tentativa depois das 18:00 (Lisboa)
    // ============================================================
    const results2 = { sent: 0, skipped: 0, pending: 0, errors: [] as string[], preview: [] as any[] };
    for (const session of sessions || []) {
      try {
        const patient = (session as any).pacientes;
        const professional = (session as any).profiles;
        const service = (session as any).servicos;
        const clinic = (session as any).clinics;
        const settings = settingsMap.get((session as any).clinic_id) || {};
        const tz = settings.timezone || "Europe/Lisbon";

        const automacao = getAutomacao((session as any).clinic_id);
        if (settings.confirmacao_dia_anterior_ativo === false || automacao.ativo === false) { results2.skipped++; continue; }

        // Só sessões ainda por confirmar
        if ((session as any).status !== "agendado") { results2.skipped++; continue; }
        if ((session as any).confirmacao_estado === "confirmado") { results2.skipped++; continue; }

        if (!ignoreCutoff) {
          if (localMinutes(tz) < automacao.horaSegundaMin) { results2.pending++; continue; }

        }

        const targetDate = targetDateOverride ||
          dateInTz(new Date(now.getTime() + 24 * 60 * 60 * 1000), tz);
        const sessLocalDate = dateInTz(new Date((session as any).start_time), tz);
        if (sessLocalDate !== targetDate) continue;

        if (!patient?.email) { results2.skipped++; continue; }
        if (onlyEmail && String(patient.email).toLowerCase() !== onlyEmail) { results2.skipped++; continue; }

        if (!force) {
          const { data: existingLog } = await supabase
            .from("reminder_logs")
            .select("id")
            .eq("sessao_id", (session as any).id)
            .eq("canal", "email_dia_anterior_2")
            .maybeSingle();
          if (existingLog) { results2.skipped++; continue; }
        }

        const apt = new Date((session as any).start_time);
        const formattedDate = apt.toLocaleDateString("pt-PT", {
          weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz,
        });
        const formattedTime = apt.toLocaleTimeString("pt-PT", {
          hour: "2-digit", minute: "2-digit", timeZone: tz,
        });

        const token = (session as any).confirmation_token;
        const baseLink = `${supabaseUrl}/functions/v1/confirmar-presenca?token=${encodeURIComponent(token)}`;
        const confirmarUrl = `${baseLink}&accao=confirmar`;
        const remarcarUrl = `${baseLink}&accao=remarcar`;

        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:20px;">
    <tr>
      <td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e4e4e7;">
          <h1 style="margin:0;color:#be123c;font-size:22px;">${escapeHtml(clinic?.name || "Respira & Desenvolve")}</h1>
        </div>
        <div style="padding:24px 0 8px;">
          <h2 style="margin:0 0 12px;color:#18181b;font-size:18px;">Última chamada para confirmar a sua consulta de amanhã</h2>
          <p style="margin:0;color:#3f3f46;font-size:15px;line-height:1.6;">Olá <strong>${escapeHtml(patient.full_name)}</strong>, precisamos da sua confirmação para amanhã.</p>
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:8px;margin:16px 0;">
          <tr><td style="padding:20px;">
            <p style="margin:0 0 10px;color:#78350f;font-size:15px;"><strong>Data:</strong> ${formattedDate}</p>
            <p style="margin:0 0 10px;color:#78350f;font-size:15px;"><strong>Hora:</strong> ${formattedTime}</p>
            <p style="margin:0 0 10px;color:#78350f;font-size:15px;"><strong>Profissional:</strong> ${escapeHtml(professional?.full_name || "A confirmar")}</p>
            <p style="margin:0;color:#78350f;font-size:15px;"><strong>Serviço:</strong> ${escapeHtml(service?.name || "Consulta")}</p>
          </td></tr>
        </table>
        <div style="padding:8px 0 4px;">
          <p style="margin:0;color:#3f3f46;font-size:15px;line-height:1.6;">Ainda não recebemos a sua confirmação. Temos utentes em lista de espera, e uma ausência sem aviso impede outra família de ser atendida. Por favor confirme ou peça remarcação pelos botões abaixo. Sem resposta, a nossa equipa poderá entrar em contacto consigo.</p>
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 8px;">
          <tr><td align="center">
            <a href="${confirmarUrl}" style="display:inline-block;background-color:#16a34a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:600;">✓ Confirmar presença</a>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
          <tr><td align="center">
            <a href="${remarcarUrl}" style="display:inline-block;background-color:transparent;color:#be123c;text-decoration:none;padding:12px 24px;border:1px solid #e4e4e7;border-radius:8px;font-size:14px;font-weight:500;">Preciso de remarcar</a>
          </td></tr>
        </table>
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

        if (dryRun) {
          results2.preview.push({ to: patient.email, nome: patient.full_name, data: formattedDate, hora: formattedTime });
          results2.sent++;
          continue;
        }

        await resend.emails.send({
          from: `${clinic?.name || "Respira & Desenvolve"} <noreply@respiraedesenvolve.com>`,
          to: [patient.email],
          subject: `Última chamada — confirme a consulta de amanhã às ${formattedTime}`,
          html: emailHtml,
        });

        if (!force) {
          await supabase
            .from("reminder_logs")
            .insert({ sessao_id: (session as any).id, canal: "email_dia_anterior_2" });
        }
        results2.sent++;
      } catch (e) {
        results2.errors.push(
          `Session ${(session as any).id}: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    // ============================================================
    // ALTERACAO 2 — Alerta interno depois das 20:00 (Lisboa)
    // ============================================================
    const results3 = { created: 0, skipped: 0, pending: 0, errors: [] as string[] };
    for (const session of sessions || []) {
      try {
        const patient = (session as any).pacientes;
        const settings = settingsMap.get((session as any).clinic_id) || {};
        const tz = settings.timezone || "Europe/Lisbon";

        if (settings.confirmacao_dia_anterior_ativo === false) { results3.skipped++; continue; }
        if ((session as any).status !== "agendado") { results3.skipped++; continue; }
        if ((session as any).confirmacao_estado === "confirmado") { results3.skipped++; continue; }

        if (!ignoreCutoff) {
          if (localMinutes(tz) < 20 * 60) { results3.pending++; continue; }
        }

        const targetDate = targetDateOverride ||
          dateInTz(new Date(now.getTime() + 24 * 60 * 60 * 1000), tz);
        const sessLocalDate = dateInTz(new Date((session as any).start_time), tz);
        if (sessLocalDate !== targetDate) continue;

        if (!force) {
          const { data: existingLog } = await supabase
            .from("reminder_logs")
            .select("id")
            .eq("sessao_id", (session as any).id)
            .eq("canal", "alerta_nao_confirmada")
            .maybeSingle();
          if (existingLog) { results3.skipped++; continue; }
        }

        const apt = new Date((session as any).start_time);
        const formattedTime = apt.toLocaleTimeString("pt-PT", {
          hour: "2-digit", minute: "2-digit", timeZone: tz,
        });

        if (dryRun) {
          results3.created++;
          continue;
        }

        try {
          await supabase.from("notifications").insert({
            clinic_id: (session as any).clinic_id,
            type: "confirmacao_pendente",
            title: "Consulta não confirmada",
            message: `${patient?.full_name || "Utente"} — ${formattedTime}: sem resposta às duas tentativas, decidir contacto.`,
          });
        } catch (notifErr) {
          results3.errors.push(
            `Notif session ${(session as any).id}: ${notifErr instanceof Error ? notifErr.message : "Unknown error"}`
          );
        }

        if (!force) {
          await supabase
            .from("reminder_logs")
            .insert({ sessao_id: (session as any).id, canal: "alerta_nao_confirmada" });
        }
        results3.created++;
      } catch (e) {
        results3.errors.push(
          `Session ${(session as any).id}: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    return new Response(JSON.stringify({ success: true, results, results2, results3 }), {
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
