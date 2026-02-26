import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Tool definitions for function calling ──────────────────────────────────
const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "search_patients",
      description: "Busca pacientes por nome aproximado na clínica do utilizador. Retorna lista de pacientes com id, nome, telefone e email.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Nome ou parte do nome do paciente" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Verifica horários disponíveis para um profissional num determinado dia. Retorna lista de slots livres.",
      parameters: {
        type: "object",
        properties: {
          professional_id: { type: "string", description: "UUID do profissional" },
          date: { type: "string", description: "Data no formato YYYY-MM-DD" },
          min_time: { type: "string", description: "Horário mínimo no formato HH:MM (opcional)" },
        },
        required: ["date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_session",
      description: "Prepara uma proposta de sessão para confirmação do utilizador. NÃO cria a sessão. Retorna os dados formatados para o utilizador confirmar.",
      parameters: {
        type: "object",
        properties: {
          patient_id: { type: "string" },
          professional_id: { type: "string" },
          service_id: { type: "string", description: "UUID do serviço (opcional)" },
          start_time: { type: "string", description: "ISO 8601 datetime" },
          end_time: { type: "string", description: "ISO 8601 datetime" },
          notes: { type: "string" },
        },
        required: ["patient_id", "professional_id", "start_time", "end_time"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_session",
      description: "Cria uma sessão após confirmação explícita do utilizador. Só chamar depois de propose_session e confirmação.",
      parameters: {
        type: "object",
        properties: {
          patient_id: { type: "string" },
          professional_id: { type: "string" },
          service_id: { type: "string" },
          start_time: { type: "string" },
          end_time: { type: "string" },
          notes: { type: "string" },
        },
        required: ["patient_id", "professional_id", "start_time", "end_time"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_session",
      description: "Cancela uma sessão existente mudando o status para 'cancelado'.",
      parameters: {
        type: "object",
        properties: { session_id: { type: "string", description: "UUID da sessão" } },
        required: ["session_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_evolutions",
      description: "Lista sessões realizadas que ainda não têm evolução registada.",
      parameters: { type: "object", properties: { limit: { type: "number", description: "Limite de resultados (default 10)" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_payments",
      description: "Lista sessões com pagamento pendente.",
      parameters: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_expiring_packs",
      description: "Lista pacotes/packs que vencem nos próximos N dias.",
      parameters: { type: "object", properties: { days: { type: "number", description: "Dias para verificar (default 7)" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_daily_summary",
      description: "Consolida sessões de hoje, pendências e alertas num resumo diário.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inactive_patients",
      description: "Lista pacientes que não têm sessão há mais de N dias.",
      parameters: { type: "object", properties: { days: { type: "number", description: "Dias de inatividade (default 14)" } }, additionalProperties: false },
    },
  },
];

// ── Tool execution ─────────────────────────────────────────────────────────
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  supabaseAdmin: ReturnType<typeof createClient>,
  clinicId: string
): Promise<string> {
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

        // Get existing sessions for that day
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

        // Get professionals if not specified
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

        // Generate available slots (8h-20h, 30min intervals)
        const slots: Array<{ time: string; professional_id: string; professional_name: string }> = [];
        for (const prof of professionals) {
          for (let h = 8; h < 20; h++) {
            for (const m of [0, 30]) {
              const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              if (minTime && time < minTime) continue;
              const slotStart = `${date}T${time}:00`;
              const slotEnd = new Date(new Date(slotStart).getTime() + 60 * 60000).toISOString();
              const conflict = (sessions || []).some(
                (s) =>
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

      case "propose_session": {
        // Just format and return — do NOT create
        const { data: patient } = await supabaseAdmin
          .from("pacientes")
          .select("full_name")
          .eq("id", args.patient_id as string)
          .single();
        const { data: prof } = await supabaseAdmin
          .from("profissionais")
          .select("full_name")
          .eq("id", args.professional_id as string)
          .single();

        return JSON.stringify({
          action: "propose_session",
          proposal: {
            patient_name: patient?.full_name || "Desconhecido",
            professional_name: prof?.full_name || "Desconhecido",
            start_time: args.start_time,
            end_time: args.end_time,
            service_id: args.service_id || null,
            notes: args.notes || null,
            patient_id: args.patient_id,
            professional_id: args.professional_id,
          },
          message: "Aguardando confirmação do utilizador para criar esta sessão.",
        });
      }

      case "create_session": {
        const { data, error } = await supabaseAdmin.from("sessoes").insert({
          clinic_id: clinicId,
          paciente_id: args.patient_id as string,
          profissional_id: args.professional_id as string,
          servico_id: (args.service_id as string) || null,
          start_time: args.start_time as string,
          end_time: args.end_time as string,
          notes: (args.notes as string) || null,
          status: "agendado",
          payment_status: "pendente",
        }).select("id").single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, session_id: data?.id, message: "Sessão criada com sucesso!" });
      }

      case "cancel_session": {
        const { error } = await supabaseAdmin
          .from("sessoes")
          .update({ status: "cancelado" })
          .eq("id", args.session_id as string)
          .eq("clinic_id", clinicId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, message: "Sessão cancelada." });
      }

      case "get_pending_evolutions": {
        const limit = (args.limit as number) || 10;
        const { data } = await supabaseAdmin
          .from("sessoes")
          .select("id, start_time, paciente_id, pacientes!sessoes_paciente_id_fkey(full_name), profissional_id")
          .eq("clinic_id", clinicId)
          .eq("status", "realizado")
          .is("notes", null)
          .order("start_time", { ascending: false })
          .limit(limit);

        // Filter those without evolution
        const sessionIds = (data || []).map((s) => s.id);
        if (sessionIds.length === 0) return JSON.stringify({ pending: [] });

        const { data: evolutions } = await supabaseAdmin
          .from("evolucoes_clinicas")
          .select("sessao_id")
          .in("sessao_id", sessionIds);
        const evolvedIds = new Set((evolutions || []).map((e) => e.sessao_id));
        const pending = (data || []).filter((s) => !evolvedIds.has(s.id)).map((s) => ({
          session_id: s.id,
          date: s.start_time,
          patient_name: (s as any).pacientes?.full_name || "N/A",
        }));
        return JSON.stringify({ pending });
      }

      case "get_pending_payments": {
        const limit = (args.limit as number) || 10;
        const { data } = await supabaseAdmin
          .from("sessoes")
          .select("id, start_time, price, pacientes!sessoes_paciente_id_fkey(full_name)")
          .eq("clinic_id", clinicId)
          .eq("payment_status", "pendente")
          .eq("status", "realizado")
          .order("start_time", { ascending: false })
          .limit(limit);
        const pending = (data || []).map((s) => ({
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
        const packs = (data || []).map((p) => ({
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
        const confirmed = sessions.filter((s) => s.status === "agendado").length;
        const completed = sessions.filter((s) => s.status === "realizado").length;
        const cancelled = sessions.filter((s) => s.status === "cancelado" || s.status === "falta").length;

        return JSON.stringify({
          date: today,
          total_sessions: total,
          confirmed,
          completed,
          cancelled,
          pending_payments: pendingPayRes.count || 0,
          sessions: sessions.map((s) => ({
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

        // For each patient check last session
        const patientIds = patients.map((p) => p.id);
        const { data: recentSessions } = await supabaseAdmin
          .from("sessoes")
          .select("paciente_id, start_time")
          .eq("clinic_id", clinicId)
          .in("paciente_id", patientIds)
          .gte("start_time", cutoff.toISOString())
          .not("status", "in", '("cancelado","falta")');

        const activePatientIds = new Set((recentSessions || []).map((s) => s.paciente_id));
        const inactive = patients
          .filter((p) => !activePatientIds.has(p.id))
          .slice(0, 20)
          .map((p) => ({ id: p.id, name: p.full_name, phone: p.phone, email: p.email }));

        return JSON.stringify({ inactive, days_threshold: days });
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
- Listar pacientes inativos`;

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

    const { messages, context } = await req.json();

    // Build context message
    let contextNote = `Contexto: Data/hora atual: ${new Date().toISOString()}. Clinic ID: ${clinicId}.`;
    if (context?.currentPage) contextNote += ` Página atual: ${context.currentPage}.`;
    if (context?.patientId) contextNote += ` Paciente selecionado ID: ${context.patientId}.`;
    if (context?.patientName) contextNote += ` Paciente selecionado: ${context.patientName}.`;
    if (context?.selectedDate) contextNote += ` Data selecionada na agenda: ${context.selectedDate}.`;

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextNote },
      ...messages,
    ];

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
          stream: round === MAX_TOOL_ROUNDS - 1 ? true : false, // Only stream final round
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

          const result = await executeTool(tc.function.name, toolArgs, adminClient, clinicId);
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
          action: "chat",
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
          // Send the content as a single SSE chunk
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
