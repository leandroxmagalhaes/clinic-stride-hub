// copilot-actions.ts — Fase 4: ações de escrita do Copiloto
// Padrão de segurança: TODA ação exige confirmação explícita.
// O agente primeiro chama a tool com {confirm:false} (ou sem confirm) → recebe um
// "preview" com os dados que serão alterados → mostra ao utilizador e pede confirmação.
// Só quando o utilizador confirma é que o agente chama de novo com {confirm:true} → executa.

export interface ActionContext {
  supabaseAdmin: any;
  clinicId: string;
  userId: string;
}

const VALID_SESSION_STATUS = [
  "agendado", "confirmado", "em_atendimento", "finalizado",
  "realizado", "cancelado", "faltou", "falta", "falta_cobrada",
];

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-PT", {
      weekday: "long", day: "2-digit", month: "long",
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon",
    });
  } catch { return iso; }
}

// Resolve uma sessão a partir de id direto OU (nome do paciente + data aproximada)
async function resolveSession(
  ctx: ActionContext,
  args: { session_id?: string; patient_name?: string; date?: string },
): Promise<{ session?: any; error?: string; ambiguous?: any[] }> {
  const { supabaseAdmin, clinicId } = ctx;

  if (args.session_id) {
    const { data } = await supabaseAdmin
      .from("sessoes")
      .select("id, start_time, end_time, status, payment_status, pack_id, price, paciente_id, profissional_id, pacientes!sessoes_paciente_id_fkey(full_name), profissionais(full_name)")
      .eq("id", args.session_id)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (!data) return { error: "Sessão não encontrada." };
    return { session: data };
  }

  if (!args.patient_name) return { error: "Indique a sessão (por id ou nome do utente + data)." };

  // Buscar paciente
  const { data: patients } = await supabaseAdmin
    .from("pacientes")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .ilike("full_name", `%${args.patient_name}%`)
    .eq("is_active", true)
    .limit(5);
  if (!patients || patients.length === 0) return { error: `Nenhum utente encontrado com "${args.patient_name}".` };
  if (patients.length > 1) {
    return { ambiguous: patients.map((p: any) => ({ id: p.id, full_name: p.full_name })) };
  }

  // Buscar sessões desse paciente (na data, ou as próximas)
  let q = supabaseAdmin
    .from("sessoes")
    .select("id, start_time, end_time, status, payment_status, pack_id, price, paciente_id, profissional_id, pacientes!sessoes_paciente_id_fkey(full_name), profissionais(full_name)")
    .eq("clinic_id", clinicId)
    .eq("paciente_id", patients[0].id)
    .order("start_time", { ascending: true });

  if (args.date) {
    q = q.gte("start_time", `${args.date}T00:00:00`).lte("start_time", `${args.date}T23:59:59`);
  } else {
    q = q.gte("start_time", new Date().toISOString());
  }
  const { data: sessions } = await q.limit(5);
  if (!sessions || sessions.length === 0) {
    return { error: `Nenhuma sessão encontrada para ${patients[0].full_name}${args.date ? " nessa data" : " futura"}.` };
  }
  if (sessions.length > 1) {
    return {
      ambiguous: sessions.map((s: any) => ({
        id: s.id,
        descricao: `${fmtDateTime(s.start_time)} (${s.status})`,
      })),
    };
  }
  return { session: sessions[0] };
}

// ── Ações ────────────────────────────────────────────────────────────────

export async function executeAction(
  toolName: string,
  args: Record<string, any>,
  ctx: ActionContext,
): Promise<string> {
  const { supabaseAdmin, clinicId, userId } = ctx;
  const confirm = args.confirm === true;

  switch (toolName) {

    // ── Confirmar presença / status ──
    case "confirm_session": {
      const r = await resolveSession(ctx, args);
      if (r.error) return JSON.stringify({ error: r.error });
      if (r.ambiguous) return JSON.stringify({ needs_clarification: true, options: r.ambiguous });
      const s = r.session;
      if (!confirm) {
        return JSON.stringify({
          preview: true,
          action: "confirmar presença",
          session_id: s.id,
          resumo: `Marcar como CONFIRMADA a sessão de ${s.pacientes?.full_name} em ${fmtDateTime(s.start_time)}.`,
          ask: "Confirmas esta alteração?",
        });
      }
      const { error } = await supabaseAdmin
        .from("sessoes").update({ status: "confirmado" }).eq("id", s.id).eq("clinic_id", clinicId);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `Sessão de ${s.pacientes?.full_name} confirmada.` });
    }

    // ── Marcar realizada ──
    case "mark_session_done": {
      const r = await resolveSession(ctx, args);
      if (r.error) return JSON.stringify({ error: r.error });
      if (r.ambiguous) return JSON.stringify({ needs_clarification: true, options: r.ambiguous });
      const s = r.session;
      if (!confirm) {
        return JSON.stringify({
          preview: true, action: "marcar realizada", session_id: s.id,
          resumo: `Marcar como REALIZADA a sessão de ${s.pacientes?.full_name} em ${fmtDateTime(s.start_time)}.${s.pack_id ? " Consome 1 sessão do pack." : ""}`,
          ask: "Confirmas?",
        });
      }
      const { error } = await supabaseAdmin
        .from("sessoes").update({ status: "realizado" }).eq("id", s.id).eq("clinic_id", clinicId);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `Sessão de ${s.pacientes?.full_name} marcada como realizada.` });
    }

    // ── Marcar falta (usa a RPC que aplica a regra das 14h) ──
    case "mark_no_show": {
      const r = await resolveSession(ctx, args);
      if (r.error) return JSON.stringify({ error: r.error });
      if (r.ambiguous) return JSON.stringify({ needs_clarification: true, options: r.ambiguous });
      const s = r.session;
      if (!confirm) {
        return JSON.stringify({
          preview: true, action: "marcar falta", session_id: s.id,
          resumo: `Marcar FALTA na sessão de ${s.pacientes?.full_name} em ${fmtDateTime(s.start_time)}. A regra das 14h decide se é cobrada (consome o pack) ou não.`,
          ask: "Confirmas? (podes isentar depois, se for o caso)",
        });
      }
      // Usa a RPC da Fase 2 que aplica a regra do horário-limite e decide o status
      const { data, error } = await supabaseAdmin.rpc("cancel_session_with_pack_rule", {
        p_session_id: s.id, p_reason: (args.reason as string) || "Falta",
      });
      if (error) {
        // fallback: marca faltou direto
        const { error: e2 } = await supabaseAdmin
          .from("sessoes").update({ status: "faltou" }).eq("id", s.id).eq("clinic_id", clinicId);
        if (e2) return JSON.stringify({ error: e2.message });
        return JSON.stringify({ success: true, message: `Falta registada para ${s.pacientes?.full_name}.` });
      }
      const cobrado = data?.cobrado ? " (cobrada — consumiu o pack)" : " (não cobrada)";
      return JSON.stringify({ success: true, message: `Falta registada para ${s.pacientes?.full_name}${cobrado}.`, detail: data || null });
    }

    // ── Cancelar (regra das 14h via RPC) ──
    case "cancel_session": {
      const r = await resolveSession(ctx, args);
      if (r.error) return JSON.stringify({ error: r.error });
      if (r.ambiguous) return JSON.stringify({ needs_clarification: true, options: r.ambiguous });
      const s = r.session;
      if (!confirm) {
        return JSON.stringify({
          preview: true, action: "cancelar sessão", session_id: s.id,
          resumo: `Cancelar a sessão de ${s.pacientes?.full_name} em ${fmtDateTime(s.start_time)}. Se for após as 14h do dia anterior, conta como falta cobrada.`,
          ask: "Confirmas o cancelamento?",
        });
      }
      const { data, error } = await supabaseAdmin.rpc("cancel_session_with_pack_rule", {
        p_session_id: s.id, p_reason: (args.reason as string) || "Cancelado via Copiloto",
      });
      if (error) return JSON.stringify({ error: error.message });
      const msg = data?.cobrado
        ? `Sessão de ${s.pacientes?.full_name} cancelada após o prazo — contou como falta cobrada (consumiu o pack).`
        : `Sessão de ${s.pacientes?.full_name} cancelada (dentro do prazo, sem cobrança).`;
      return JSON.stringify({ success: true, message: msg, detail: data || null });
    }

    // ── Registar pagamento ──
    case "register_payment": {
      const r = await resolveSession(ctx, args);
      if (r.error) return JSON.stringify({ error: r.error });
      if (r.ambiguous) return JSON.stringify({ needs_clarification: true, options: r.ambiguous });
      const s = r.session;
      if (!confirm) {
        return JSON.stringify({
          preview: true, action: "registar pagamento", session_id: s.id,
          resumo: `Marcar como PAGA a sessão de ${s.pacientes?.full_name} em ${fmtDateTime(s.start_time)}${s.price ? ` (€${Number(s.price).toFixed(2)})` : ""}.`,
          ask: "Confirmas o pagamento?",
        });
      }
      const { error } = await supabaseAdmin
        .from("sessoes")
        .update({ payment_status: "pago", paid_at: new Date().toISOString() })
        .eq("id", s.id).eq("clinic_id", clinicId);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `Pagamento registado para ${s.pacientes?.full_name}.` });
    }

    // ── Isentar falta cobrada (devolve a sessão ao saldo do pack) ──
    case "exempt_charged_no_show": {
      const r = await resolveSession(ctx, args);
      if (r.error) return JSON.stringify({ error: r.error });
      if (r.ambiguous) return JSON.stringify({ needs_clarification: true, options: r.ambiguous });
      const s = r.session;
      const motivo = (args.reason as string) || "";
      if (!confirm || !motivo) {
        return JSON.stringify({
          preview: true, action: "isentar falta cobrada", session_id: s.id,
          resumo: `Isentar a falta cobrada de ${s.pacientes?.full_name} (${fmtDateTime(s.start_time)}), devolvendo a sessão ao pack.`,
          ask: motivo ? "Confirmas a isenção?" : "Qual o motivo da isenção?",
          needs_reason: !motivo,
        });
      }
      // A RPC usa auth.uid() (nulo sob service-role); fazemos o update direto para registar quem isentou
      const { error } = await supabaseAdmin
        .from("sessoes")
        .update({ isento: true, isento_motivo: motivo, isento_por: userId, isento_em: new Date().toISOString() })
        .eq("id", s.id).eq("clinic_id", clinicId);
      if (error) return JSON.stringify({ error: error.message });
      // Recalcular o saldo do pack (o trigger reage ao UPDATE, mas garantimos)
      if (s.pack_id) {
        await supabaseAdmin.rpc("recompute_pack_status", { p_pack_id: s.pack_id }).catch(() => {});
      }
      return JSON.stringify({ success: true, message: `Isenção registada para ${s.pacientes?.full_name}. Sessão devolvida ao pack.` });
    }

    // ── Criar sessão (agendar) ──
    case "create_session": {
      const patientName = args.patient_name as string;
      const dateTime = args.datetime as string; // ISO
      const serviceName = args.service_name as string | undefined;
      if (!patientName || !dateTime) return JSON.stringify({ error: "Preciso do nome do utente e da data/hora." });

      const { data: patients } = await supabaseAdmin
        .from("pacientes").select("id, full_name").eq("clinic_id", clinicId)
        .ilike("full_name", `%${patientName}%`).eq("is_active", true).limit(5);
      if (!patients || patients.length === 0) return JSON.stringify({ error: `Utente "${patientName}" não encontrado.` });
      if (patients.length > 1) return JSON.stringify({ needs_clarification: true, options: patients.map((p: any) => ({ id: p.id, full_name: p.full_name })) });
      const patient = patients[0];

      // Serviço
      let service: any = null;
      if (serviceName) {
        const { data: svcs } = await supabaseAdmin.from("servicos").select("id, name, duration_minutes, price").eq("clinic_id", clinicId).ilike("name", `%${serviceName}%`).limit(1);
        service = svcs?.[0] || null;
      }
      if (!service) {
        const { data: svcs } = await supabaseAdmin.from("servicos").select("id, name, duration_minutes, price").eq("clinic_id", clinicId).limit(1);
        service = svcs?.[0] || null;
      }

      // Profissional
      let profId = args.professional_id as string | undefined;
      let profName = "";
      if (!profId) {
        const { data: profs } = await supabaseAdmin.from("profissionais").select("id, full_name").eq("clinic_id", clinicId).eq("is_active", true).limit(1);
        profId = profs?.[0]?.id; profName = profs?.[0]?.full_name || "";
      }

      // Pack ativo com saldo
      const { data: packs } = await supabaseAdmin
        .from("packs").select("id, numero_pack, total_sessoes").eq("paciente_id", patient.id).eq("status", "ativo").order("numero_pack", { ascending: false });
      let packId: string | null = null; let packInfo = "";
      if (packs && packs.length > 0) {
        const { data: used } = await supabaseAdmin.from("sessoes").select("id, status, isento").eq("pack_id", packs[0].id);
        const consumed = (used || []).filter((x: any) => !x.isento && ["realizado", "finalizado", "falta_cobrada"].includes(x.status)).length;
        if (consumed < packs[0].total_sessoes) {
          packId = packs[0].id;
          packInfo = ` Vincula ao Pack ${packs[0].numero_pack} (${consumed + 1}/${packs[0].total_sessoes}).`;
        }
      }

      const start = new Date(dateTime);
      const end = new Date(start.getTime() + (service?.duration_minutes || 60) * 60000);

      if (!confirm) {
        return JSON.stringify({
          preview: true, action: "criar sessão",
          resumo: `Agendar ${patient.full_name} em ${fmtDateTime(start.toISOString())}${service ? `, ${service.name}` : ""}${profName ? `, com ${profName}` : ""}.${packInfo}`,
          ask: "Confirmas o agendamento?",
        });
      }
      const { error } = await supabaseAdmin.from("sessoes").insert({
        clinic_id: clinicId, paciente_id: patient.id, profissional_id: profId,
        servico_id: service?.id, start_time: start.toISOString(), end_time: end.toISOString(),
        status: "agendado", payment_status: "pendente",
        tipo_agendamento: packId ? "pack" : "avulso", pack_id: packId,
        price: service?.price || 0, created_by: userId,
      });
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `Sessão agendada para ${patient.full_name} em ${fmtDateTime(start.toISOString())}.${packInfo}` });
    }

    default:
      return JSON.stringify({ error: `Ação desconhecida: ${toolName}` });
  }
}

// Definições das tools de ação (formato OpenAI/Lovable gateway)
export const actionToolDefinitions = [
  {
    type: "function",
    function: {
      name: "confirm_session",
      description: "Confirma a presença/comparência numa sessão (status 'confirmado'). Requer confirmação do utilizador.",
      parameters: { type: "object", properties: {
        session_id: { type: "string" }, patient_name: { type: "string" }, date: { type: "string", description: "yyyy-MM-dd" },
        confirm: { type: "boolean", description: "true só depois do utilizador confirmar" },
      } },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_session_done",
      description: "Marca uma sessão como realizada (consome o pack, se houver). Requer confirmação.",
      parameters: { type: "object", properties: {
        session_id: { type: "string" }, patient_name: { type: "string" }, date: { type: "string" }, confirm: { type: "boolean" },
      } },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_no_show",
      description: "Marca falta numa sessão. Aplica a regra das 14h (cobra ou não). Requer confirmação.",
      parameters: { type: "object", properties: {
        session_id: { type: "string" }, patient_name: { type: "string" }, date: { type: "string" }, confirm: { type: "boolean" },
      } },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_session",
      description: "Cancela uma sessão. Após as 14h do dia anterior conta como falta cobrada. Requer confirmação.",
      parameters: { type: "object", properties: {
        session_id: { type: "string" }, patient_name: { type: "string" }, date: { type: "string" }, confirm: { type: "boolean" },
      } },
    },
  },
  {
    type: "function",
    function: {
      name: "register_payment",
      description: "Marca uma sessão como paga. Requer confirmação.",
      parameters: { type: "object", properties: {
        session_id: { type: "string" }, patient_name: { type: "string" }, date: { type: "string" }, confirm: { type: "boolean" },
      } },
    },
  },
  {
    type: "function",
    function: {
      name: "exempt_charged_no_show",
      description: "Isenta uma falta cobrada, devolvendo a sessão ao saldo do pack. Exige um motivo. Requer confirmação.",
      parameters: { type: "object", properties: {
        session_id: { type: "string" }, patient_name: { type: "string" }, date: { type: "string" },
        reason: { type: "string", description: "motivo da isenção" }, confirm: { type: "boolean" },
      } },
    },
  },
  {
    type: "function",
    function: {
      name: "create_session",
      description: "Agenda uma nova sessão. Vincula automaticamente ao pack ativo do utente, se houver saldo. Requer confirmação.",
      parameters: { type: "object", properties: {
        patient_name: { type: "string" }, datetime: { type: "string", description: "ISO 8601 com fuso, ex 2026-06-16T16:00:00+01:00" },
        service_name: { type: "string" }, professional_id: { type: "string" }, confirm: { type: "boolean" },
      }, required: ["patient_name", "datetime"] },
    },
  },
];

export const ACTION_TOOL_NAMES = actionToolDefinitions.map((t) => t.function.name);
