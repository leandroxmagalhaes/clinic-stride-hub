import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(unsafe: string): string {
  return String(unsafe ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const resend = new Resend(resendApiKey);

    // Get sessions scheduled for tomorrow that haven't been reminded yet
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    console.log(`Checking for sessions between ${tomorrowStart.toISOString()} and ${tomorrowEnd.toISOString()}`);

    // Fetch sessions with patient and clinic info
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessoes")
      .select(`
        id,
        start_time,
        end_time,
        status,
        paciente_id,
        profissional_id,
        servico_id,
        clinic_id,
        pacientes!sessoes_paciente_id_fkey (
          id,
          full_name,
          email,
          phone
        ),
        profiles!sessoes_profissional_id_fkey (
          full_name
        ),
        servicos!sessoes_servico_id_fkey (
          name
        ),
        clinics!sessoes_clinic_id_fkey (
          name,
          phone,
          email
        )
      `)
      .gte("start_time", tomorrowStart.toISOString())
      .lte("start_time", tomorrowEnd.toISOString())
      .in("status", ["agendado", "confirmado"]);

    if (sessionsError) {
      console.error("Error fetching sessions:", sessionsError);
      throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
    }

    console.log(`Found ${sessions?.length || 0} sessions for tomorrow`);

    const results = {
      sent: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const session of sessions || []) {
      try {
        const patient = session.pacientes as any;
        const professional = session.profiles as any;
        const service = session.servicos as any;
        const clinic = session.clinics as any;

        // Skip if no patient email
        if (!patient?.email) {
          console.log(`Skipping session ${session.id}: no patient email`);
          results.skipped++;
          continue;
        }

        const appointmentDate = new Date(session.start_time);
        const formattedDate = appointmentDate.toLocaleDateString("pt-PT", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const formattedTime = appointmentDate.toLocaleTimeString("pt-PT", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="text-align: center; padding-bottom: 30px; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; color: #f59e0b; font-size: 24px;">⏰ Lembrete de Sessão</h1>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 30px 0 20px;">
              <p style="margin: 0; color: #3f3f46; font-size: 16px;">
                Olá <strong>${escapeHtml(patient.full_name)}</strong>,
              </p>
              <p style="margin: 16px 0 0; color: #71717a; font-size: 14px;">
                Este é um lembrete de que tem uma sessão agendada para <strong>amanhã</strong>:
              </p>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef3c7; border-radius: 8px; margin-bottom: 20px; border: 1px solid #fcd34d;">
          <tr>
            <td style="padding: 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding-bottom: 12px;">
                    <span style="color: #92400e; font-size: 12px; text-transform: uppercase;">Data</span>
                    <p style="margin: 4px 0 0; color: #78350f; font-size: 16px; font-weight: 600;">${formattedDate}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 12px;">
                    <span style="color: #92400e; font-size: 12px; text-transform: uppercase;">Hora</span>
                    <p style="margin: 4px 0 0; color: #78350f; font-size: 16px; font-weight: 600;">${formattedTime}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 12px;">
                    <span style="color: #92400e; font-size: 12px; text-transform: uppercase;">Profissional</span>
                    <p style="margin: 4px 0 0; color: #78350f; font-size: 16px; font-weight: 600;">${escapeHtml(professional?.full_name || "A confirmar")}</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span style="color: #92400e; font-size: 12px; text-transform: uppercase;">Serviço</span>
                    <p style="margin: 4px 0 0; color: #78350f; font-size: 16px; font-weight: 600;">${service?.name || "Consulta"}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 20px 0; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; color: #71717a; font-size: 14px;">
                Em caso de impedimento, por favor contacte-nos o mais rapidamente possível.
              </p>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-top: 30px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="margin: 0 0 8px; color: #18181b; font-size: 16px; font-weight: 600;">${clinic?.name || "Clínica"}</p>
              ${clinic?.phone ? `<p style="margin: 0 0 4px; color: #71717a; font-size: 14px;">📞 ${clinic.phone}</p>` : ""}
              ${clinic?.email ? `<p style="margin: 0; color: #71717a; font-size: 14px;">✉️ ${clinic.email}</p>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `;

        await resend.emails.send({
          from: `${clinic?.name || "Clínica"} <onboarding@resend.dev>`,
          to: [patient.email],
          subject: `Lembrete: Sessão amanhã às ${formattedTime}`,
          html: emailHtml,
        });

        console.log(`Reminder sent to ${patient.email} for session ${session.id}`);
        results.sent++;
      } catch (emailError) {
        const errorMsg = emailError instanceof Error ? emailError.message : "Unknown error";
        console.error(`Failed to send reminder for session ${session.id}:`, errorMsg);
        results.errors.push(`Session ${session.id}: ${errorMsg}`);
      }
    }

    console.log(`Reminder batch complete: ${results.sent} sent, ${results.skipped} skipped, ${results.errors.length} errors`);

    return new Response(
      JSON.stringify({ success: true, results }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error in reminder job:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
