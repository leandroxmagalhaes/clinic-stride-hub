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

function formatEuro(v: number): string {
  try {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toFixed(2)} €`;
  }
}

type Canal =
  | "cobranca_inicio"
  | "cobranca_sessao_1"
  | "cobranca_sessao_3"
  | "cobranca_sessao_5"
  | "renovacao_faltam_2"
  | "renovacao_falta_1"
  | "renovacao_esgotado";

interface EmailContent {
  subject: string;
  intro: string;
}

function cobrancaContent(canal: Canal, nome: string, numero: number, total: number, valor: number): EmailContent {
  const nomeEsc = escapeHtml(nome);
  const valorFmt = formatEuro(valor);
  switch (canal) {
    case "cobranca_inicio":
      return {
        subject: `O seu Pack ${numero} já começou`,
        intro: `Olá ${nomeEsc}, o seu Pack ${numero} de ${total} sessões já está ativo. O valor de <strong>${valorFmt}</strong> ainda está por regularizar. Pode fazê-lo por MB WAY ou transferência bancária, com os dados abaixo. Se já efetuou o pagamento, por favor ignore esta mensagem. Qualquer dúvida, é só responder a este email.`,
      };
    case "cobranca_sessao_1":
      return {
        subject: `Parabéns pela primeira sessão do Pack ${numero}`,
        intro: `Olá ${nomeEsc}, parabéns, já concluiu a primeira sessão do seu Pack ${numero}. Aproveitamos para lembrar que o valor de <strong>${valorFmt}</strong> ainda está por regularizar. Pode pagar por MB WAY ou transferência, com os dados abaixo. Continuamos a contar consigo.`,
      };
    case "cobranca_sessao_3":
      return {
        subject: `Já vai na terceira sessão do Pack ${numero}`,
        intro: `Olá ${nomeEsc}, já completou três sessões do Pack ${numero}, excelente ritmo. O pagamento de <strong>${valorFmt}</strong> continua pendente. Quando puder, regularize por MB WAY ou transferência, com os dados abaixo. Se houver alguma dificuldade, fale connosco e encontramos uma solução.`,
      };
    case "cobranca_sessao_5":
      return {
        subject: `Pack ${numero} — pagamento por regularizar`,
        intro: `Olá ${nomeEsc}, já completou cinco sessões do Pack ${numero}. O pagamento de <strong>${valorFmt}</strong> continua por regularizar. Pedimos que nos contacte para acertarmos, ou que use os dados de MB WAY ou transferência abaixo. Obrigado pela colaboração.`,
      };
    default:
      return { subject: "", intro: "" };
  }
}

function renovacaoContent(canal: Canal, nome: string, numero: number): EmailContent {
  const nomeEsc = escapeHtml(nome);
  switch (canal) {
    case "renovacao_faltam_2":
      return {
        subject: `Faltam 2 sessões no seu Pack ${numero}`,
        intro: `Olá ${nomeEsc}, faltam apenas duas sessões para concluir o seu Pack ${numero}. Para não interromper o acompanhamento, pode desde já reservar o pack seguinte. Fale connosco e tratamos de tudo.`,
      };
    case "renovacao_falta_1":
      return {
        subject: `Falta 1 sessão no seu Pack ${numero}`,
        intro: `Olá ${nomeEsc}, falta apenas uma sessão para terminar o seu Pack ${numero}. Se quiser dar continuidade ao acompanhamento, responda a este email ou fale connosco para prepararmos o pack seguinte.`,
      };
    case "renovacao_esgotado":
      return {
        subject: `Concluiu o Pack ${numero}`,
        intro: `Olá ${nomeEsc}, concluiu todas as sessões do Pack ${numero}. Obrigado pela confiança. Para dar continuidade ao acompanhamento, fale connosco e preparamos o pack seguinte.`,
      };
    default:
      return { subject: "", intro: "" };
  }
}

function paymentBlockHtml(s: any): string {
  const nome1 = s?.mbway_nome_1 ? escapeHtml(s.mbway_nome_1) : "";
  const num1 = s?.mbway_numero_1 ? escapeHtml(s.mbway_numero_1) : "";
  const nome2 = s?.mbway_nome_2 ? escapeHtml(s.mbway_nome_2) : "";
  const num2 = s?.mbway_numero_2 ? escapeHtml(s.mbway_numero_2) : "";
  const ibanNome = s?.iban_nome ? escapeHtml(s.iban_nome) : "";
  const iban = s?.iban ? escapeHtml(s.iban) : "";

  const mbwayRow1 = num1
    ? `<p style="margin:0 0 6px;color:#0c4a6e;font-size:14px;"><strong>MB WAY:</strong> ${num1}${nome1 ? ` (${nome1})` : ""}</p>`
    : "";
  const mbwayRow2 = num2
    ? `<p style="margin:0 0 6px;color:#0c4a6e;font-size:14px;"><strong>MB WAY (alt.):</strong> ${num2}${nome2 ? ` (${nome2})` : ""}</p>`
    : "";
  const ibanRow = iban
    ? `<p style="margin:0;color:#0c4a6e;font-size:14px;"><strong>IBAN:</strong> ${iban}${ibanNome ? ` (${ibanNome})` : ""}</p>`
    : "";

  if (!mbwayRow1 && !mbwayRow2 && !ibanRow) return "";

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#e0f2fe;border:1px solid #7dd3fc;border-radius:8px;margin:16px 0;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 10px;color:#0c4a6e;font-size:14px;font-weight:600;">💳 Dados para pagamento</p>
        ${mbwayRow1}${mbwayRow2}${ibanRow}
      </td></tr>
    </table>`;
}

function buildEmailHtml(clinicName: string, content: EmailContent, settings: any, showPayment: boolean): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:20px;">
    <tr>
      <td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e4e4e7;">
          <h1 style="margin:0;color:#be123c;font-size:22px;">${escapeHtml(clinicName)}</h1>
        </div>
        <div style="padding:24px 0 8px;">
          <p style="margin:0;color:#3f3f46;font-size:15px;line-height:1.6;">${content.intro}</p>
        </div>
        ${showPayment ? paymentBlockHtml(settings) : ""}
        <div style="padding-top:20px;border-top:1px solid #e4e4e7;text-align:center;">
          <p style="margin:0;color:#71717a;font-size:13px;">Equipa ${escapeHtml(clinicName)}</p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

    // Settings por clínica
    const { data: settingsRows } = await supabase
      .from("clinic_settings")
      .select("clinic_id, timezone, mbway_nome_1, mbway_numero_1, mbway_nome_2, mbway_numero_2, iban_nome, iban");
    const settingsMap = new Map<string, any>();
    for (const r of settingsRows || []) settingsMap.set((r as any).clinic_id, r);

    // Central de automações
    const { data: autoRows } = await supabase
      .from("automacoes_config")
      .select("clinic_id, chave, ativo")
      .in("chave", ["pack_cobranca", "pack_renovacao"]);
    const autoMap = new Map<string, { cobranca: boolean; renovacao: boolean }>();
    for (const r of autoRows || []) {
      const cid = (r as any).clinic_id as string;
      const cur = autoMap.get(cid) || { cobranca: true, renovacao: true };
      if ((r as any).chave === "pack_cobranca") cur.cobranca = (r as any).ativo !== false;
      if ((r as any).chave === "pack_renovacao") cur.renovacao = (r as any).ativo !== false;
      autoMap.set(cid, cur);
    }
    const getAuto = (cid: string) => autoMap.get(cid) || { cobranca: true, renovacao: true };

    // Packs ativos + utente + clínica
    const { data: packs, error: packsError } = await supabase
      .from("packs")
      .select(`
        id, clinic_id, paciente_id, numero_pack, total_sessoes, valor_total,
        payment_status, data_inicio, status,
        pacientes!packs_paciente_id_fkey ( full_name, email ),
        clinics!packs_clinic_id_fkey ( name )
      `)
      .eq("status", "ativo");
    if (packsError) throw new Error(`Failed to fetch packs: ${packsError.message}`);

    // Sessões para contadores
    const packIds = (packs || []).map((p: any) => p.id);
    const sessionsByPack = new Map<string, { realizadas: number; agendadas: number }>();
    if (packIds.length > 0) {
      const { data: sess } = await supabase
        .from("sessoes")
        .select("pack_id, status, isento")
        .in("pack_id", packIds);
      for (const s of sess || []) {
        const pid = (s as any).pack_id as string;
        if (!pid || (s as any).isento === true) continue;
        const cur = sessionsByPack.get(pid) || { realizadas: 0, agendadas: 0 };
        const st = (s as any).status as string;
        if (["realizado", "finalizado", "falta_cobrada"].includes(st)) cur.realizadas++;
        else if (["agendado", "confirmado"].includes(st)) cur.agendadas++;
        sessionsByPack.set(pid, cur);
      }
    }

    const results = {
      packs: packs?.length || 0,
      cobranca_sent: { cobranca_inicio: 0, cobranca_sessao_1: 0, cobranca_sessao_3: 0, cobranca_sessao_5: 0 },
      renovacao_sent: { renovacao_faltam_2: 0, renovacao_falta_1: 0, renovacao_esgotado: 0 },
      notificacoes: 0,
      skipped: 0,
      errors: [] as string[],
      preview: [] as any[],
    };

    const today = new Date();
    const todayMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const sendOne = async (
      pack: any,
      canal: Canal,
      content: EmailContent,
      showPayment: boolean,
    ): Promise<boolean> => {
      const patient = pack.pacientes;
      const clinic = pack.clinics;
      const clinicName = clinic?.name || "Clínica";
      const settings = settingsMap.get(pack.clinic_id) || {};

      if (!patient?.email) {
        results.skipped++;
        return false;
      }

      // Dedup
      const { data: existing } = await supabase
        .from("pack_reminder_logs")
        .select("id")
        .eq("pack_id", pack.id)
        .eq("canal", canal)
        .maybeSingle();
      if (existing) {
        results.skipped++;
        return false;
      }

      if (dryRun) {
        results.preview.push({
          pack_id: pack.id,
          numero: pack.numero_pack,
          to: patient.email,
          canal,
          subject: content.subject,
        });
        return true;
      }

      const html = buildEmailHtml(clinicName, content, settings, showPayment);
      const { error: sendErr } = await resend.emails.send({
        from: `${clinicName} <noreply@respiraedesenvolve.com>`,
        to: [patient.email],
        subject: content.subject,
        html,
      });
      if (sendErr) throw new Error(sendErr.message || String(sendErr));

      await supabase.from("pack_reminder_logs").insert({
        pack_id: pack.id,
        canal,
      });
      return true;
    };

    const insertInternalNotification = async (
      pack: any,
      title: string,
      message: string,
    ) => {
      if (dryRun) return;
      await supabase.from("notifications").insert({
        clinic_id: pack.clinic_id,
        type: "pack_pagamento_pendente",
        title,
        message,
        metadata: {
          pack_id: pack.id,
          paciente_id: pack.paciente_id,
          numero_pack: pack.numero_pack,
        },
      });
      results.notificacoes++;
    };

    for (const pack of packs || []) {
      try {
        const p: any = pack;
        const counts = sessionsByPack.get(p.id) || { realizadas: 0, agendadas: 0 };
        const disponiveis = Math.max(0, (p.total_sessoes || 0) - counts.realizadas - counts.agendadas);
        const auto = getAuto(p.clinic_id);
        const nome = p.pacientes?.full_name || "";
        const valor = Number(p.valor_total || 0);
        const valorFmt = formatEuro(valor);

        // ============= COBRANÇA =============
        if (p.payment_status !== "pago" && auto.cobranca) {
          // cobranca_inicio: hoje >= data_inicio + 3 dias
          if (p.data_inicio) {
            const dataInicio = new Date(p.data_inicio);
            const inicioPlus3 = new Date(dataInicio.getTime() + 3 * 24 * 60 * 60 * 1000);
            const inicioPlus3Midnight = new Date(Date.UTC(
              inicioPlus3.getUTCFullYear(), inicioPlus3.getUTCMonth(), inicioPlus3.getUTCDate(),
            ));
            if (todayMidnight >= inicioPlus3Midnight) {
              const c = cobrancaContent("cobranca_inicio", nome, p.numero_pack, p.total_sessoes, valor);
              if (await sendOne(p, "cobranca_inicio", c, true)) results.cobranca_sent.cobranca_inicio++;
            }
          }

          if (counts.realizadas >= 1) {
            const c = cobrancaContent("cobranca_sessao_1", nome, p.numero_pack, p.total_sessoes, valor);
            if (await sendOne(p, "cobranca_sessao_1", c, true)) results.cobranca_sent.cobranca_sessao_1++;
          }
          if (counts.realizadas >= 3) {
            const c = cobrancaContent("cobranca_sessao_3", nome, p.numero_pack, p.total_sessoes, valor);
            if (await sendOne(p, "cobranca_sessao_3", c, true)) {
              results.cobranca_sent.cobranca_sessao_3++;
              await insertInternalNotification(
                p,
                "Pack por regularizar",
                `${nome} · Pack ${p.numero_pack} · ${counts.realizadas} sessões realizadas · ${valorFmt} em falta`,
              );
            }
          }
          if (counts.realizadas >= 5) {
            const c = cobrancaContent("cobranca_sessao_5", nome, p.numero_pack, p.total_sessoes, valor);
            if (await sendOne(p, "cobranca_sessao_5", c, true)) {
              results.cobranca_sent.cobranca_sessao_5++;
              await insertInternalNotification(
                p,
                "Pack por regularizar",
                `${nome} · Pack ${p.numero_pack} · ${counts.realizadas} sessões realizadas · ${valorFmt} em falta`,
              );
            }
          }
        }

        // ============= RENOVAÇÃO =============
        if (auto.renovacao) {
          if (p.payment_status === "pago") {
            if (disponiveis === 2) {
              const c = renovacaoContent("renovacao_faltam_2", nome, p.numero_pack);
              if (await sendOne(p, "renovacao_faltam_2", c, false)) results.renovacao_sent.renovacao_faltam_2++;
            } else if (disponiveis === 1) {
              const c = renovacaoContent("renovacao_falta_1", nome, p.numero_pack);
              if (await sendOne(p, "renovacao_falta_1", c, false)) results.renovacao_sent.renovacao_falta_1++;
            } else if (disponiveis === 0) {
              const c = renovacaoContent("renovacao_esgotado", nome, p.numero_pack);
              if (await sendOne(p, "renovacao_esgotado", c, false)) results.renovacao_sent.renovacao_esgotado++;
            }
          } else {
            // Pack por pagar terminou: apenas notificação interna (uma vez, via dedup)
            if (disponiveis === 0) {
              const { data: existing } = await supabase
                .from("pack_reminder_logs")
                .select("id")
                .eq("pack_id", p.id)
                .eq("canal", "renovacao_esgotado_pendente")
                .maybeSingle();
              if (!existing) {
                await insertInternalNotification(
                  p,
                  "Pack terminado por regularizar",
                  `${nome} · Pack ${p.numero_pack} concluído · ${valorFmt} continua por regularizar`,
                );
                if (!dryRun) {
                  await supabase.from("pack_reminder_logs").insert({
                    pack_id: p.id,
                    canal: "renovacao_esgotado_pendente",
                  });
                }
              }
            }
          }
        }
      } catch (e: any) {
        results.errors.push(`pack=${(pack as any).id}: ${e?.message ?? e}`);
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
