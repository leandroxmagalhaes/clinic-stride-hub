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
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("pacientes")
        .select(`
          full_name, birth_date, gender, cpf, phone, email,
          height_cm, weight_kg,
          emergency_contact, emergency_phone,
          billing_name, billing_nif, billing_address,
          image_consent, data_consent,
          onboarding_completed_at,
          clinic_id
        `)
        .eq("public_token", token)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Utente não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch clinic info for logo/name
      let clinicInfo = { name: "", logo_url: "" };
      if (data.clinic_id) {
        const { data: clinic } = await supabase
          .from("clinics")
          .select("name, logo_url")
          .eq("id", data.clinic_id)
          .single();
        if (clinic) {
          clinicInfo = { name: clinic.name || "", logo_url: clinic.logo_url || "" };
        }
      }

      const { clinic_id, ...patientData } = data;

      return new Response(
        JSON.stringify({ patient: patientData, clinic: clinicInfo }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();

      // Validate required fields
      if (!body.data_consent) {
        return new Response(
          JSON.stringify({ error: "O consentimento de dados é obrigatório" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate NIF format if provided
      if (body.cpf && !/^\d{9}$/.test(body.cpf.replace(/\s/g, ""))) {
        return new Response(
          JSON.stringify({ error: "NIF deve conter 9 dígitos numéricos" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Build update object with only allowed fields
      const allowedFields = [
        "full_name", "birth_date", "gender", "cpf", "phone", "email",
        "height_cm", "weight_kg",
        "emergency_contact", "emergency_phone",
        "billing_name", "billing_nif", "billing_address",
        "image_consent", "data_consent",
      ];

      const updateData: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }
      updateData.onboarding_completed_at = new Date().toISOString();

      const { error } = await supabase
        .from("pacientes")
        .update(updateData)
        .eq("public_token", token);

      if (error) {
        return new Response(
          JSON.stringify({ error: "Erro ao atualizar dados" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
