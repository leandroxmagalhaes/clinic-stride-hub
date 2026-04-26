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

    const { leads } = await req.json();
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return new Response(JSON.stringify({ data: { scores: [] } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const activeLeads = leads.filter((l: any) => !['ganho', 'perdido'].includes(l.status)).slice(0, 15);
    if (activeLeads.length === 0) {
      return new Response(JSON.stringify({ data: { scores: [] } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const leadList = activeLeads.map((l: any) => 
      `- ${l.name} | Status: ${l.status} | Valor: €${l.estimated_value || 0} | Origem: ${l.source || 'manual'} | Criado: ${l.created_at?.split('T')[0] || 'N/A'}${l.notes ? ` | Notas: ${l.notes.substring(0, 100)}` : ''}`
    ).join('\n');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um consultor comercial de clínicas de saúde. Classifique leads por potencial de conversão e sugira próximos passos." },
          { role: "user", content: `Classifique estes leads por potencial de conversão e sugira uma ação para cada:

${leadList}

Para cada lead dê: score (alto/medio/baixo), justificativa curta (1 frase), próximo passo sugerido (1 frase).` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "lead_scores",
            description: "Return lead scoring results",
            parameters: {
              type: "object",
              properties: {
                scores: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      lead_name: { type: "string" },
                      score: { type: "string", enum: ["alto", "medio", "baixo"] },
                      justification: { type: "string" },
                      next_step: { type: "string" },
                    },
                    required: ["lead_name", "score", "justification", "next_step"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["scores"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "lead_scores" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit", status: 429 }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Payment required", status: 402 }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    let scores = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      scores = parsed.scores || [];
    }

    await supabase.from("ai_usage_logs").insert({
      clinic_id: clinicId,
      user_id: user.id,
      feature: "lead-scoring",
      action: "generate",
      model: "google/gemini-3-flash-preview",
      tokens_used: aiData.usage?.total_tokens || null,
      duration_ms: Date.now() - startTime,
    });

    return new Response(JSON.stringify({ data: { scores } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-lead-scoring error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
