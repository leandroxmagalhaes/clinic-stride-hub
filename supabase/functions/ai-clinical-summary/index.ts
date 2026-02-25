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
    // Auth check
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

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get clinic_id from backend
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
      return new Response(JSON.stringify({ error: "IA clínica desativada nas configurações" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { patientName, anamnese, diagnostico, objetivos, evolutions } = await req.json();

    if (!evolutions || evolutions.length === 0) {
      return new Response(JSON.stringify({ error: "Sem evoluções para analisar" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context - truncate to avoid token overflow
    const maxEvolutions = evolutions.slice(-20); // Last 20 evolutions
    const evolutionTexts = maxEvolutions.map((e: any, i: number) => {
      const pain = e.escala_dor !== null ? `Dor: ${e.escala_dor}/10` : "";
      const date = e.created_at ? new Date(e.created_at).toLocaleDateString("pt-BR") : "";
      return `[${date}] ${pain} - ${(e.descricao || "").slice(0, 500)}`;
    }).join("\n");

    const systemPrompt = `Você é um assistente clínico especializado em fisioterapia e reabilitação. 
Analise as evoluções do paciente e gere um resumo clínico estruturado em português de Portugal.
Retorne APENAS um JSON válido com a seguinte estrutura:
{
  "resumo_progresso": "Resumo do progresso clínico do paciente (2-4 parágrafos)",
  "alertas_clinicos": ["alerta1", "alerta2"],
  "focos_terapeuticos": ["foco1", "foco2", "foco3"],
  "tendencia_dor": "Descrição da tendência de dor ao longo das sessões"
}
Seja objetivo e clinicamente preciso. Não faça diagnósticos definitivos.`;

    const userPrompt = `Paciente: ${patientName}
${anamnese ? `Anamnese: ${anamnese.slice(0, 500)}` : ""}
${diagnostico ? `Diagnóstico: ${diagnostico.slice(0, 300)}` : ""}
${objetivos ? `Objetivos: ${objetivos.slice(0, 300)}` : ""}

Evoluções (${maxEvolutions.length} registos):
${evolutionTexts}`;

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

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
        tools: [
          {
            type: "function",
            function: {
              name: "clinical_summary",
              description: "Return structured clinical summary",
              parameters: {
                type: "object",
                properties: {
                  resumo_progresso: { type: "string" },
                  alertas_clinicos: { type: "array", items: { type: "string" } },
                  focos_terapeuticos: { type: "array", items: { type: "string" } },
                  tendencia_dor: { type: "string" },
                },
                required: ["resumo_progresso", "alertas_clinicos", "focos_terapeuticos", "tendencia_dor"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "clinical_summary" } },
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!aiResponse.ok) {
      const status = aiResponse.status;

      // Log error
      await supabase.from("ai_usage_logs").insert({
        clinic_id: profile.clinic_id,
        user_id: user.id,
        feature: "clinical-summary",
        action: "error",
        error_code: String(status),
        duration_ms: durationMs,
      });

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido", status: 429 }), {
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
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let summary;
    if (toolCall?.function?.arguments) {
      summary = typeof toolCall.function.arguments === "string" 
        ? JSON.parse(toolCall.function.arguments) 
        : toolCall.function.arguments;
    } else {
      // Fallback: try to parse from content
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summary = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse AI response");
      }
    }

    const tokensUsed = aiData.usage?.total_tokens || null;

    // Log success
    await supabase.from("ai_usage_logs").insert({
      clinic_id: profile.clinic_id,
      user_id: user.id,
      feature: "clinical-summary",
      action: "generated",
      model: "google/gemini-3-flash-preview",
      tokens_used: tokensUsed,
      duration_ms: durationMs,
    });

    return new Response(JSON.stringify({ data: summary, tokens_used: tokensUsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-clinical-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
