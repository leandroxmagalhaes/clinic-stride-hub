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

type Gatilho = "antes" | "depois";
type Condicao = "todas" | "nao_confirmadas" | "pagamento_pendente";

interface Rule {
  id: string;
  clinic_id: string;
  chave: string;
  nome: string;
  ativo: boolean;
  config: {
    gatilho?: Gatilho;
    offset_horas?: number;
    condicao?: Condicao;
    assunto?: string;
    corpo?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const pubKeysRaw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "";
    let pubKeys: string[] = [];
    if (pubKeysRaw.trim().startsWith("{") || pubKeysRaw.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(pubKeysRaw);
        if (Array.isArray(parsed)) pubKeys = parsed.filter((x) => typeof x === "string");
        else if (parsed && typeof parsed === "object")
          pubKeys = Object.values(parsed).filter((x): x is string => typeof x === "string");
      } catch { /* ignore */ }
    } else {
      pubKeys = pubKeysRaw.split(/[,\s]+/).filter(Boolean);
    }
    const provided = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const legacyAnonJwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmenh0aWxkZ2Rhd2NwbHlrYmRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDMyMTksImV4cCI6MjA4MzkxOTIxOX0.ibEeGX85efCDqUgUAjTncPxNQv4GeRIjfqwTD7b3rMk";
    const ok =
      provided === serviceKey ||
      (!!cronSecret && provided === cronSecret) ||
      (!!anonKey && provided === anonKey) ||
      provided === legacyAnonJwt ||
      pubKeys.includes(provided);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const resend = new Resend(resendApiKey);

    // Flags
    const url = new URL(req.url);
    const qp = url.searchParams;
    let body: Record<string, any> = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { /* ok */ }
    }
    const flag = (k: string): string => {
      const q = qp.get(k);
      if (q != null) return q;
      const b = body[k];
      return b == null ? "" : String(b);
    };
    const isOn = (k: string) => flag(k) === "1" || flag(k) === "true";
    const dryRun = isOn("dry_run");
    const force = isOn("force");

    // Buscar regras ativas
    const { data: rulesData, error: rulesError } = await supabase
      .from("automacoes_config")
      .select("id, clinic_id, chave, nome, ativo, config")
      .like("chave", "custom_%")
      .eq("ativo", true);
    if (rulesError) throw new Error(`Failed to fetch rules: ${rulesError.message}`);
    const rules = (rulesData ?? []) as Rule[];

    const results = {
      rules: rules.length,
      sent: 0,
      skipped: 0,
      errors: [] as string[],
      preview: [] as any[],
    };

    const now = new Date();

    for (const rule of rules) {
      try {
        const gatilho: Gatilho = (rule.config?.gatilho as Gatilho) ?? "antes";
        const offsetH = Math.max(1, Math.min(72, Number(rule.config?.offset_horas ?? 0)));
        const condicao: Condicao = (rule.config?.condicao as Condicao) ?? "todas";
        const assunto = rule.config?.assunto ?? rule.nome ?? "Lembrete";
        const corpo = rule.config?.corpo ?? "";
        if (!offsetH || !corpo.trim()) {
          results.skipped++;
          continue;
        }

        // Definir janela temporal
        let startFilter: string;
        let endFilter: string;
        let field: "start_time" | "end_time";
        if (gatilho === "antes") {
          // Sessões cujo início cai entre agora e agora+offsetH (já entraram na janela).
          field = "start_time";
          startFilter = now.toISOString();
          endFilter = new Date(now.getTime() + offsetH * 60 * 60 * 1000).toISOString();
        } else {
          // Sessões cujo fim já passou há pelo menos offsetH, limitado ao dia (últimas 24h).
          field = "end_time";
          endFilter = new Date(now.getTime() - offsetH * 60 * 60 * 1000).toISOString();
          startFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        }

        const query = supabase
          .from("sessoes")
          .select(`
            id, start_time, end_time, status, confirmacao_estado,
            payment_status, sem_cobranca, clinic_id,
            pacientes!sessoes_paciente_id_fkey ( full_name, email ),
            profiles!sessoes_profissional_id_fkey ( full_name ),
            servicos!sessoes_servico_id_fkey ( name ),
            clinics!sessoes_clinic_id_fkey ( name, phone, email )
          `)
          .eq("clinic_id", rule.clinic_id);

        let sessions: any[] = [];
        if (gatilho === "antes") {
          const { data, error } = await query
            .gte(field, startFilter)
            .lte(field, endFilter)
            .in("status", ["agendado", "confirmado"]);
          if (error) throw new Error(error.message);
          sessions = data ?? [];
        } else {
          const { data, error } = await query
            .gte(field, startFilter)
            .lte(field, endFilter);
          if (error) throw new Error(error.message);
          sessions = data ?? [];
        }

        for (const session of sessions) {
          try {
            // Condição
            if (condicao === "nao_confirmadas") {
              if (session.confirmacao_estado === "confirmado") {
                results.skipped++;
                continue;
              }
            } else if (condicao === "pagamento_pendente") {
              if (session.sem_cobranca === true) {
                results.skipped++;
                continue;
              }
              if (session.payment_status !== "pendente") {
                results.skipped++;
                continue;
              }
            }

            const patient = session.pacientes;
            const professional = session.profiles;
            const service = session.servicos;
            const clinic = session.clinics;

            if (!patient?.email) {
              results.skipped++;
              continue;
            }

            const canal = `custom_${rule.chave}`;
            if (!force) {
              const { data: existingLog } = await supabase
                .from("reminder_logs")
                .select("id")
                .eq("sessao_id", session.id)
                .eq("canal", canal)
                .maybeSingle();
              if (existingLog) {
                results.skipped++;
                continue;
              }
            }

            const apt = new Date(session.start_time);
            const tz = "Europe/Lisbon";
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

            const vars: Record<string, string> = {
              nome: escapeHtml(patient.full_name ?? ""),
              data: escapeHtml(formattedDate),
              hora: escapeHtml(formattedTime),
              profissional: escapeHtml(professional?.full_name ?? ""),
              servico: escapeHtml(service?.name ?? ""),
            };

            const replaceVars = (s: string, escape: boolean) =>
              s.replace(/\{(nome|data|hora|profissional|servico)\}/g, (_m, k) =>
                escape ? vars[k] : (vars[k] ?? "")
              );

            const assuntoFinal = rule.config?.assunto
              ? rule.config.assunto.replace(
                  /\{(nome|data|hora|profissional|servico)\}/g,
                  (_m, k) => {
                    // Assunto: usar valor bruto (sem HTML), mas seguro para header
                    if (k === "nome") return patient.full_name ?? "";
                    if (k === "data") return formattedDate;
                    if (k === "hora") return formattedTime;
                    if (k === "profissional") return professional?.full_name ?? "";
                    if (k === "servico") return service?.name ?? "";
                    return "";
                  }
                )
              : rule.nome;

            const corpoHtml = replaceVars(corpo, true).replace(/\n/g, "<br/>");

            const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#222">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <h2 style="margin:0 0 12px 0;font-size:18px;color:#111">${escapeHtml(rule.nome ?? "Lembrete")}</h2>
    <div style="font-size:15px;line-height:1.55;color:#333">${corpoHtml}</div>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
    <p style="font-size:12px;color:#888;margin:0">${escapeHtml(clinic?.name ?? "")}</p>
  </div>
</body></html>`;

            if (dryRun) {
              results.preview.push({
                rule: rule.chave,
                session_id: session.id,
                to: patient.email,
                subject: assuntoFinal,
              });
              continue;
            }

            const { error: sendErr } = await resend.emails.send({
              from: "Respira & Desenvolve <noreply@respiraedesenvolve.com>",
              to: [patient.email],
              subject: assuntoFinal,
              html,
            });
            if (sendErr) throw new Error(sendErr.message || String(sendErr));

            await supabase.from("reminder_logs").insert({
              sessao_id: session.id,
              canal,
              enviado_em: new Date().toISOString(),
            });

            results.sent++;
          } catch (e: any) {
            results.errors.push(`rule=${rule.chave} session=${session.id}: ${e?.message ?? e}`);
          }
        }
      } catch (e: any) {
        results.errors.push(`rule=${rule.chave}: ${e?.message ?? e}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
