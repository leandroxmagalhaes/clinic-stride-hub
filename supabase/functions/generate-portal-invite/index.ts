import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateToken(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (const byte of arr) result += chars[byte % chars.length];
  return result;
}

function generateCode(): string {
  const arr = new Uint8Array(3);
  crypto.getRandomValues(arr);
  const num = ((arr[0] << 16) | (arr[1] << 8) | arr[2]) % 900000 + 100000;
  return String(num);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { paciente_id, email, telefone, template_id } = await req.json();
    if (!paciente_id) throw new Error("paciente_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Invalidate previous invites
    await supabase
      .from("portal_convites")
      .update({ utilizado: true })
      .eq("paciente_id", paciente_id)
      .eq("utilizado", false);

    const link_token = generateToken(16);
    const codigo = generateCode();
    const expira_em = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("portal_convites").insert({
      paciente_id,
      codigo,
      link_token,
      enviado_para_email: email || null,
      enviado_para_telefone: telefone || null,
      expira_em,
      template_id: template_id || null,
    });

    if (insertError) throw insertError;

    // Get patient name for email
    const { data: patient } = await supabase
      .from("pacientes")
      .select("full_name, clinic_id")
      .eq("id", paciente_id)
      .single();

    let clinicName = "Clínica";
    if (patient?.clinic_id) {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("name")
        .eq("id", patient.clinic_id)
        .single();
      if (clinic?.name) clinicName = clinic.name;
    }

    const baseUrl = "https://clinic-stride-hub.lovable.app";
    const link = `${baseUrl}/portal/${link_token}`;

    // Send email if we have an email and Resend key
    if (email && resendKey) {
      const firstName = patient?.full_name?.split(" ")[0] || "Paciente";
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${clinicName} <noreply@respiraedesenvolve.com>`,
          to: [email],
          subject: `${clinicName} — Acesso ao Portal do Paciente`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
              <h2 style="color:#1e40af">Portal do Paciente</h2>
              <p>Olá <strong>${firstName}</strong>,</p>
              <p>A sua clínica <strong>${clinicName}</strong> convidou-o(a) a aceder ao Portal do Paciente.</p>
              <p>O seu código de verificação é:</p>
              <div style="background:#f0f4ff;border-radius:12px;padding:20px;text-align:center;margin:16px 0">
                <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1e40af">${codigo}</span>
              </div>
              <p>Clique no botão abaixo para aceder:</p>
              <a href="${link}" style="display:inline-block;background:#1e40af;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Aceder ao Portal</a>
              <p style="color:#666;font-size:12px;margin-top:24px">Este código expira em 48 horas. Máximo 3 tentativas.</p>
            </div>
          `,
        }),
      });
    }

    return new Response(JSON.stringify({ link, codigo, expira_em }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
