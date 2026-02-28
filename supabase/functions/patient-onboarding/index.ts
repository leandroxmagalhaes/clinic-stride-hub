import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper: resolve clinic_id from slug or clinic_id param
async function resolveClinic(
  supabase: ReturnType<typeof createClient>,
  slug: string | null,
  clinicId: string | null
): Promise<{ id: string; name: string; logo_url: string; primary_color: string } | null> {
  let resolvedId: string | null = null;

  if (slug) {
    const { data } = await supabase
      .from("clinics")
      .select("id, name, logo_url")
      .eq("slug", slug)
      .single();
    if (!data) return null;
    resolvedId = data.id;
  } else if (clinicId) {
    if (!uuidRegex.test(clinicId)) return null;
    const { data } = await supabase
      .from("clinics")
      .select("id, name, logo_url")
      .eq("id", clinicId)
      .single();
    if (!data) return null;
    resolvedId = data.id;
  }

  if (!resolvedId) return null;

  // Fetch clinic info we already have
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, logo_url")
    .eq("id", resolvedId)
    .single();

  // Fetch primary_color from clinic_settings
  const { data: settings } = await supabase
    .from("clinic_settings")
    .select("primary_color")
    .eq("clinic_id", resolvedId)
    .maybeSingle();

  if (!clinic) return null;

  return {
    id: clinic.id,
    name: clinic.name || "",
    logo_url: clinic.logo_url || "",
    primary_color: settings?.primary_color || "#10B981",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const clinicIdParam = url.searchParams.get("clinic_id");
    const slugParam = url.searchParams.get("slug");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── MODE: New patient via slug or clinic_id ──
    if ((clinicIdParam || slugParam) && !token) {
      const clinic = await resolveClinic(supabase, slugParam, clinicIdParam);

      if (!clinic) {
        return new Response(JSON.stringify({ error: "Clínica não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (req.method === "GET") {
        return new Response(
          JSON.stringify({
            patient: null,
            clinic: { name: clinic.name, logo_url: clinic.logo_url, primary_color: clinic.primary_color },
            clinic_id: clinic.id,
            mode: "new",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (req.method === "POST") {
        const body = await req.json();

        // Validate required fields
        if (!body.full_name?.trim()) {
          return new Response(
            JSON.stringify({ error: "Nome completo é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (!body.data_consent) {
          return new Response(
            JSON.stringify({ error: "O consentimento de dados é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (!body.phone?.trim()) {
          return new Response(
            JSON.stringify({ error: "Telemóvel é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Validate NIF if provided
        if (body.cpf && !/^\d{9}$/.test(body.cpf.replace(/\s/g, ""))) {
          return new Response(
            JSON.stringify({ error: "NIF deve conter 9 dígitos numéricos" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const allowedFields = [
          "full_name", "birth_date", "gender", "cpf", "phone", "email",
          "height_cm", "weight_kg",
          "emergency_contact", "emergency_phone",
          "billing_name", "billing_nif", "billing_address",
          "image_consent", "data_consent",
        ];

        const insertData: Record<string, unknown> = { clinic_id: clinic.id };
        for (const field of allowedFields) {
          if (body[field] !== undefined) {
            insertData[field] = body[field];
          }
        }
        insertData.onboarding_completed_at = new Date().toISOString();

        const { data: newPatient, error } = await supabase.from("pacientes").insert(insertData).select("id").single();

        if (error || !newPatient) {
          console.error("Insert error:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao criar registo" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Insert notification for the clinic
        await supabase.from("notifications").insert({
          clinic_id: clinic.id,
          type: "new_patient",
          title: "Novo utente registado",
          message: `${body.full_name} submeteu o pré-registo`,
          patient_id: newPatient.id,
          read: false,
          created_at: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({ success: true, patient_id: newPatient.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── MODE: Existing patient (token) ──
    if (!token) {
      return new Response(JSON.stringify({ error: "Token ou clinic_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!uuidRegex.test(token)) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

      let clinicInfo = { name: "", logo_url: "", primary_color: "#10B981" };
      if (data.clinic_id) {
        const resolved = await resolveClinic(supabase, null, data.clinic_id);
        if (resolved) {
          clinicInfo = { name: resolved.name, logo_url: resolved.logo_url, primary_color: resolved.primary_color };
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

      if (!body.data_consent) {
        return new Response(
          JSON.stringify({ error: "O consentimento de dados é obrigatório" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (body.cpf && !/^\d{9}$/.test(body.cpf.replace(/\s/g, ""))) {
        return new Response(
          JSON.stringify({ error: "NIF deve conter 9 dígitos numéricos" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

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
