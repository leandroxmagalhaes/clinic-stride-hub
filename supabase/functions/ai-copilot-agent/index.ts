import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Tool definitions for function calling (READ-ONLY — Phase 1) ───────────
const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "search_patients",
      description: "Procura utentes por nome aproximado na clínica. Devolve id, nome, telefone e email.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Nome ou parte do nome do utente" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Verifica horários disponíveis para um profissional num determinado dia.",
      parameters: {
        type: "object",
        properties: {
          professional_id: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          min_time: { type: "string", description: "HH:MM (opcional)" },
        },
        required: ["date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_today_sessions",
      description: "Lista as sessões agendadas para hoje (do utilizador actual ou de toda a clínica conforme permissões).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sessions_by_date_range",
      description: "Lista sessões num intervalo de datas. Use para 'amanhã', 'esta semana', 'próximos dias'.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "YYYY-MM-DD" },
          end_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["start_date", "end_date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_evolutions",
      description: "Lista sessões realizadas que ainda não têm evolução clínica registada.",
      parameters: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_evolutions",
      description: "Últimas evoluções clínicas criadas (mais recentes primeiro).",
      parameters: { type: "object", properties: { limit: { type: "number", description: "default 10" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_payments",
      description: "Sessões com pagamento pendente.",
      parameters: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_expiring_packs",
      description: "Packs/pacotes que expiram nos próximos N dias.",
      parameters: { type: "object", properties: { days: { type: "number" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_daily_summary",
      description: "Resumo do dia: sessões, pendências, alertas.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inactive_patients",
      description: "Utentes sem sessão há mais de N dias.",
      parameters: { type: "object", properties: { days: { type: "number" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_unread_messages_summary",
      description: "Resumo das mensagens do diário de acompanhamento ainda não lidas (por utente).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_professional_patient_count",
      description: "Quantos utentes distintos um profissional acompanha (com base em sessões). Procura por nome.",
      parameters: {
        type: "object",
        properties: { professional_name: { type: "string" } },
        required: ["professional_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_active_patients",
      description: "Lista utentes activos da clínica (com sessão nos últimos N dias, default 30).",
      parameters: { type: "object", properties: { days: { type: "number" } }, additionalProperties: false },
    },
  },
];

// ── Fuzzy matching helpers ─────────────────────────────────────────────────
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function fuzzyScore(input: string, candidate: string): number {
  const a = normalizeText(input);
  const b = normalizeText(candidate);
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.85;
  const aTokens = a.split(/\s+/);
  const bTokens = b.split(/\s+/);
  let matched = 0;
  for (const t of aTokens) {
    if (bTokens.some((bt) => bt.includes(t) || t.includes(bt))) matched++;
  }
  return aTokens.length > 0 ? matched / Math.max(aTokens.length, bTokens.length) : 0;
}

// ── Excel/CSV parsing via SheetJS ──────────────────────────────────────────
async function parseSpreadsheet(base64: string, mimeType: string): Promise<Record<string, string>[]> {
  const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs");

  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  const workbook = XLSX.read(bytes, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows.slice(0, 500);
}

// ── Tool execution ─────────────────────────────────────────────────────────
interface UserScope {
  isAdmin: boolean;
  isProfessional: boolean;
  isSecretary: boolean;
  professionalProfileId: string | null;
}

function scopeSessions(query: any, scope: UserScope) {
  // Admin & secretary see all clinic data; professional (non-admin) sees only own
  if (scope.isProfessional && !scope.isAdmin && scope.professionalProfileId) {
    return query.eq("profissional_id", scope.professionalProfileId);
  }
  return query;
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  supabaseAdmin: any,
  clinicId: string,
  extraContext?: { fileUpload?: { name: string; base64: string; mime_type: string }; userId?: string; lovableApiKey?: string; scope?: UserScope }
): Promise<string> {
  const scope: UserScope = extraContext?.scope || { isAdmin: true, isProfessional: false, isSecretary: false, professionalProfileId: null };
  try {
    switch (toolName) {
      case "search_patients": {
        const q = (args.query as string) || "";
        const { data, error } = await supabaseAdmin
          .from("pacientes")
          .select("id, full_name, phone, email, is_active")
          .eq("clinic_id", clinicId)
          .ilike("full_name", `%${q}%`)
          .limit(10);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ patients: data || [] });
      }

      case "check_availability": {
        const date = args.date as string;
        const profId = args.professional_id as string | undefined;
        const minTime = args.min_time as string | undefined;
        const startOfDay = `${date}T00:00:00`;
        const endOfDay = `${date}T23:59:59`;
        let sessionsQuery = supabaseAdmin
          .from("sessoes")
          .select("start_time, end_time, profissional_id, status")
          .eq("clinic_id", clinicId)
          .gte("start_time", startOfDay)
          .lte("start_time", endOfDay)
          .not("status", "in", '("cancelado","falta")');
        if (profId) sessionsQuery = sessionsQuery.eq("profissional_id", profId);
        const { data: sessions } = await sessionsQuery;

        let professionals: Array<{ id: string; full_name: string }> = [];
        if (!profId) {
          const { data: profs } = await supabaseAdmin
            .from("profissionais")
            .select("id, full_name")
            .eq("clinic_id", clinicId)
            .eq("is_active", true);
          professionals = profs || [];
        } else {
          const { data: prof } = await supabaseAdmin
            .from("profissionais")
            .select("id, full_name")
            .eq("id", profId)
            .single();
          if (prof) professionals = [prof];
        }

        const slots: Array<{ time: string; professional_id: string; professional_name: string }> = [];
        for (const prof of professionals) {
          for (let h = 8; h < 20; h++) {
            for (const m of [0, 30]) {
              const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              if (minTime && time < minTime) continue;
              const slotStart = `${date}T${time}:00`;
              const slotEnd = new Date(new Date(slotStart).getTime() + 60 * 60000).toISOString();
              const conflict = (sessions || []).some(
        (s: any) =>
                  s.profissional_id === prof.id &&
                  new Date(s.start_time) < new Date(slotEnd) &&
                  new Date(s.end_time) > new Date(slotStart)
              );
              if (!conflict) {
                slots.push({ time, professional_id: prof.id, professional_name: prof.full_name });
              }
            }
          }
        }
        return JSON.stringify({ date, available_slots: slots.slice(0, 15) });
      }

      case "propose_session":
      case "create_session":
      case "cancel_session": {
        return JSON.stringify({
          error: "ACTION_NOT_AVAILABLE",
          message: "Nesta versão posso apenas consultar informação. Para criar, alterar ou cancelar sessões use a Agenda.",
        });
      }

      case "get_pending_evolutions": {
        if (scope.isSecretary && !scope.isAdmin && !scope.isProfessional) {
          return JSON.stringify({ error: "Acesso a evoluções clínicas não disponível para o seu perfil." });
        }
        const limit = (args.limit as number) || 10;
        let q = supabaseAdmin
          .from("sessoes")
          .select("id, start_time, paciente_id, pacientes!sessoes_paciente_id_fkey(full_name), profissional_id")
          .eq("clinic_id", clinicId)
          .eq("status", "realizado")
          .is("notes", null)
          .order("start_time", { ascending: false })
          .limit(limit);
        q = scopeSessions(q, scope);
        const { data } = await q;

        const sessionIds = (data || []).map((s: any) => s.id);
        if (sessionIds.length === 0) return JSON.stringify({ pending: [] });

        const { data: evolutions } = await supabaseAdmin
          .from("evolucoes_clinicas")
          .select("sessao_id")
          .in("sessao_id", sessionIds);
        const evolvedIds = new Set((evolutions || []).map((e: any) => e.sessao_id));
        const pending = (data || []).filter((s: any) => !evolvedIds.has(s.id)).map((s: any) => ({
          session_id: s.id,
          date: s.start_time,
          patient_name: (s as any).pacientes?.full_name || "N/A",
        }));
        return JSON.stringify({ pending });
      }

      case "get_pending_payments": {
        const limit = (args.limit as number) || 10;
        let q = supabaseAdmin
          .from("sessoes")
          .select("id, start_time, price, pacientes!sessoes_paciente_id_fkey(full_name)")
          .eq("clinic_id", clinicId)
          .eq("payment_status", "pendente")
          .eq("status", "realizado")
          .order("start_time", { ascending: false })
          .limit(limit);
        q = scopeSessions(q, scope);
        const { data } = await q;
        const pending = (data || []).map((s: any) => ({
          session_id: s.id,
          date: s.start_time,
          price: s.price,
          patient_name: (s as any).pacientes?.full_name || "N/A",
        }));
        return JSON.stringify({ pending_payments: pending });
      }

      case "get_expiring_packs": {
        const days = (args.days as number) || 7;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        const { data } = await supabaseAdmin
          .from("scheduling_packages")
          .select("id, total_sessions, sessions_created, end_date, pacientes!scheduling_packages_paciente_id_fkey(full_name)")
          .eq("clinic_id", clinicId)
          .eq("status", "ativo")
          .not("end_date", "is", null)
          .lte("end_date", futureDate.toISOString().split("T")[0])
          .order("end_date", { ascending: true });
        const packs = (data || []).map((p: any) => ({
          id: p.id,
          patient_name: (p as any).pacientes?.full_name || "N/A",
          total: p.total_sessions,
          used: p.sessions_created,
          remaining: p.total_sessions - p.sessions_created,
          end_date: p.end_date,
        }));
        return JSON.stringify({ expiring_packs: packs });
      }

      case "get_daily_summary": {
        const today = new Date().toISOString().split("T")[0];
        const startOfDay = `${today}T00:00:00`;
        const endOfDay = `${today}T23:59:59`;

        const [sessionsRes, pendingPayRes] = await Promise.all([
          supabaseAdmin
            .from("sessoes")
            .select("id, start_time, status, pacientes!sessoes_paciente_id_fkey(full_name)")
            .eq("clinic_id", clinicId)
            .gte("start_time", startOfDay)
            .lte("start_time", endOfDay)
            .order("start_time"),
          supabaseAdmin
            .from("sessoes")
            .select("id", { count: "exact" })
            .eq("clinic_id", clinicId)
            .eq("payment_status", "pendente")
            .eq("status", "realizado"),
        ]);

        const sessions = sessionsRes.data || [];
        const total = sessions.length;
        const confirmed = sessions.filter((s: any) => s.status === "agendado").length;
        const completed = sessions.filter((s: any) => s.status === "realizado").length;
        const cancelled = sessions.filter((s: any) => s.status === "cancelado" || s.status === "falta").length;

        return JSON.stringify({
          date: today,
          total_sessions: total,
          confirmed,
          completed,
          cancelled,
          pending_payments: pendingPayRes.count || 0,
          sessions: sessions.map((s: any) => ({
            time: s.start_time,
            patient: (s as any).pacientes?.full_name || "N/A",
            status: s.status,
          })),
        });
      }

      case "get_inactive_patients": {
        const days = (args.days as number) || 14;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const { data: patients } = await supabaseAdmin
          .from("pacientes")
          .select("id, full_name, phone, email")
          .eq("clinic_id", clinicId)
          .eq("is_active", true);

        if (!patients || patients.length === 0) return JSON.stringify({ inactive: [] });

        const patientIds = patients.map((p: any) => p.id);
        const { data: recentSessions } = await supabaseAdmin
          .from("sessoes")
          .select("paciente_id, start_time")
          .eq("clinic_id", clinicId)
          .in("paciente_id", patientIds)
          .gte("start_time", cutoff.toISOString())
          .not("status", "in", '("cancelado","falta")');

        const activePatientIds = new Set((recentSessions || []).map((s: any) => s.paciente_id));
        const inactive = patients
          .filter((p: any) => !activePatientIds.has(p.id))
          .slice(0, 20)
          .map((p: any) => ({ id: p.id, name: p.full_name, phone: p.phone, email: p.email }));

        return JSON.stringify({ inactive, days_threshold: days });
      }

      // ── New read-only tools ──────────────────────────────────────────────
      case "get_today_sessions": {
        const today = new Date().toISOString().split("T")[0];
        let q = supabaseAdmin
          .from("sessoes")
          .select("id, start_time, status, payment_status, profissional_id, pacientes!sessoes_paciente_id_fkey(full_name)")
          .eq("clinic_id", clinicId)
          .gte("start_time", `${today}T00:00:00`)
          .lte("start_time", `${today}T23:59:59`)
          .order("start_time");
        q = scopeSessions(q, scope);
        const { data } = await q;
        return JSON.stringify({
          date: today,
          total: (data || []).length,
          sessions: (data || []).map((s: any) => ({
            time: s.start_time,
            patient: s.pacientes?.full_name || "N/A",
            status: s.status,
            payment_status: s.payment_status,
          })),
        });
      }

      case "get_sessions_by_date_range": {
        const startDate = args.start_date as string;
        const endDate = args.end_date as string;
        let q = supabaseAdmin
          .from("sessoes")
          .select("id, start_time, status, profissional_id, pacientes!sessoes_paciente_id_fkey(full_name)")
          .eq("clinic_id", clinicId)
          .gte("start_time", `${startDate}T00:00:00`)
          .lte("start_time", `${endDate}T23:59:59`)
          .order("start_time")
          .limit(200);
        q = scopeSessions(q, scope);
        const { data } = await q;
        return JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          total: (data || []).length,
          sessions: (data || []).map((s: any) => ({
            datetime: s.start_time,
            patient: s.pacientes?.full_name || "N/A",
            status: s.status,
          })),
        });
      }

      case "get_recent_evolutions": {
        if (scope.isSecretary && !scope.isAdmin && !scope.isProfessional) {
          return JSON.stringify({ error: "Acesso a evoluções clínicas não disponível para o seu perfil." });
        }
        const limit = (args.limit as number) || 10;
        let q = supabaseAdmin
          .from("evolucoes_clinicas")
          .select("id, descricao, escala_dor, profissional_id, sessao_id, created_at, prontuario_id")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (scope.isProfessional && !scope.isAdmin && scope.professionalProfileId) {
          q = q.eq("profissional_id", scope.professionalProfileId);
        }
        const { data } = await q;
        return JSON.stringify({
          total: (data || []).length,
          evolutions: (data || []).map((e: any) => ({
            id: e.id,
            created_at: e.created_at,
            pain_scale: e.escala_dor,
            preview: (e.descricao || "").slice(0, 120),
          })),
        });
      }

      case "get_unread_messages_summary": {
        // Get patient ids in this clinic
        const { data: clinicPatients } = await supabaseAdmin
          .from("pacientes")
          .select("id, full_name")
          .eq("clinic_id", clinicId);
        const map: Record<string, string> = {};
        for (const p of clinicPatients || []) map[p.id] = p.full_name;
        const ids = Object.keys(map);
        if (ids.length === 0) return JSON.stringify({ total_unread: 0, patients: [] });

        const { data } = await supabaseAdmin
          .from("portal_mensagens")
          .select("paciente_id, created_at")
          .in("paciente_id", ids)
          .eq("autor_tipo", "patient")
          .is("lida_em", null)
          .order("created_at", { ascending: false })
          .limit(200);

        const byPatient: Record<string, { count: number; last: string }> = {};
        for (const m of data || []) {
          if (!byPatient[m.paciente_id]) byPatient[m.paciente_id] = { count: 0, last: m.created_at };
          byPatient[m.paciente_id].count++;
        }
        return JSON.stringify({
          total_unread: (data || []).length,
          patients: Object.entries(byPatient).map(([id, v]) => ({
            patient: map[id] || "Utente", unread: v.count, last_at: v.last,
          })),
        });
      }

      case "get_active_patients": {
        const days = (args.days as number) || 30;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        let sq = supabaseAdmin
          .from("sessoes")
          .select("paciente_id")
          .eq("clinic_id", clinicId)
          .gte("start_time", cutoff.toISOString())
          .not("status", "in", '("cancelado","falta")');
        sq = scopeSessions(sq, scope);
        const { data: sess } = await sq;
        const ids = [...new Set((sess || []).map((s: any) => s.paciente_id).filter(Boolean))];
        if (ids.length === 0) return JSON.stringify({ total: 0, patients: [] });
        const { data: patients } = await supabaseAdmin
          .from("pacientes")
          .select("id, full_name, phone, email")
          .in("id", ids)
          .limit(100);
        return JSON.stringify({
          total: (patients || []).length,
          days_window: days,
          patients: (patients || []).map((p: any) => ({ id: p.id, name: p.full_name, phone: p.phone, email: p.email })),
        });
      }

      case "get_professional_patient_count": {
        const name = (args.professional_name as string) || "";
        if (!name.trim()) return JSON.stringify({ error: "Nome do profissional em falta." });
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .eq("clinic_id", clinicId)
          .ilike("full_name", `%${name}%`)
          .limit(5);
        if (!profs || profs.length === 0) {
          return JSON.stringify({ error: `Não encontrei profissional com o nome "${name}".` });
        }
        const results: any[] = [];
        for (const p of profs) {
          const { data: sess } = await supabaseAdmin
            .from("sessoes")
            .select("paciente_id")
            .eq("clinic_id", clinicId)
            .eq("profissional_id", p.id)
            .not("status", "in", '("cancelado","falta")');
          const ids = new Set((sess || []).map((s: any) => s.paciente_id).filter(Boolean));
          results.push({ professional: p.full_name, distinct_patients: ids.size });
        }
        return JSON.stringify({ matches: results });
      }

      // ── Mutation tools — disabled (READ-ONLY phase) ──────────────────────
      case "parse_import_file":
      case "get_import_queue":
      case "confirm_import_rows":
      case "register_new_patients": {
        return JSON.stringify({
          error: "ACTION_NOT_AVAILABLE",
          message: "Importações e criação de registos não estão disponíveis nesta versão. Use o menu Pacientes ou Agenda.",
        });
      }

      default:
        return JSON.stringify({ error: `Tool '${toolName}' não reconhecida.` });
    }
  } catch (e) {
    console.error(`Tool ${toolName} error:`, e);
    return JSON.stringify({ error: `Erro ao executar ${toolName}` });
  }
}

// ── System prompt ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é o Copiloto, um assistente inteligente integrado numa plataforma de gestão de clínicas de fisioterapia. Você tem acesso a ferramentas para consultar e agir sobre dados reais do sistema.

REGRAS CRÍTICAS:
1. NUNCA execute ações destrutivas sem confirmação. Para criar ou cancelar sessões, SEMPRE use propose_session primeiro e aguarde confirmação.
2. Responda SEMPRE em português (pt-PT/pt-BR conforme o contexto do utilizador).
3. Seja conciso e direto. Use formatação clara com listas quando apropriado.
4. Quando o utilizador mencionar um nome de paciente, use search_patients para encontrar o paciente correto.
5. Se houver ambiguidade (múltiplos pacientes com nomes semelhantes), pergunte qual.
6. Para agendamentos, SEMPRE verifique disponibilidade com check_availability antes de propor.
7. Use o contexto fornecido (página atual, paciente selecionado) para antecipar o que o utilizador precisa.
8. Para ações de escrita (create_session, cancel_session), explique o que vai fazer e peça confirmação explícita.
9. Formate datas e horas de forma legível (ex: "Quarta, 15 de março às 18:30").
10. Se não conseguir encontrar dados, informe claramente e sugira alternativas.

CAPACIDADES:
- Buscar pacientes por nome
- Verificar disponibilidade de horários
- Propor e criar sessões (com confirmação)
- Cancelar sessões (com confirmação)
- Listar evoluções pendentes
- Listar pagamentos pendentes
- Verificar packs a vencer
- Resumo diário completo
- Listar pacientes inativos

IMPORTAÇÃO DE FICHEIROS:
- Quando o utilizador envia um ficheiro (Excel, CSV ou PDF), use parse_import_file para extrair e processar os dados.
- SEMPRE apresente um resumo dos dados extraídos antes de qualquer ação (quantas linhas, quantos matches, quantos precisam revisão).
- Use get_import_queue para mostrar os dados em formato de tabela quando o utilizador pedir para revisar.
- Para confirmar a importação, use confirm_import_rows APENAS após confirmação explícita do utilizador.
- Se houver pacientes não encontrados na base, pergunte se deve registar como novos usando register_new_patients.
- Apresente os dados extraídos em tabela markdown simples para fácil leitura.
- Se o ficheiro contiver dados de novos pacientes (com nome, telefone, email), proponha o cadastro antes de criar sessões.`;

// ── Main handler ───────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Get clinic_id
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("clinic_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.clinic_id) {
      return new Response(JSON.stringify({ error: "Utilizador sem clínica associada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const clinicId = profile.clinic_id;

    const { messages, context, file_upload } = await req.json();

    // Build context message
    let contextNote = `Contexto: Data/hora atual: ${new Date().toISOString()}. Clinic ID: ${clinicId}.`;
    if (context?.currentPage) contextNote += ` Página atual: ${context.currentPage}.`;
    if (context?.patientId) contextNote += ` Paciente selecionado ID: ${context.patientId}.`;
    if (context?.patientName) contextNote += ` Paciente selecionado: ${context.patientName}.`;
    if (context?.selectedDate) contextNote += ` Data selecionada na agenda: ${context.selectedDate}.`;
    if (file_upload) contextNote += ` FICHEIRO ANEXADO: "${file_upload.name}" (${file_upload.mime_type}). Use parse_import_file para processar.`;

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextNote },
      ...messages,
    ];

    // Extra context for tool execution
    const toolExtraContext = {
      fileUpload: file_upload || undefined,
      userId,
      lovableApiKey,
    };

    // Call AI with tools — loop for tool calls
    let currentMessages = [...fullMessages];
    const MAX_TOOL_ROUNDS = 5;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: currentMessages,
          tools: toolDefinitions,
          stream: round === MAX_TOOL_ROUNDS - 1 ? true : false,
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errorText);
        return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if it's a tool call (non-streaming response)
      const responseData = await aiResponse.json();
      const choice = responseData.choices?.[0];

      if (choice?.finish_reason === "tool_calls" || choice?.message?.tool_calls?.length > 0) {
        const toolCalls = choice.message.tool_calls;
        currentMessages.push(choice.message);

        // Execute all tool calls
        for (const tc of toolCalls) {
          let toolArgs: Record<string, unknown> = {};
          try {
            toolArgs = typeof tc.function.arguments === "string"
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments || {};
          } catch {
            toolArgs = {};
          }

          const result = await executeTool(tc.function.name, toolArgs, adminClient, clinicId, toolExtraContext);
          currentMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }
        // Continue the loop for the next AI call
        continue;
      }

      // No tool call — return the text response as SSE stream
      const textContent = choice?.message?.content || "";

      // Log usage
      try {
        await adminClient.from("ai_usage_logs").insert({
          clinic_id: clinicId,
          user_id: userId,
          feature: "copilot",
          action: file_upload ? "file_import_chat" : "chat",
          model: "google/gemini-3-flash-preview",
          tokens_used: responseData.usage?.total_tokens || null,
        });
      } catch (e) {
        console.error("Log error:", e);
      }

      // Simulate SSE stream from the text
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const sseData = JSON.stringify({
            choices: [{ delta: { content: textContent }, finish_reason: null }],
          });
          controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    // Fallback if max rounds exceeded
    return new Response(
      JSON.stringify({ error: "O agente atingiu o limite de iterações." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Copilot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
