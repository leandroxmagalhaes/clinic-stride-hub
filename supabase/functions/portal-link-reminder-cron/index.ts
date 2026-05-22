// Cron horário: encontra convites do portal a expirar nas próximas 23-25h
// para utentes que ainda não preencheram a Anamnese, e dispara o lembrete
// através de send-portal-link-automation (que gera link fresco + anti-dup).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const startedAt = new Date().toISOString();
  const summary = { scanned: 0, sent: 0, skipped: 0, errors: 0, details: [] as any[] };

  try {
    // Janela: convites a expirar entre now+23h e now+25h, ainda não utilizados
    const lower = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
    const upper = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

    const { data: convites, error } = await admin
      .from("portal_convites")
      .select("id, paciente_id, expira_em, utilizado, tipo")
      .eq("utilizado", false)
      .gte("expira_em", lower)
      .lte("expira_em", upper);

    if (error) throw error;

    summary.scanned = convites?.length || 0;

    for (const c of convites || []) {
      try {
        // Estado em tempo real: Anamnese preenchida?
        const { data: quest } = await admin
          .from("portal_questionario")
          .select("completo")
          .eq("paciente_id", c.paciente_id)
          .maybeSingle();
        if (quest?.completo === true) {
          summary.skipped++;
          summary.details.push({ paciente_id: c.paciente_id, skipped: "completo" });
          continue;
        }

        // Já há log enviado para este trigger?
        const { data: priorSent } = await admin
          .from("automation_logs")
          .select("id")
          .eq("paciente_id", c.paciente_id)
          .eq("trigger_type", "lembrete_portal_expiracao")
          .eq("status", "sent")
          .limit(1);
        if (priorSent && priorSent.length > 0) {
          summary.skipped++;
          summary.details.push({ paciente_id: c.paciente_id, skipped: "already_sent" });
          continue;
        }

        // Invocar a função que valida tudo e envia
        const resp = await fetch(
          `${supabaseUrl}/functions/v1/send-portal-link-automation`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
              apikey: serviceKey,
            },
            body: JSON.stringify({
              pacienteId: c.paciente_id,
              triggerType: "lembrete_portal_expiracao",
            }),
          },
        );
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          summary.errors++;
          summary.details.push({ paciente_id: c.paciente_id, error: data });
        } else if ((data as any).skipped) {
          summary.skipped++;
          summary.details.push({ paciente_id: c.paciente_id, skipped: (data as any).reason });
        } else {
          summary.sent++;
          summary.details.push({ paciente_id: c.paciente_id, sent: true });
        }
      } catch (innerErr: any) {
        summary.errors++;
        summary.details.push({ paciente_id: c.paciente_id, error: innerErr.message });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, startedAt, finishedAt: new Date().toISOString(), ...summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("portal-link-reminder-cron error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message, ...summary }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
