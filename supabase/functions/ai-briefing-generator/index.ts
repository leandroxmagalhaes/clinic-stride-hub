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

    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("user_id", userId)
      .single();
    if (!profile?.clinic_id) {
      return new Response(JSON.stringify({ error: "Clinic not found" }), { status: 400, headers: corsHeaders });
    }

    const { patientId, sessionId } = await req.json();
    if (!patientId || !sessionId) {
      return new Response(JSON.stringify({ error: "patientId and sessionId required" }), { status: 400, headers: corsHeaders });
    }

    // Check cache first
    const { data: cached } = await supabase
      .from("session_briefings")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (cached && (!cached.expires_at || new Date(cached.expires_at) > new Date())) {
      return new Response(JSON.stringify({
        data: cached.briefing_data,
        cached: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get patient info
    const { data: patient } = await supabase
      .from("pacientes")
      .select("full_name")
      .eq("id", patientId)
      .single();

    // Get the session's prontuario
    const { data: prontuario } = await supabase
      .from("prontuarios")
      .select("id")
      .eq("paciente_id", patientId)
      .eq("clinic_id", profile.clinic_id)
      .single();

    // Get last evolution
    let lastEvolution = null;
    if (prontuario) {
      const { data: evols } = await supabase
        .from("evolucoes_clinicas")
        .select("descricao, escala_dor, created_at, structured_data")
        .eq("prontuario_id", prontuario.id)
        .order("created_at", { ascending: false })
        .limit(1);
      lastEvolution = evols?.[0] || null;
    }

    // Count sessions for this patient
    const { data: allSessions } = await supabase
      .from("sessoes")
      .select("id, status, start_time")
      .eq("paciente_id", patientId)
      .eq("clinic_id", profile.clinic_id)
      .order("start_time", { ascending: true });

    const sessions = allSessions || [];
    const currentIndex = sessions.findIndex(s => s.id === sessionId);
    const totalSessions = sessions.length;
    const sessionNumber = currentIndex >= 0 ? currentIndex + 1 : totalSessions;

    // Count recent absences (last 5 sessions)
    const recentSessions = sessions.slice(Math.max(0, currentIndex - 5), currentIndex);
    const recentAbsences = recentSessions.filter(s => s.status === "falta").length;

    // Get package total if exists
    const { data: currentSession } = await supabase
      .from("sessoes")
      .select("package_id")
      .eq("id", sessionId)
      .single();

    let packageTotal: number | null = null;
    if (currentSession?.package_id) {
      const { data: pkg } = await supabase
        .from("scheduling_packages")
        .select("total_sessions")
        .eq("id", currentSession.package_id)
        .single();
      packageTotal = pkg?.total_sessions || null;
    }

    // Generate AI summary of last evolution
    let lastEvolutionSummary = "Sem evoluções anteriores registadas.";
    let todayPlan = "";

    if (lastEvolution) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `Você é um assistente clínico. Resuma a evolução clínica abaixo em 2-3 linhas concisas para o fisioterapeuta rever antes da próxima sessão. 
Se o texto contém formato SOAP, extraia também o campo "Plano" separadamente.
Responda APENAS com JSON válido (sem markdown):
{ "summary": "resumo 2-3 linhas", "plan": "plano extraído ou vazio" }`,
              },
              { role: "user", content: lastEvolution.descricao },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          try {
            const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            const parsed = JSON.parse(cleaned);
            lastEvolutionSummary = parsed.summary || lastEvolutionSummary;
            todayPlan = parsed.plan || "";
          } catch {
            lastEvolutionSummary = content.slice(0, 300);
          }

          // Log usage
          await supabase.from("ai_usage_logs").insert({
            clinic_id: profile.clinic_id,
            user_id: userId,
            feature: "briefing-generator",
            action: "generated",
            model: "google/gemini-3-flash-preview",
            tokens_used: aiData.usage?.total_tokens || null,
            duration_ms: Date.now() - startTime,
          });
        }
      }
    }

    const briefingData = {
      last_evolution_summary: lastEvolutionSummary,
      today_plan: todayPlan,
      absence_alert: recentAbsences >= 2,
      absence_count: recentAbsences,
      last_pain_level: lastEvolution?.escala_dor ?? null,
      session_number: packageTotal
        ? `Sessão ${sessionNumber} de ${packageTotal}`
        : `Sessão ${sessionNumber}`,
      patient_name: patient?.full_name || "Paciente",
      last_evolution_date: lastEvolution?.created_at || null,
    };

    // Upsert cache
    if (cached) {
      await supabase
        .from("session_briefings")
        .update({
          briefing_data: briefingData,
          generated_at: new Date().toISOString(),
          expires_at: null,
        })
        .eq("id", cached.id);
    } else {
      await supabase.from("session_briefings").insert({
        clinic_id: profile.clinic_id,
        session_id: sessionId,
        patient_id: patientId,
        briefing_data: briefingData,
      });
    }

    return new Response(JSON.stringify({
      data: briefingData,
      cached: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("ai-briefing-generator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
