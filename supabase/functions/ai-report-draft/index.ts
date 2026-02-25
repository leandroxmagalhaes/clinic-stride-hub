import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("clinic_id").eq("user_id", user.id).single();
    if (!profile?.clinic_id) throw new Error("No clinic found");
    const clinicId = profile.clinic_id;

    const { prontuarioId, patientName, tipo, periodoInicio, periodoFim } = await req.json();
    if (!prontuarioId || !periodoInicio || !periodoFim) throw new Error("Missing required fields");

    // Fetch evolutions in period
    const { data: evolutions } = await supabase
      .from("evolucoes_clinicas")
      .select("descricao, escala_dor, created_at, structured_data")
      .eq("prontuario_id", prontuarioId)
      .eq("clinic_id", clinicId)
      .gte("created_at", periodoInicio)
      .lte("created_at", periodoFim)
      .order("created_at", { ascending: true });

    // Fetch prontuario clinical data
    const { data: prontuario } = await supabase
      .from("prontuarios")
      .select("anamnese, diagnostico, objetivos")
      .eq("id", prontuarioId)
      .eq("clinic_id", clinicId)
      .single();

    const evolutionsSummary = (evolutions || []).map((e, i) => 
      `Sessão ${i + 1} (${e.created_at.split('T')[0]}): ${e.descricao.substring(0, 300)}${e.escala_dor !== null ? ` | Dor: ${e.escala_dor}/10` : ''}`
    ).join('\n');

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Você é um fisioterapeuta experiente redigindo um relatório clínico fisioterapêutico.

Dados do paciente: ${patientName || 'Paciente'}
Tipo de relatório: ${tipo || 'evolucao_periodica'}
Período: ${periodoInicio} a ${periodoFim}
Número de sessões: ${evolutions?.length || 0}

Dados clínicos do prontuário:
- Anamnese: ${prontuario?.anamnese || 'Não informada'}
- Diagnóstico: ${prontuario?.diagnostico || 'Não informado'}
- Objetivos: ${prontuario?.objetivos || 'Não informados'}

Evoluções no período:
${evolutionsSummary || 'Nenhuma evolução registada.'}

Gere um rascunho de relatório fisioterapêutico profissional e estruturado com as seguintes seções:
1. Diagnóstico Clínico e Queixa Principal
2. Objetivos do Tratamento
3. Evolução e Progresso do Paciente
4. Resultados Obtidos
5. Recomendações

Use linguagem técnica apropriada em português de Portugal. Seja objetivo e clinicamente preciso.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um assistente clínico especializado em fisioterapia. Gera relatórios profissionais e estruturados." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit", status: 429 }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Payment required", status: 402 }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    const draft = aiData.choices?.[0]?.message?.content || "";
    const tokensUsed = aiData.usage?.total_tokens || null;

    // Log usage
    await supabase.from("ai_usage_logs").insert({
      clinic_id: clinicId,
      user_id: user.id,
      feature: "report-draft",
      action: "generate",
      model: "google/gemini-3-flash-preview",
      tokens_used: tokensUsed,
      duration_ms: Date.now() - startTime,
    });

    return new Response(JSON.stringify({ data: { draft }, model: "google/gemini-3-flash-preview", tokens_used: tokensUsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-report-draft error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
