import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.clinic_id) {
      return new Response(JSON.stringify({ error: "Clínica não encontrada" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check AI is enabled
    const { data: settings } = await supabase
      .from("clinic_settings")
      .select("ai_enabled, ai_clinical_enabled")
      .eq("clinic_id", profile.clinic_id)
      .maybeSingle();

    if (settings && (!settings.ai_enabled || !settings.ai_clinical_enabled)) {
      return new Response(JSON.stringify({ error: "IA clínica desativada" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { field, currentText, mode, context } = await req.json();

    if (!currentText || currentText.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Texto muito curto para sugestão" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fieldLabels: Record<string, string> = {
      anamnese: "Anamnese",
      diagnostico: "Diagnóstico",
      objetivos: "Objetivos Terapêuticos",
      observacoes: "Observações Clínicas",
    };

    const modeInstructions = mode === "expand"
      ? "Expanda o texto com linguagem técnica clínica de fisioterapia, adicionando detalhes relevantes e terminologia profissional. Mantenha o sentido original."
      : "Melhore a redação do texto, tornando-o mais claro, objetivo e com linguagem clínica padronizada. Corrija erros e melhore a estrutura.";

    const systemPrompt = `Você é um assistente de escrita clínica para fisioterapia.
${modeInstructions}
Campo: ${fieldLabels[field] || field}.
Retorne APENAS o texto melhorado, sem explicações adicionais.
Escreva em português de Portugal.`;

    let userPrompt = `Texto atual do campo "${fieldLabels[field] || field}":\n${currentText.slice(0, 1000)}`;
    
    if (context?.patientName) {
      userPrompt += `\n\nContexto do paciente: ${context.patientName}`;
    }
    if (context?.anamnese && field !== "anamnese") {
      userPrompt += `\nAnamnese: ${context.anamnese.slice(0, 300)}`;
    }
    if (context?.diagnostico && field !== "diagnostico") {
      userPrompt += `\nDiagnóstico: ${context.diagnostico.slice(0, 300)}`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const startTime = Date.now();

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      await supabase.from("ai_usage_logs").insert({
        clinic_id: profile.clinic_id,
        user_id: user.id,
        feature: "clinical-assist",
        action: "error",
        error_code: String(status),
        duration_ms: durationMs,
      });

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições", status: 429 }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados", status: 402 }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const suggestion = aiData.choices?.[0]?.message?.content || "";
    const tokensUsed = aiData.usage?.total_tokens || null;

    await supabase.from("ai_usage_logs").insert({
      clinic_id: profile.clinic_id,
      user_id: user.id,
      feature: "clinical-assist",
      action: "generated",
      model: "google/gemini-3-flash-preview",
      tokens_used: tokensUsed,
      duration_ms: durationMs,
    });

    return new Response(
      JSON.stringify({ data: { suggestion: suggestion.trim(), mode }, tokens_used: tokensUsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-clinical-assist error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
