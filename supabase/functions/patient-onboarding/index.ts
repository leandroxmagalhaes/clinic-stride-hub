import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper: resolve clinic_id from slug or clinic_id param
async function resolveClinic(
  supabase: any,
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

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Gera (ou reaproveita) o link do questionário clínico e envia-o por email ao utente.
// Devolve o endereço do questionário quando consegue criar/reaproveitar um convite
// (mesmo que o email falhe ou não exista), e null em todos os outros casos.
async function dispararQuestionario(
  supabase: any,
  pacienteId: string,
  clinicId: string
): Promise<string | null> {
  try {
    // 1.1 Paciente
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("full_name, email")
      .eq("id", pacienteId)
      .single();
    if (!paciente) return null;

    // 1.2 Questionário já completo
    const { data: questionarioCompleto } = await supabase
      .from("portal_questionario")
      .select("id")
      .eq("paciente_id", pacienteId)
      .eq("completo", true)
      .limit(1);
    if (questionarioCompleto && questionarioCompleto.length > 0) return null;

    // 1.3 Convite de questionário ativo — reaproveitar
    const { data: conviteAtivo } = await supabase
      .from("portal_convites")
      .select("link_token")
      .eq("paciente_id", pacienteId)
      .eq("tipo", "questionario")
      .eq("utilizado", false)
      .gt("expira_em", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    let linkToken: string;
    if (conviteAtivo && conviteAtivo.length > 0) {
      linkToken = conviteAtivo[0].link_token;
    } else {
      // 1.4 Criar convite novo
      linkToken = crypto.randomUUID();
      const codigo = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
      const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error: inviteError } = await supabase.from("portal_convites").insert({
        paciente_id: pacienteId,
        link_token: linkToken,
        codigo,
        tipo: "questionario",
        expira_em: expiraEm,
      });
      if (inviteError) {
        console.error("dispararQuestionario: erro ao criar convite:", inviteError);
        return null;
      }
    }

    // 1.5 Endereço do questionário
    const linkQuestionario = `https://physione.app/questionario/${linkToken}`;

    // 1.6 Sem email — o link fica apenas disponível na ficha (mas devolve-se o endereço)
    if (!paciente.email) return linkQuestionario;

    // 1.7 Enviar email via Resend (mesmo padrão de send-portal-link-automation)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("dispararQuestionario: RESEND_API_KEY not configured");
      return linkQuestionario;
    }

    const { data: clinic } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", clinicId)
      .single();
    const clinicName = clinic?.name || "Clínica";
    const firstName = escapeHtml(paciente.full_name?.split(" ")[0] || "Utente");

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;">
  <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
    <h1 style="color:#3b82f6;margin:0 0 6px;font-size:20px;">${escapeHtml(clinicName)}</h1>
    <p style="color:#64748b;margin:0 0 24px;font-size:13px;">Questionário clínico</p>
    <p style="line-height:1.6;color:#0f172a;font-size:15px;margin:0 0 16px;">Olá, ${firstName}!</p>
    <p style="line-height:1.6;color:#0f172a;font-size:15px;margin:0 0 16px;">Obrigado por concluir o seu pré-registo. Antes da sua primeira consulta, precisamos que preencha um questionário clínico curto — leva apenas alguns minutos e ajuda-nos a preparar melhor a sua avaliação.</p>
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${linkQuestionario}" style="display:inline-block;background:#3b82f6;color:#fff;padding:13px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Preencher questionário</a>
    </div>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Se o botão não funcionar, copie este endereço:</p>
    <p style="color:#3b82f6;font-size:12px;word-break:break-all;">${linkQuestionario}</p>
    <p style="color:#94a3b8;font-size:12px;margin-top:16px;">Este link é válido durante sete dias e só pode ser usado uma vez.</p>
  </div>
</body></html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${clinicName} <noreply@respiraedesenvolve.com>`,
        to: [paciente.email],
        subject: "Questionário clínico da sua primeira consulta",
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error(`dispararQuestionario: resend ${resendRes.status}: ${errBody}`);
    }

    return linkQuestionario;
  } catch (err) {
    console.error("dispararQuestionario error:", err);
    return null;
  }
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
          "health_insurance",
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

        // Gerar link do questionário clínico e enviar por email (anti-dup interno)
        const questionarioUrl = await dispararQuestionario(supabase, newPatient.id, clinic.id);

        return new Response(
          JSON.stringify({ success: true, patient_id: newPatient.id, questionario_url: questionarioUrl }),
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
          health_insurance,
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
        "health_insurance",
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

      // Gerar link do questionário clínico e enviar por email (anti-dup interno)
      const { data: utenteAtualizado } = await supabase
        .from("pacientes")
        .select("id, clinic_id")
        .eq("public_token", token)
        .single();
      let questionarioUrl: string | null = null;
      if (utenteAtualizado) {
        questionarioUrl = await dispararQuestionario(supabase, utenteAtualizado.id, utenteAtualizado.clinic_id);
      }

      return new Response(
        JSON.stringify({ success: true, questionario_url: questionarioUrl }),
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
