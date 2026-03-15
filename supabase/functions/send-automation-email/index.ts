import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { flowId, pacienteId, sessaoId, triggerType, clinicId } = await req.json();
    console.log('DEBUG body:', { flowId, pacienteId, sessaoId, triggerType, clinicId });

    if (!flowId || !pacienteId || !clinicId) {
      throw new Error("Missing required fields: flowId, pacienteId, clinicId");
    }

    // Fetch the automation flow
    const { data: flow, error: flowError } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("id", flowId)
      .single();
    if (flowError || !flow) throw new Error("Flow not found: " + (flowError?.message || ""));
    console.log('DEBUG flow:', JSON.stringify(flow));

    // Fetch patient
    const { data: patient, error: patientError } = await supabase
      .from("pacientes")
      .select("full_name, email, phone")
      .eq("id", pacienteId)
      .single();
    if (patientError || !patient) throw new Error("Patient not found");

    if (!patient.email) {
      // No email — skip silently, log as skipped
      await supabase.from("automation_logs").insert({
        clinic_id: clinicId,
        flow_id: flowId,
        paciente_id: pacienteId,
        sessao_id: sessaoId || null,
        trigger_type: triggerType,
        channel: "email",
        recipient_email: null,
        subject: flow.name,
        status: "skipped",
        error_message: "Patient has no email",
      });
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch clinic name
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", clinicId)
      .single();
    const clinicName = clinic?.name || "Clínica";

    // Fetch session data if provided
    let sessionDate = "";
    let sessionTime = "";
    let professionalName = "";
    let serviceName = "";

    if (sessaoId) {
      const { data: session } = await supabase
        .from("sessoes")
        .select("start_time, profissional_id, servico_id")
        .eq("id", sessaoId)
        .single();

      if (session) {
        const dt = new Date(session.start_time);
        sessionDate = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
        sessionTime = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;

        if (session.profissional_id) {
          const { data: prof } = await supabase
            .from("profissionais")
            .select("full_name")
            .eq("id", session.profissional_id)
            .single();
          professionalName = prof?.full_name || "";
        }

        if (session.servico_id) {
          const { data: serv } = await supabase
            .from("servicos")
            .select("name")
            .eq("id", session.servico_id)
            .single();
          serviceName = serv?.name || "";
        }
      }
    }

    // Process template
    let processedMessage = flow.message_template
      .replace(/\{\{nome_paciente\}\}/gi, patient.full_name)
      .replace(/\{\{patient_name\}\}/gi, patient.full_name)
      .replace(/\{\{data_sessao\}\}/gi, sessionDate)
      .replace(/\{\{date\}\}/gi, sessionDate)
      .replace(/\{\{hora_sessao\}\}/gi, sessionTime)
      .replace(/\{\{time\}\}/gi, sessionTime)
      .replace(/\{\{profissional\}\}/gi, professionalName)
      .replace(/\{\{professional\}\}/gi, professionalName)
      .replace(/\{\{professional_name\}\}/gi, professionalName)
      .replace(/\{\{servico\}\}/gi, serviceName)
      .replace(/\{\{service\}\}/gi, serviceName)
      .replace(/\{\{clinica\}\}/gi, clinicName)
      .replace(/\{\{clinic_name\}\}/gi, clinicName);

    // Wrap in HTML
    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #10B981; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 20px;">${clinicName}</h1>
  </div>
  <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="white-space: pre-line; line-height: 1.6;">${processedMessage}</div>
  </div>
  <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
    Enviado automaticamente por ${clinicName}
  </p>
</body>
</html>`;

    // Send email via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${clinicName} <noreply@respiraedesenvolve.com>`,
        to: [patient.email],
        subject: flow.name,
        html: htmlBody,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      const errorMsg = resendData?.message || JSON.stringify(resendData);
      // Log error
      await supabase.from("automation_logs").insert({
        clinic_id: clinicId,
        flow_id: flowId,
        paciente_id: pacienteId,
        sessao_id: sessaoId || null,
        trigger_type: triggerType,
        channel: "email",
        recipient_email: patient.email,
        subject: flow.name,
        status: "error",
        error_message: errorMsg,
      });
      throw new Error(`Resend API error [${resendRes.status}]: ${errorMsg}`);
    }

    // Log success
    await supabase.from("automation_logs").insert({
      clinic_id: clinicId,
      flow_id: flowId,
      paciente_id: pacienteId,
      sessao_id: sessaoId || null,
      trigger_type: triggerType,
      channel: "email",
      recipient_email: patient.email,
      subject: flow.name,
      status: "sent",
    });

    return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in send-automation-email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
