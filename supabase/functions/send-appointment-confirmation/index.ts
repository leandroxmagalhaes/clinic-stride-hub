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

interface AppointmentConfirmationRequest {
  patientEmail: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  professionalName: string;
  serviceName: string;
  clinicName: string;
  clinicPhone?: string;
  clinicEmail?: string;
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

    // Authenticate caller — only logged-in clinic staff can trigger this
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const resend = new Resend(resendApiKey);

    const body: AppointmentConfirmationRequest = await req.json();
    const {
      patientEmail,
      patientName,
      appointmentDate,
      appointmentTime,
      professionalName,
      serviceName,
      clinicName,
      clinicPhone,
      clinicEmail,
    } = body;

    // Validate required fields
    if (!patientEmail || !patientName || !appointmentDate || !appointmentTime) {
      throw new Error("Missing required fields");
    }

    console.log(`Sending appointment confirmation to ${patientEmail}`);

    // Format date for display
    const formattedDate = new Date(appointmentDate).toLocaleDateString("pt-PT", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de Agendamento</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <!-- Header -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="text-align: center; padding-bottom: 30px; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; color: #0d9488; font-size: 24px;">✓ Agendamento Confirmado</h1>
            </td>
          </tr>
        </table>

        <!-- Greeting -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 30px 0 20px;">
              <p style="margin: 0; color: #3f3f46; font-size: 16px;">
                Olá <strong>${escapeHtml(patientName)}</strong>,
              </p>
              <p style="margin: 16px 0 0; color: #71717a; font-size: 14px;">
                O seu agendamento foi confirmado com sucesso. Seguem os detalhes:
              </p>
            </td>
          </tr>
        </table>

        <!-- Appointment Details -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; border-radius: 8px; margin-bottom: 20px;">
          <tr>
            <td style="padding: 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding-bottom: 12px;">
                    <span style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Data</span>
                    <p style="margin: 4px 0 0; color: #18181b; font-size: 16px; font-weight: 600;">${formattedDate}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 12px;">
                    <span style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Hora</span>
                    <p style="margin: 4px 0 0; color: #18181b; font-size: 16px; font-weight: 600;">${appointmentTime}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 12px;">
                    <span style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Profissional</span>
                    <p style="margin: 4px 0 0; color: #18181b; font-size: 16px; font-weight: 600;">${escapeHtml(professionalName || "A confirmar")}</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Serviço</span>
                    <p style="margin: 4px 0 0; color: #18181b; font-size: 16px; font-weight: 600;">${escapeHtml(serviceName || "Consulta")}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Notes -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 20px 0; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0 0 8px; color: #3f3f46; font-size: 14px; font-weight: 600;">Lembrete importante:</p>
              <ul style="margin: 0; padding-left: 20px; color: #71717a; font-size: 14px;">
                <li style="margin-bottom: 8px;">Chegue com 10 minutos de antecedência</li>
                <li style="margin-bottom: 8px;">Traga documentos de identificação</li>
                <li>Em caso de impedimento, avise com pelo menos 24h de antecedência</li>
              </ul>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-top: 30px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="margin: 0 0 8px; color: #18181b; font-size: 16px; font-weight: 600;">${escapeHtml(clinicName || "Clínica")}</p>
              ${clinicPhone ? `<p style="margin: 0 0 4px; color: #71717a; font-size: 14px;">📞 ${escapeHtml(clinicPhone)}</p>` : ""}
              ${clinicEmail ? `<p style="margin: 0; color: #71717a; font-size: 14px;">✉️ ${escapeHtml(clinicEmail)}</p>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: `${clinicName || "Clínica"} <onboarding@resend.dev>`,
      to: [patientEmail],
      subject: `Confirmação de Agendamento - ${formattedDate} às ${appointmentTime}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error sending appointment confirmation:", error);
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
