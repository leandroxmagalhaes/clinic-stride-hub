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

    const { patients } = await req.json();
    if (!patients || !Array.isArray(patients) || patients.length === 0) {
      return new Response(JSON.stringify({ data: { analyses: [] } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Limit to top 10 at-risk patients
    const topPatients = patients.slice(0, 10);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const patientList = topPatients.map((p: any) => 
      `- ${p.full_name}: ${p.days_since_last_session} dias sem sessão`
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
          { role: "system", content: "Você é um consultor de gestão de clínicas de fisioterapia. Analise riscos de churn e sugira mensagens de reativação personalizadas." },
          { role: "user", content: `Analise estes pacientes em risco de abandono e para cada um gere:
1. Nível de risco (critico/alto/moderado)
2. Motivo provável do afastamento (1 frase)
3. Mensagem personalizada de reativação via WhatsApp (curta, empática, profissional)

Pacientes:
${patientList}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "churn_analysis",
            description: "Return churn analysis for each patient",
            parameters: {
              type: "object",
              properties: {
                analyses: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      patient_name: { type: "string" },
                      risk_level: { type: "string", enum: ["critico", "alto", "moderado"] },
                      probable_reason: { type: "string" },
                      reactivation_message: { type: "string" },
                    },
                    required: ["patient_name", "risk_level", "probable_reason", "reactivation_message"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["analyses"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "churn_analysis" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit", status: 429 }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Payment required", status: 402 }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    let analyses = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      analyses = parsed.analyses || [];
    }

    await supabase.from("ai_usage_logs").insert({
      clinic_id: clinicId,
      user_id: user.id,
      feature: "churn-analysis",
      action: "generate",
      model: "google/gemini-3-flash-preview",
      tokens_used: aiData.usage?.total_tokens || null,
      duration_ms: Date.now() - startTime,
    });

    return new Response(JSON.stringify({ data: { analyses } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-churn-analysis error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
