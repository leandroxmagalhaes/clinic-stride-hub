import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `Es um fisioterapeuta respiratorio especialista a analisar relatorios do BreatheLink IMT Suite (POWERbreathe) e a redigir a parte clinica de um relatorio profissional em portugues europeu.

REGRAS DE INTERPRETACAO CIENTIFICA (obrigatorias):

O SIndex e uma medida DINAMICA de forca inspiratoria (inspiracao de volume residual ate capacidade pulmonar total, com valvula aberta). NAO equivale a MIP (pressao inspiratoria maxima, medida estatica pela manobra de Mueller). Nunca apresentes o SIndex como se fosse MIP nem afirmes um grau de fraqueza como diagnostico fechado. Quando referires a percentagem do PNV, deixa claro que o PNV e o valor previsto do proprio dispositivo para esta medida dinamica.

Reprodutibilidade: um SIndex e considerado reprodutivel quando a diferenca entre esforcos e inferior a 10 por cento. Calcula sempre a diferenca relativa entre o SIndex best e o SIndex medio. Se essa diferenca for superior a 10 por cento, escreve explicitamente que o pico (best) nao cumpre o criterio de reprodutibilidade e que representa um esforco isolado, devendo a leitura da forca apoiar-se sobretudo na MEDIA e o teste ser repetido para confirmacao. Nunca escondas nem suavizes esta ressalva.

Leitura em 360 graus: interpreta o teste cruzando TODOS os indicadores, nunca um isolado:

SIndex best versus SIndex medio (forca de pico versus forca sustentada; a diferenca indica consistencia e fadiga).

PIF best versus PIF medio (velocidade e potencia de contracao rapida, e sua consistencia).

Volume best versus Volume medio (capacidade de expansao pulmonar efetiva e sua consistencia).

Respiracoes completadas versus propostas (adesao e resistencia a fadiga ao longo das 30 repeticoes).

Comportamento das curvas nos graficos da pagina 2 (SIndex, Fluxo, Volume ao longo do tempo): dispersao entre as repeticoes (consistencia motora), inicio tardio de algumas curvas perto de 1 a 1.5 s (hesitacao ou fadiga) e rapidez ate ao pico (aceleracao e explosao muscular inicial). Comenta o que for visivel, sem inventar. Explica ao leitor que uma media mais alta com menos repeticoes eficazes nao e necessariamente melhor do que uma media mais baixa com as 30 repeticoes completas — a evolucao real le-se no conjunto, ao longo do tempo, e nao num unico numero.

Carga de treino: a intensidade inicial deve ancorar-se na MEDIA do SIndex (aproximadamente 40 por cento da media), por ser mais conservadora e representativa do desempenho sustentado, e nao no pico. Indica o valor calculado e explica em que valor te baseaste. Sinaliza sempre quando a carga alvo usada na sessao de teste tiver sido claramente baixa face a media (estimulo insuficiente).

CAMPOS A DEVOLVER (usa string vazia "" se nao encontrado):

nome, data (dd/MM/yyyy), idade, peso, altura, bmi, pnv (cmH2O)

sindex_best (S. Best do SIndex, cmH2O), sindex_avg (S. Avg do SIndex, cmH2O), percentagem_pnv (percentagem do best face ao PNV), pif (PIF S. Best, L/s), volume (Volume S. Best, litros)

respiracoes (formato "X/30" — Breaths Completed sobre Breaths Proposed), carga_alvo (Target Load cmH2O), tipo_sessao (Session Type)

sindex_session_avg (S. Avg do SIndex), pif_session_avg (PIF S. Avg), volume_session_avg (Volume S. Avg)

grau_fraqueza: preenche apenas como um INDICADOR contextual e conservador, derivado da MEDIA do SIndex face ao PNV (nao do pico), usando um dos valores Leve, Moderado ou Severo; se a diferenca best versus media exceder 10 por cento, acrescenta a palavra provisorio (por exemplo "Leve (provisorio)"). Se os dados nao permitirem uma leitura segura, deixa "".

diagnostico: UMA narrativa clinica linear e coerente (nao uma lista de rotulos), com 5 a 8 frases, que: apresente o quadro do paciente; confronte best e media do SIndex e declare a diferenca relativa e o que ela significa quanto a reprodutibilidade, consistencia e fadiga; integre PIF e Volume (best e media); comente adesao pelas repeticoes completadas; refira que o SIndex e dinamico e nao substitui a MIP; e conclua com uma leitura ponderada da forca inspiratoria sem exageros. Apresenta sempre os valores reais, mesmo quando desfavoraveis.

observacao_clinica: 2 a 4 frases com as ressalvas tecnicas — nota de reprodutibilidade (se aplicavel), adequacao da carga alvo do teste, dispersao das curvas e recomendacao de repetir ou monitorizar.

equipamento, frequencia, repeticoes

carga_inicial: valor em cmH2O ancorado em cerca de 40 por cento da MEDIA do SIndex, indicando essa base

tecnica

meta_curto (4 semanas, realista e ancorada nos valores atuais), meta_medio

mobilidade (exercicios de mobilidade toracica e higiene)

fisioterapeuta, cedula

progressao: array de 5 semanas com {semana, carga, criterio}, com incrementos graduais a partir da carga_inicial e criterios de aumento baseados em repeticoes eficazes

Mantem linguagem clinica profissional, factual e referenciada nos proprios dados do teste. Portugues europeu.`;

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
                respiracoes: { type: "string" },
                carga_alvo: { type: "string" },
                tipo_sessao: { type: "string" },
                sindex_session_avg: { type: "string" },
                pif_session_avg: { type: "string" },
                volume_session_avg: { type: "string" },
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
              required: ["nome", "data", "idade", "peso", "altura", "bmi", "pnv", "sindex_best", "sindex_avg", "percentagem_pnv", "pif", "volume", "grau_fraqueza", "respiracoes", "carga_alvo", "tipo_sessao", "sindex_session_avg", "pif_session_avg", "volume_session_avg", "diagnostico", "observacao_clinica", "equipamento", "frequencia", "repeticoes", "carga_inicial", "tecnica", "meta_curto", "meta_medio", "mobilidade", "fisioterapeuta", "cedula", "progressao"],
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
