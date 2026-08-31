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

function normalizar(texto: string): string {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;:!?()[\]{}'"]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

const CAMPOS_DO_CADASTRO = new Set([
  "nome",
  "nome completo",
  "nome do utente",
  "nome do paciente",
  "nome da crianca",
  "data de nascimento",
  "data nascimento",
  "genero",
  "sexo",
  "nif",
  "numero de contribuinte",
  "contribuinte",
  "cpf",
  "telefone",
  "telemovel",
  "contacto telefonico",
  "contacto",
  "email",
  "correio eletronico",
  "morada",
  "endereco",
  "codigo postal",
  "localidade",
  "contacto de emergencia",
  "telefone de emergencia",
  "pessoa de contacto em emergencia",
  "seguradora",
  "entidade",
  "seguro de saude",
  "subsistema de saude",
]);

function limparSchema(schema: any): any {
  if (!schema || !Array.isArray(schema.sections)) return schema;
  const sections = schema.sections
    .map((section: any) => {
      const fields = (section.fields || []).filter((field: any) => {
        const labelNorm = normalizar(field?.label || "");
        const keyNorm = normalizar(field?.key || "");
        return !CAMPOS_DO_CADASTRO.has(labelNorm) && !CAMPOS_DO_CADASTRO.has(keyNorm);
      });
      return { ...section, fields };
    })
    .filter((section: any) => {
      const temCampos = Array.isArray(section.fields) && section.fields.length > 0;
      const temTexto = Boolean(section.intro || section.description);
      return temCampos || temTexto;
    });
  return { ...schema, sections };
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
      let clinicPrimaryColor: string | null = null;
      if (patient.clinic_id) {
        const { data: clinic } = await admin
          .from("clinics")
          .select("name")
          .eq("id", patient.clinic_id)
          .maybeSingle();
        clinicName = clinic?.name ?? null;

        const { data: settings } = await admin
          .from("clinic_settings")
          .select("primary_color")
          .eq("clinic_id", patient.clinic_id)
          .maybeSingle();
        clinicPrimaryColor = (settings as any)?.primary_color ?? null;
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
          clinic_primary_color: clinicPrimaryColor,
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

      const templateLimpo = { ...template, schema: limparSchema(template.schema) };

      return new Response(
        JSON.stringify({ template: templateLimpo }),
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

      const { data: existing, error: existErr } = await admin
        .from("portal_questionario")
        .select("id")
        .eq("paciente_id", invite.paciente_id)
        .eq("template_id", template.id)
        .maybeSingle();
      if (existErr) throw new Error(existErr.message);

      const agora = new Date().toISOString();

      if (existing) {
        const { error: updQErr } = await admin
          .from("portal_questionario")
          .update({
            template_id: template.id,
            perfil_tipo: template.identifier,
            respostas: answers,
            completo: true,
            updated_at: agora,
          })
          .eq("id", existing.id);
        if (updQErr) throw new Error(updQErr.message);
      } else {
        const { error: insErr } = await admin
          .from("portal_questionario")
          .insert({
            paciente_id: invite.paciente_id,
            template_id: template.id,
            perfil_tipo: template.identifier,
            respostas: answers,
            completo: true,
            updated_at: agora,
          });
        if (insErr) throw new Error(insErr.message);
      }

      const { error: updErr } = await admin
        .from("portal_convites")
        .update({ utilizado: true })
        .eq("id", invite.id);
      if (updErr) throw new Error(updErr.message);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida");
  } catch (err) {
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error
            ? err.message
            : (err as any)?.message ?? String(err),
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
