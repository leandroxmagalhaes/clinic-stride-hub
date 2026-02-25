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

    const { todaySessions, activePatients, churnRiskCount, pendingLeads } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Você é um assistente executivo de uma clínica de fisioterapia. Gere briefings diários concisos e acionáveis." },
          { role: "user", content: `Gere um briefing diário curto (3-4 pontos) para o gestor da clínica com base nestes dados:

- Sessões hoje: ${todaySessions || 0}
- Pacientes ativos: ${activePatients || 0}
- Pacientes em risco de churn: ${churnRiskCount || 0}
- Leads pendentes no pipeline: ${pendingLeads || 0}

Cada ponto deve ser uma frase prática e direta. Inclua uma prioridade do dia.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "daily_briefing",
            description: "Return daily briefing",
            parameters: {
              type: "object",
              properties: {
                greeting: { type: "string", description: "Short greeting with context" },
                highlights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      icon: { type: "string", enum: ["calendar", "alert", "trending", "users"] },
                      text: { type: "string" },
                    },
                    required: ["icon", "text"],
                    additionalProperties: false,
                  },
                },
                priority: { type: "string", description: "Main priority for today" },
              },
              required: ["greeting", "highlights", "priority"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "daily_briefing" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit", status: 429 }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Payment required", status: 402 }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    let briefing = { greeting: "", highlights: [], priority: "" };
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      briefing = JSON.parse(toolCall.function.arguments);
    }

    await supabase.from("ai_usage_logs").insert({
      clinic_id: clinicId,
      user_id: user.id,
      feature: "daily-briefing",
      action: "generate",
      model: "google/gemini-2.5-flash-lite",
      tokens_used: aiData.usage?.total_tokens || null,
      duration_ms: Date.now() - startTime,
    });

    return new Response(JSON.stringify({ data: briefing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-daily-briefing error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
