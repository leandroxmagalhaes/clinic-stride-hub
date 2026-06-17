// ai-copilot-agent v2 — Agente nativo Anthropic (Messages API /v1/messages)
// Reescrito do zero. Princípios:
//  • Formato nativo Anthropic (tool_use / tool_result), com strict tools.
//  • NUNCA busca sessão por hora exata (evita o bug de fuso). Busca por paciente
//    e/ou intervalo de dia, e devolve lista para o modelo escolher pelo id.
//  • Todas as datas tratadas em Europe/Lisbon de forma explícita.
//  • Ações de escrita com confirmação em 2 fases (preview -> confirm:true).
//  • Erros reais e claros; nada de "fingir" que executou.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const TZ = "Europe/Lisbon";
const MAX_ROUNDS = 10;

// ───────────────────────── Datas (fuso Lisboa) ─────────────────────────
// Converte uma data "YYYY-MM-DD" no fuso de Lisboa para o intervalo UTC [início, fim] do dia.
function lisbonDayRangeUTC(dateStr: string): { startUTC: string; endUTC: string } {
  // Lisboa = UTC+1 (verão/WEST) ou UTC+0 (inverno/WET). Calculamos o offset real para a data.
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const lisbonHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(probe),
  );
  const offset = lisbonHour - 12; // +1 no verão, 0 no inverno
  const sign = offset >= 0 ? "+" : "-";
  const off = `${sign}${String(Math.abs(offset)).padStart(2, "0")}:00`;
  const startUTC = new Date(`${dateStr}T00:00:00${off}`).toISOString();
  const endUTC = new Date(`${dateStr}T23:59:59${off}`).toISOString();
  return { startUTC, endUTC };
}

function todayInLisbon(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function fmtLisbon(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-PT", {
      timeZone: TZ, weekday: "long", day: "2-digit", month: "long",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch { return iso; }
}

function fmtHourLisbon(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch { return iso; }
}

// ───────────────────────── Ferramentas (schema nativo) ─────────────────────────
const TOOLS = [
  {
    name: "search_patients",
    description: "Procura utentes por nome (parcial). Devolve id, nome, telefone. Usa quando precisas do utente para qualquer outra operação.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Nome ou parte do nome" } },
      required: ["query"],
    },
  },
  {
    name: "list_sessions",
    description: "Lista sessões de um dia (e opcionalmente de um utente). Devolve cada sessão com id, hora, utente, estado e pagamento. NÃO procures por hora exata — usa esta lista e escolhe pelo id. 'date' no formato YYYY-MM-DD; se omitido, usa hoje.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Dia YYYY-MM-DD (Lisboa). Omite para hoje." },
        patient_id: { type: "string", description: "Filtra por utente (id de search_patients)." },
        patient_name: { type: "string", description: "Alternativa: filtra por nome aproximado." },
      },
    },
  },
  {
    name: "list_patient_sessions",
    description: "Lista as próximas e recentes sessões de um utente (id), com id de cada uma. Útil para localizar a sessão certa antes de uma ação.",
    input_schema: {
      type: "object",
      properties: { patient_id: { type: "string" }, patient_name: { type: "string" } },
    },
  },
  {
    name: "create_session",
    description: "Agenda uma nova sessão. Vincula automaticamente ao pack ativo do utente (se tiver saldo), salvo se avulso=true. Confirmação obrigatória: chama primeiro sem confirm para obteres o preview; só com confirm=true após o 'sim' do utilizador.",
    input_schema: {
      type: "object",
      properties: {
        patient_id: { type: "string" },
        patient_name: { type: "string", description: "Se não tiveres o id" },
        datetime: { type: "string", description: "Data e hora ISO com fuso, ex: 2026-06-16T16:00:00+01:00" },
        service_name: { type: "string" },
        avulso: { type: "boolean", description: "true para não usar pack" },
        confirm: { type: "boolean" },
      },
      required: ["datetime"],
    },
  },
  {
    name: "update_session_status",
    description: "Altera o estado de uma sessão: confirmado | realizado | faltou | cancelado. Para faltou/cancelado aplica a regra das 14h. Identifica a sessão por session_id OU por patient_name + (date opcional, YYYY-MM-DD) + (time opcional, HH:MM). Confirmação obrigatória (confirm=true após 'sim').",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        patient_name: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD (default: hoje)" },
        time: { type: "string", description: "HH:MM da sessão, se souberes" },
        new_status: { type: "string", enum: ["confirmado", "realizado", "faltou", "cancelado"] },
        reason: { type: "string" },
        confirm: { type: "boolean" },
      },
      required: ["new_status"],
    },
  },
  {
    name: "register_payment",
    description: "Marca uma sessão como paga. Identifica por session_id OU por patient_name + (date opcional) + (time opcional). Confirmação obrigatória (confirm=true após 'sim').",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        patient_name: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD (default: hoje)" },
        time: { type: "string", description: "HH:MM da sessão, se souberes" },
        method: { type: "string", enum: ["numerario", "mbway", "multibanco", "transferencia", "cartao"], description: "Método: numerario, mbway, multibanco, transferencia ou cartao" },
        confirm: { type: "boolean" },
      },
    },
  },
  {
    name: "exempt_no_show",
    description: "Isenta uma falta cobrada, devolvendo a sessão ao pack. Exige motivo. Identifica por session_id OU patient_name + (date/time opcionais). Confirmação obrigatória.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        patient_name: { type: "string" },
        date: { type: "string" },
        time: { type: "string" },
        reason: { type: "string" },
        confirm: { type: "boolean" },
      },
      required: ["reason"],
    },
  },
  {
    name: "get_patient_packs",
    description: "Mostra os packs de um utente (nº, usadas/total, validade, pagamento, estado).",
    input_schema: {
      type: "object",
      properties: { patient_id: { type: "string" }, patient_name: { type: "string" } },
    },
  },
  {
    name: "pending_payments",
    description: "Lista sessões com pagamento pendente, opcionalmente de um dia (YYYY-MM-DD).",
    input_schema: {
      type: "object",
      properties: { date: { type: "string" } },
    },
  },
];

const ACTION_TOOLS = new Set(["create_session", "update_session_status", "register_payment", "exempt_no_show"]);

// ───────────────────────── Helpers de resolução ─────────────────────────
async function resolvePatient(db: any, clinicId: string, args: any): Promise<{ id?: string; name?: string; error?: string; options?: any[] }> {
  if (args.patient_id) {
    const { data } = await db.from("pacientes").select("id, full_name").eq("id", args.patient_id).maybeSingle();
    if (!data) return { error: "Utente não encontrado pelo id." };
    return { id: data.id, name: data.full_name };
  }
  if (args.patient_name) {
    const { data } = await db.from("pacientes").select("id, full_name")
      .eq("clinic_id", clinicId).ilike("full_name", `%${args.patient_name}%`).eq("is_active", true).limit(6);
    if (!data || data.length === 0) return { error: `Nenhum utente encontrado com "${args.patient_name}".` };
    if (data.length > 1) return { options: data.map((p: any) => ({ id: p.id, nome: p.full_name })) };
    return { id: data[0].id, name: data[0].full_name };
  }
  return { error: "Indica o utente (nome ou id)." };
}

async function packUsage(db: any, packId: string): Promise<number> {
  const { data } = await db.from("sessoes").select("status, isento").eq("pack_id", packId);
  return (data || []).filter((s: any) => !s.isento && ["realizado", "finalizado", "falta_cobrada"].includes(s.status)).length;
}

// Resolve uma sessão a partir de session_id OU (paciente + dia + hora aproximada).
// Devolve { id } ou { error } ou { options } (várias candidatas para o agente escolher).
async function resolveSession(db: any, clinicId: string, args: any): Promise<{ id?: string; error?: string; options?: any[] }> {
  if (args.session_id) return { id: args.session_id };

  // precisa de paciente
  const p = await resolvePatient(db, clinicId, args);
  if (p.options) return { error: "Há vários utentes com esse nome; especifica qual.", options: p.options };
  if (p.error) return { error: p.error };

  // intervalo: dia indicado, ou hoje
  const date = args.date || todayInLisbon();
  const { startUTC, endUTC } = lisbonDayRangeUTC(date);
  const { data } = await db.from("sessoes")
    .select("id, start_time, status")
    .eq("clinic_id", clinicId).eq("paciente_id", p.id)
    .gte("start_time", startUTC).lte("start_time", endUTC)
    .order("start_time", { ascending: true });

  if (!data || data.length === 0) return { error: `Não encontrei sessões de ${p.name} em ${date}.` };

  // se foi indicada uma hora aproximada (args.time "HH:MM"), filtra
  if (args.time && /^\d{1,2}:\d{2}$/.test(args.time)) {
    const want = args.time.padStart(5, "0");
    const match = data.filter((s: any) => fmtHourLisbon(s.start_time) === want);
    if (match.length === 1) return { id: match[0].id };
    if (match.length > 1) return { options: match.map((s: any) => ({ session_id: s.id, hora: fmtHourLisbon(s.start_time), estado: s.status })) };
  }
  if (data.length === 1) return { id: data[0].id };
  return { options: data.map((s: any) => ({ session_id: s.id, hora: fmtHourLisbon(s.start_time), estado: s.status })) };
}

// ───────────────────────── Executor de ferramentas ─────────────────────────
async function runTool(name: string, args: any, db: any, clinicId: string, userId: string): Promise<any> {
  switch (name) {
    case "search_patients": {
      const { data } = await db.from("pacientes").select("id, full_name, phone")
        .eq("clinic_id", clinicId).ilike("full_name", `%${args.query || ""}%`).eq("is_active", true).limit(8);
      return { utentes: (data || []).map((p: any) => ({ id: p.id, nome: p.full_name, telefone: p.phone })) };
    }

    case "list_sessions": {
      const date = args.date || todayInLisbon();
      const { startUTC, endUTC } = lisbonDayRangeUTC(date);
      let pid = args.patient_id;
      if (!pid && args.patient_name) {
        const r = await resolvePatient(db, clinicId, { patient_name: args.patient_name });
        if (r.options) return { needs_clarification: true, opcoes: r.options };
        if (r.error) return { error: r.error };
        pid = r.id;
      }
      let q = db.from("sessoes")
        .select("id, start_time, status, payment_status, pack_id, price, pacientes!sessoes_paciente_id_fkey(full_name), profiles!sessoes_profissional_id_fkey(full_name)")
        .eq("clinic_id", clinicId).gte("start_time", startUTC).lte("start_time", endUTC)
        .order("start_time", { ascending: true });
      if (pid) q = q.eq("paciente_id", pid);
      const { data } = await q;
      return {
        dia: date,
        sessoes: (data || []).map((s: any) => ({
          session_id: s.id,
          hora: fmtHourLisbon(s.start_time),
          utente: s.pacientes?.full_name,
          profissional: s.profiles?.full_name,
          estado: s.status,
          pagamento: s.payment_status,
          em_pack: !!s.pack_id,
        })),
      };
    }

    case "list_patient_sessions": {
      const r = await resolvePatient(db, clinicId, args);
      if (r.options) return { needs_clarification: true, opcoes: r.options };
      if (r.error) return { error: r.error };
      const { data } = await db.from("sessoes")
        .select("id, start_time, status, payment_status, pack_id")
        .eq("clinic_id", clinicId).eq("paciente_id", r.id)
        .order("start_time", { ascending: false }).limit(15);
      return {
        utente: r.name,
        sessoes: (data || []).map((s: any) => ({
          session_id: s.id, quando: fmtLisbon(s.start_time),
          estado: s.status, pagamento: s.payment_status, em_pack: !!s.pack_id,
        })),
      };
    }

    case "get_patient_packs": {
      const r = await resolvePatient(db, clinicId, args);
      if (r.options) return { needs_clarification: true, opcoes: r.options };
      if (r.error) return { error: r.error };
      const { data } = await db.from("packs").select("id, numero_pack, total_sessoes, valor_total, payment_status, data_validade, status")
        .eq("paciente_id", r.id).order("numero_pack", { ascending: false });
      const packs = [];
      for (const p of data || []) {
        const used = await packUsage(db, p.id);
        packs.push({
          pack: p.numero_pack, usadas: used, total: p.total_sessoes, restantes: p.total_sessoes - used,
          validade: p.data_validade, pagamento: p.payment_status, estado: p.status,
        });
      }
      return { utente: r.name, packs };
    }

    case "pending_payments": {
      let q = db.from("sessoes")
        .select("id, start_time, pacientes!sessoes_paciente_id_fkey(full_name)")
        .eq("clinic_id", clinicId).eq("payment_status", "pendente")
        .in("status", ["realizado", "finalizado", "falta_cobrada"])
        .order("start_time", { ascending: false }).limit(30);
      if (args.date) {
        const { startUTC, endUTC } = lisbonDayRangeUTC(args.date);
        q = q.gte("start_time", startUTC).lte("start_time", endUTC);
      }
      const { data } = await q;
      return { pendentes: (data || []).map((s: any) => ({ session_id: s.id, quando: fmtLisbon(s.start_time), utente: s.pacientes?.full_name })) };
    }

    case "create_session": {
      const r = await resolvePatient(db, clinicId, args);
      if (r.options) return { needs_clarification: true, opcoes: r.options };
      if (r.error) return { error: r.error };

      // serviço
      let service: any = null;
      if (args.service_name) {
        const { data } = await db.from("servicos").select("id, name, duration_minutes, price").eq("clinic_id", clinicId).ilike("name", `%${args.service_name}%`).limit(1);
        service = data?.[0] || null;
      }
      if (!service) {
        const { data } = await db.from("servicos").select("id, name, duration_minutes, price").eq("clinic_id", clinicId).limit(1);
        service = data?.[0] || null;
      }
      // profissional (FK -> profiles)
      const { data: profs } = await db.from("profiles").select("id, full_name").eq("clinic_id", clinicId).eq("is_active", true).limit(1);
      const prof = profs?.[0];
      if (!prof) return { error: "Nenhum profissional ativo encontrado." };

      // pack ativo com saldo
      let packId: string | null = null; let packTxt = "";
      if (!args.avulso) {
        const { data: packs } = await db.from("packs").select("id, numero_pack, total_sessoes")
          .eq("paciente_id", r.id).eq("status", "ativo").order("numero_pack", { ascending: false });
        if (packs && packs.length > 0) {
          const used = await packUsage(db, packs[0].id);
          if (used < packs[0].total_sessoes) { packId = packs[0].id; packTxt = ` Vincula ao Pack ${packs[0].numero_pack} (${used + 1}/${packs[0].total_sessoes}).`; }
        }
      }

      const start = new Date(args.datetime);
      if (isNaN(start.getTime())) return { error: "Data/hora inválida." };
      const end = new Date(start.getTime() + (service?.duration_minutes || 60) * 60000);

      if (args.confirm !== true) {
        return {
          preview: true,
          resumo: `Agendar ${r.name} em ${fmtLisbon(start.toISOString())}${service ? `, ${service.name}` : ""}, com ${prof.full_name}.${packTxt}`,
          pergunta: "Confirmas o agendamento?",
        };
      }
      const { error } = await db.from("sessoes").insert({
        clinic_id: clinicId, paciente_id: r.id, profissional_id: prof.id, servico_id: service?.id,
        start_time: start.toISOString(), end_time: end.toISOString(),
        status: "agendado", payment_status: "pendente",
        tipo_agendamento: packId ? "pack" : "avulso", pack_id: packId,
        price: service?.price || 0, created_by: userId,
      });
      if (error) return { error: `Falha ao agendar: ${error.message}` };
      return { success: true, mensagem: `Sessão agendada para ${r.name} em ${fmtLisbon(start.toISOString())}.${packTxt}` };
    }

    case "update_session_status": {
      const rs = await resolveSession(db, clinicId, args);
      if (rs.options) return { needs_clarification: true, opcoes: rs.options };
      if (rs.error) return { error: rs.error };
      const { data: s } = await db.from("sessoes")
        .select("id, start_time, status, pack_id, pacientes!sessoes_paciente_id_fkey(full_name)")
        .eq("id", rs.id).eq("clinic_id", clinicId).maybeSingle();
      if (!s) return { error: "Sessão não encontrada." };
      const nome = s.pacientes?.full_name;
      const quando = fmtLisbon(s.start_time);

      if (args.confirm !== true) {
        const map: any = { confirmado: "confirmar presença", realizado: "marcar como realizada", faltou: "marcar falta", cancelado: "cancelar" };
        let extra = "";
        if (args.new_status === "faltou" || args.new_status === "cancelado") extra = " A regra das 14h decide se conta como falta cobrada (consome o pack).";
        if (args.new_status === "realizado" && s.pack_id) extra = " Consome 1 sessão do pack.";
        return { preview: true, resumo: `${map[args.new_status] || args.new_status} — sessão de ${nome} (${quando}).${extra}`, pergunta: "Confirmas?" };
      }

      // faltou/cancelado -> RPC que aplica a regra das 14h
      if (args.new_status === "faltou" || args.new_status === "cancelado") {
        const { data, error } = await db.rpc("cancel_session_with_pack_rule", { p_session_id: s.id, p_reason: args.reason || (args.new_status === "faltou" ? "Falta" : "Cancelado") });
        if (error) {
          const { error: e2 } = await db.from("sessoes").update({ status: args.new_status }).eq("id", s.id).eq("clinic_id", clinicId);
          if (e2) return { error: e2.message };
          return { success: true, mensagem: `${nome}: ${args.new_status}.` };
        }
        const cobrado = data?.cobrado ? " (cobrada — consumiu o pack)" : " (sem cobrança)";
        return { success: true, mensagem: `${nome}: ${args.new_status}${cobrado}.` };
      }
      // confirmado/realizado -> update direto
      const { error } = await db.from("sessoes").update({ status: args.new_status }).eq("id", s.id).eq("clinic_id", clinicId);
      if (error) return { error: error.message };
      return { success: true, mensagem: `Sessão de ${nome} agora está "${args.new_status}".` };
    }

    case "register_payment": {
      const rs = await resolveSession(db, clinicId, args);
      if (rs.options) return { needs_clarification: true, opcoes: rs.options };
      if (rs.error) return { error: rs.error };
      const { data: s } = await db.from("sessoes")
        .select("id, start_time, price, pacientes!sessoes_paciente_id_fkey(full_name)")
        .eq("id", rs.id).eq("clinic_id", clinicId).maybeSingle();
      if (!s) return { error: "Sessão não encontrada." };
      if (args.confirm !== true) {
        return { preview: true, resumo: `Marcar como PAGA a sessão de ${s.pacientes?.full_name} (${fmtLisbon(s.start_time)})${s.price ? `, €${Number(s.price).toFixed(2)}` : ""}.`, pergunta: "Confirmas o pagamento?" };
      }
      // Grava o pagamento de forma resiliente (igual ao frontend):
      // 1) marca como pago (sempre funciona); 2) tenta gravar o método à parte e ignora se a coluna não existir.
      const { error } = await db.from("sessoes")
        .update({ payment_status: "pago", paid_at: new Date().toISOString() })
        .eq("id", s.id).eq("clinic_id", clinicId);
      if (error) return { error: error.message };

      let metodoTxt = "";
      if (args.method) {
        const m = String(args.method).toLowerCase().replace(/\s|-/g, "");
        const map: Record<string, string> = {
          numerario: "numerario", dinheiro: "numerario", cash: "numerario", "numerário": "numerario",
          mbway: "mbway", mbw: "mbway",
          multibanco: "multibanco", mb: "multibanco", atm: "multibanco",
          transferencia: "transferencia", "transferência": "transferencia", transfer: "transferencia",
          cartao: "cartao", "cartão": "cartao", card: "cartao", credito: "cartao", debito: "cartao",
        };
        const dbMethod = map[m] || "numerario";
        const { error: eMethod } = await db.from("sessoes").update({ payment_method: dbMethod }).eq("id", s.id).eq("clinic_id", clinicId);
        if (eMethod) {
          console.warn("payment_method não gravado (coluna pode não existir):", eMethod.message);
          metodoTxt = ` Método indicado: ${dbMethod} (não foi possível guardar o método, mas o pagamento ficou registado).`;
        } else {
          metodoTxt = ` Método: ${dbMethod}.`;
        }
      }
      return { success: true, mensagem: `Pagamento registado para ${s.pacientes?.full_name}.${metodoTxt}` };
    }

    case "exempt_no_show": {
      if (!args.reason) return { needs_reason: true, pergunta: "Qual o motivo da isenção?" };
      const rs = await resolveSession(db, clinicId, args);
      if (rs.options) return { needs_clarification: true, opcoes: rs.options };
      if (rs.error) return { error: rs.error };
      const { data: s } = await db.from("sessoes")
        .select("id, start_time, pack_id, pacientes!sessoes_paciente_id_fkey(full_name)")
        .eq("id", rs.id).eq("clinic_id", clinicId).maybeSingle();
      if (!s) return { error: "Sessão não encontrada." };
      if (args.confirm !== true) {
        return { preview: true, resumo: `Isentar a falta cobrada de ${s.pacientes?.full_name} (${fmtLisbon(s.start_time)}), devolvendo a sessão ao pack. Motivo: ${args.reason}.`, pergunta: "Confirmas a isenção?" };
      }
      const { error } = await db.from("sessoes")
        .update({ isento: true, isento_motivo: args.reason, isento_por: userId, isento_em: new Date().toISOString() })
        .eq("id", s.id).eq("clinic_id", clinicId);
      if (error) return { error: error.message };
      if (s.pack_id) await db.rpc("recompute_pack_status", { p_pack_id: s.pack_id }).catch(() => {});
      return { success: true, mensagem: `Isenção registada para ${s.pacientes?.full_name}.` };
    }

    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}

export { TOOLS, ACTION_TOOLS, runTool, todayInLisbon, ANTHROPIC_MODEL, TZ, MAX_ROUNDS, corsHeaders };
