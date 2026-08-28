import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function identifierForBirthDate(birthDate: string | null): string {
  if (!birthDate) return "template_adult";
  const bd = new Date(birthDate);
  if (isNaN(bd.getTime())) return "template_adult";
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
  if (age < 2) return "template_baby_complete";
  if (age < 12) return "template_child";
  if (age >= 65) return "template_elderly";
  return "template_adult";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, token, answers, template_id } = await req.json();
    if (!token) throw new Error("Link inválido");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Common token validation
    const { data: invite, error: invErr } = await admin
      .from("portal_convites")
      .select("*")
      .eq("link_token", token)
      .maybeSingle();

    if (invErr || !invite) throw new Error("Link inválido");
    if (invite.tipo !== "questionario") throw new Error("Link inválido");
    if (invite.utilizado) throw new Error("Este questionário já foi preenchido");
    if (new Date(invite.expira_em) < new Date()) throw new Error("Este link expirou");

    // Patient
    const { data: patient } = await admin
      .from("pacientes")
      .select("full_name, birth_date, cpf, phone, email, gender, health_insurance, clinic_id")
      .eq("id", invite.paciente_id)
      .single();

    if (!patient) throw new Error("Link inválido");

    if (action === "load") {
      const { data: templates } = await admin
        .from("portal_questionario_templates")
        .select("id, identifier, name, description, estimated_minutes")
        .eq("is_active", true)
        .order("name", { ascending: true });

      const suggestedIdentifier = identifierForBirthDate(patient.birth_date);

      let clinicName: string | null = null;
      if (patient.clinic_id) {
        const { data: clinic } = await admin
          .from("clinics")
          .select("name")
          .eq("id", patient.clinic_id)
          .maybeSingle();
        clinicName = clinic?.name ?? null;
      }

      return new Response(
        JSON.stringify({
          patient: {
            full_name: patient.full_name,
            birth_date: patient.birth_date,
            cpf: patient.cpf,
            phone: patient.phone,
            email: patient.email,
            gender: patient.gender,
            health_insurance: patient.health_insurance,
          },
          templates: templates || [],
          suggested_identifier: suggestedIdentifier,
          clinic_name: clinicName,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "template") {
      if (!template_id) throw new Error("Questionário não disponível");

      const { data: template } = await admin
        .from("portal_questionario_templates")
        .select("id, identifier, name, description, estimated_minutes, schema")
        .eq("id", template_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!template) throw new Error("Questionário não disponível");

      return new Response(
        JSON.stringify({ template }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "submit") {
      if (!answers || typeof answers !== "object" || Object.keys(answers).length === 0) {
        throw new Error("Respostas em falta");
      }

      let template: any = null;
      if (template_id) {
        const { data } = await admin
          .from("portal_questionario_templates")
          .select("id, identifier")
          .eq("id", template_id)
          .eq("is_active", true)
          .maybeSingle();
        template = data;
      }
      if (!template) {
        const identifier = identifierForBirthDate(patient.birth_date);
        const { data } = await admin
          .from("portal_questionario_templates")
          .select("id, identifier")
          .eq("identifier", identifier)
          .eq("is_active", true)
          .maybeSingle();
        template = data;
      }
      if (!template) throw new Error("Questionário não disponível");

      const { error: rpcErr } = await admin.rpc("upsert_portal_questionnaire", {
        p_paciente_id: invite.paciente_id,
        p_template_id: template.id,
        p_perfil_tipo: template.identifier,
        p_respostas: answers,
        p_completo: true,
        p_link_token: token,
      });
      if (rpcErr) throw rpcErr;

      const { error: updErr } = await admin
        .from("portal_convites")
        .update({ utilizado: true })
        .eq("id", invite.id);
      if (updErr) throw updErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida");
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
