import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `És um fisioterapeuta respiratório especialista a analisar relatórios do BreatheLink IMT Suite (POWERbreathe).
Analisa o conteúdo do relatório e devolve os dados clínicos extraídos.
Campos obrigatórios (usa string vazia "" se não encontrado):
- nome, data (dd/MM/yyyy), idade, peso, altura, bmi, pnv (cmH2O)
- sindex_best (cmH2O), sindex_avg (cmH2O), percentagem_pnv, pif (L/s), volume (litros)
- grau_fraqueza (Leve|Moderado|Severo baseado na % PNV: >70% normal, 50-70% leve, 30-50% moderado, <30% severo)
- diagnostico (3-4 frases clínicas profissionais), observacao_clinica
- equipamento, frequencia, repeticoes, carga_inicial (35-40% do SIndex best), tecnica
- meta_curto (4 semanas), meta_medio
- mobilidade (exercícios de mobilidade torácica)
- fisioterapeuta, cedula
- progressao: array de 5 semanas com {semana, carga, criterio} aumentando 2 cmH2O/semana
Mantém linguagem clínica profissional em português europeu.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pdfBase64 } = await req.json();
    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: "pdfBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
              {
                type: "text",
                text: "Analisa este relatório BreatheLink e devolve o JSON com todos os dados extraídos e o plano terapêutico gerado.",
              },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "respiratory_report_data",
            description: "Return extracted clinical data from a BreatheLink respiratory report",
            parameters: {
              type: "object",
              properties: {
                nome: { type: "string" },
                data: { type: "string" },
                idade: { type: "string" },
                peso: { type: "string" },
                altura: { type: "string" },
                bmi: { type: "string" },
                pnv: { type: "string" },
                sindex_best: { type: "string" },
                sindex_avg: { type: "string" },
                percentagem_pnv: { type: "string" },
                pif: { type: "string" },
                volume: { type: "string" },
                grau_fraqueza: { type: "string", enum: ["Leve", "Moderado", "Severo"] },
                diagnostico: { type: "string" },
                observacao_clinica: { type: "string" },
                equipamento: { type: "string" },
                frequencia: { type: "string" },
                repeticoes: { type: "string" },
                carga_inicial: { type: "string" },
                tecnica: { type: "string" },
                meta_curto: { type: "string" },
                meta_medio: { type: "string" },
                mobilidade: { type: "string" },
                fisioterapeuta: { type: "string" },
                cedula: { type: "string" },
                progressao: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      semana: { type: "string" },
                      carga: { type: "string" },
                      criterio: { type: "string" },
                    },
                    required: ["semana", "carga", "criterio"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["nome", "data", "idade", "peso", "altura", "bmi", "pnv", "sindex_best", "sindex_avg", "percentagem_pnv", "pif", "volume", "grau_fraqueza", "diagnostico", "observacao_clinica", "equipamento", "frequencia", "repeticoes", "carga_inicial", "tecnica", "meta_curto", "meta_medio", "mobilidade", "fisioterapeuta", "cedula", "progressao"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "respiratory_report_data" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded", status: 429 }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Payment required", status: 402 }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    let parsed = {};
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      parsed = JSON.parse(toolCall.function.arguments);
    }

    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-respiratory-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
