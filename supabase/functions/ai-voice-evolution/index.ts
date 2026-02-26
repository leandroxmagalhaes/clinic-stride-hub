import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    // Get clinic_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("user_id", userId)
      .single();
    if (!profile?.clinic_id) {
      return new Response(JSON.stringify({ error: "Clinic not found" }), { status: 400, headers: corsHeaders });
    }

    const { rawTranscription, patientName, painLevel } = await req.json();
    if (!rawTranscription || !patientName) {
      return new Response(JSON.stringify({ error: "rawTranscription and patientName are required" }), { status: 400, headers: corsHeaders });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um assistente clínico especializado em fisioterapia. 
Receba a transcrição de voz de um fisioterapeuta sobre uma sessão e estruture-a no formato SOAP.

Paciente: ${patientName}
${painLevel !== undefined ? `Nível de dor reportado: ${painLevel}/10` : ""}

Responda APENAS com um JSON válido (sem markdown) com esta estrutura:
{
  "subjetivo": "Queixa e relato do paciente",
  "objetivo": "Achados clínicos, testes realizados, medições",
  "avaliacao": "Interpretação clínica do fisioterapeuta",
  "plano": "Próximos passos, exercícios prescritos, frequência"
}

Se alguma seção não tiver informação na transcrição, coloque uma string vazia.
Mantenha linguagem clínica profissional. Não invente informação que não esteja na transcrição.`;

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
          { role: "user", content: rawTranscription },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit", status: 429 }), { status: 429, headers: corsHeaders });
      if (status === 402) return new Response(JSON.stringify({ error: "Payment required", status: 402 }), { status: 402, headers: corsHeaders });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    const tokensUsed = aiData.usage?.total_tokens || null;

    // Parse SOAP JSON
    let soap;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      soap = JSON.parse(cleaned);
    } catch {
      soap = { subjetivo: content, objetivo: "", avaliacao: "", plano: "" };
    }

    // Format as readable text
    const formattedText = [
      soap.subjetivo ? `**S (Subjetivo):**\n${soap.subjetivo}` : "",
      soap.objetivo ? `**O (Objetivo):**\n${soap.objetivo}` : "",
      soap.avaliacao ? `**A (Avaliação):**\n${soap.avaliacao}` : "",
      soap.plano ? `**P (Plano):**\n${soap.plano}` : "",
    ].filter(Boolean).join("\n\n");

    // Log usage
    await supabase.from("ai_usage_logs").insert({
      clinic_id: profile.clinic_id,
      user_id: userId,
      feature: "voice-evolution",
      action: "structured",
      model: "google/gemini-3-flash-preview",
      tokens_used: tokensUsed,
      duration_ms: Date.now() - startTime,
    });

    return new Response(JSON.stringify({
      data: {
        soap,
        formattedText,
        rawTranscription,
      },
      model: "google/gemini-3-flash-preview",
      tokens_used: tokensUsed,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("ai-voice-evolution error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
