import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(unsafe: string): string {
  return String(unsafe ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const TIPO_CASO_VALIDOS = ["respiratorio", "motora", "neurodesenvolvimento", "vestibular"];

const TIPO_CASO_LABEL: Record<string, string> = {
  respiratorio: "Respiratório",
  motora: "Motora",
  neurodesenvolvimento: "Neurodesenvolvimento",
  vestibular: "Vestibular",
};

function calcularIdade(dataNascISO: string): number {
  const nasc = new Date(dataNascISO);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

function faixaEtariaDe(idade: number): string {
  if (idade < 2) return "bebe";
  if (idade < 12) return "crianca";
  if (idade < 65) return "adulto";
  return "idoso";
}

function bad(msg: string) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status: 400,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Método não suportado" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    let body: any = {};
    try { body = await req.json(); } catch { return bad("Corpo JSON inválido"); }

    // Honeypot
    if (body.website && String(body.website).trim() !== "") {
      return new Response(JSON.stringify({ success: false }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const nome_paciente = String(body.nome_paciente ?? "").trim();
    const data_nascimento = String(body.data_nascimento ?? "").trim();
    const nome_responsavel = String(body.nome_responsavel ?? "").trim();
    const telefone = String(body.telefone ?? "").trim();
    const email = String(body.email ?? "").trim();
    const tipo_caso = String(body.tipo_caso ?? "").trim();
    const urgente = Boolean(body.urgente);
    const motivo_urgencia = String(body.motivo_urgencia ?? "").trim();
    const observacoes = String(body.observacoes ?? "").trim();

    if (!nome_paciente) return bad("nome_paciente é obrigatório");
    if (!data_nascimento) return bad("data_nascimento é obrigatória");
    if (!telefone) return bad("telefone é obrigatório");
    if (!email) return bad("email é obrigatório");

    const nasc = new Date(data_nascimento);
    if (isNaN(nasc.getTime())) return bad("data_nascimento inválida");
    const agora = new Date();
    if (nasc > agora) return bad("data_nascimento não pode ser futura");
    const limite = new Date();
    limite.setFullYear(limite.getFullYear() - 120);
    if (nasc < limite) return bad("data_nascimento demasiado antiga");

    if (!TIPO_CASO_VALIDOS.includes(tipo_caso)) {
      return bad("tipo_caso inválido");
    }

    const idade = calcularIdade(data_nascimento);
    if (idade < 18 && !nome_responsavel) {
      return bad("nome_responsavel é obrigatório para menores de 18");
    }
    if (urgente && !motivo_urgencia) {
      return bad("motivo_urgencia é obrigatório quando urgente");
    }

    const limites: Array<[string, string, number]> = [
      ["nome_paciente", nome_paciente, 500],
      ["nome_responsavel", nome_responsavel, 500],
      ["telefone", telefone, 500],
      ["email", email, 500],
      ["observacoes", observacoes, 2000],
      ["motivo_urgencia", motivo_urgencia, 2000],
    ];
    for (const [k, v, max] of limites) {
      if (v.length > max) return bad(`${k} excede ${max} caracteres`);
    }

    const faixa_etaria = faixaEtariaDe(idade);

    // Buscar primeira clínica
    const { data: clinicRow, error: clinicErr } = await supabase
      .from("clinics")
      .select("id, name, email")
      .limit(1)
      .maybeSingle();
    if (clinicErr || !clinicRow) {
      return new Response(JSON.stringify({ success: false, error: "Clínica não encontrada" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const clinic_id = clinicRow.id;
    const clinicName = clinicRow.name || "Respira & Desenvolve";
    const clinicEmail = clinicRow.email as string | null;

    // Inserir solicitação (individual)
    const { data: inserted, error: insertErr } = await supabase
      .from("solicitacoes_vaga")
      .insert({
        clinic_id,
        nome_paciente,
        data_nascimento,
        faixa_etaria,
        nome_responsavel: nome_responsavel || null,
        telefone,
        email,
        tipo_caso,
        urgente,
        motivo_urgencia: motivo_urgencia || null,
        observacoes: observacoes || null,
        estado: "nova",
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("solicitar-vaga insert error:", insertErr);
      return new Response(JSON.stringify({ success: false, error: "Erro ao gravar pedido" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const tipoLabel = TIPO_CASO_LABEL[tipo_caso] || tipo_caso;

    // Buscar email de destino para aviso
    let avisoEmail: string | null = null;
    try {
      const { data: settings } = await supabase
        .from("clinic_settings")
        .select("solicitacao_vaga_email")
        .eq("clinic_id", clinic_id)
        .maybeSingle();
      avisoEmail = (settings as any)?.solicitacao_vaga_email || null;
    } catch (_) { /* ignore */ }
    if (!avisoEmail) avisoEmail = clinicEmail;

    // Envio de emails (best-effort)
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      // Email de confirmação ao requerente
      try {
        const confirmHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:20px;">
    <tr><td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e4e4e7;">
        <h1 style="margin:0;color:#be123c;font-size:22px;">${escapeHtml(clinicName)}</h1>
      </div>
      <div style="padding:24px 0 8px;">
        <p style="margin:0 0 12px;color:#3f3f46;font-size:15px;line-height:1.6;">Olá,</p>
        <p style="margin:0 0 12px;color:#3f3f46;font-size:15px;line-height:1.6;">Recebemos o seu pedido de vaga. A nossa equipa vai analisar a informação e entrará em contacto brevemente.</p>
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:8px;margin:16px 0;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 10px;color:#78350f;font-size:15px;"><strong>Utente:</strong> ${escapeHtml(nome_paciente)}</p>
          <p style="margin:0 0 10px;color:#78350f;font-size:15px;"><strong>Tipo de caso:</strong> ${escapeHtml(tipoLabel)}</p>
          <p style="margin:0;color:#78350f;font-size:15px;"><strong>Urgente:</strong> ${urgente ? "Sim" : "Não"}</p>
        </td></tr>
      </table>
      <div style="padding-top:20px;border-top:1px solid #e4e4e7;text-align:center;">
        <p style="margin:0;color:#18181b;font-size:16px;font-weight:600;">${escapeHtml(clinicName)}</p>
      </div>
    </td></tr>
  </table>
</body></html>`;
        await resend.emails.send({
          from: `${clinicName} <noreply@respiraedesenvolve.com>`,
          to: [email],
          subject: `${clinicName} — Pedido de vaga recebido`,
          html: confirmHtml,
        });
      } catch (e) {
        console.error("confirm email failed:", e);
      }

      // Email de aviso interno
      if (avisoEmail) {
        try {
          const subject = `${urgente ? "URGENTE — " : ""}Novo pedido de vaga: ${nome_paciente}`;
          const avisoHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:20px;">
    <tr><td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
      <h1 style="margin:0 0 16px;color:#be123c;font-size:20px;">Novo pedido de vaga${urgente ? " (URGENTE)" : ""}</h1>
      <ul style="color:#3f3f46;font-size:14px;line-height:1.7;padding-left:18px;">
        <li><strong>Utente:</strong> ${escapeHtml(nome_paciente)}</li>
        <li><strong>Data de nascimento:</strong> ${escapeHtml(data_nascimento)} (${idade} anos, ${escapeHtml(faixa_etaria)})</li>
        <li><strong>Responsável:</strong> ${escapeHtml(nome_responsavel || "—")}</li>
        <li><strong>Telefone:</strong> ${escapeHtml(telefone)}</li>
        <li><strong>Email:</strong> ${escapeHtml(email)}</li>
        <li><strong>Tipo de caso:</strong> ${escapeHtml(tipoLabel)}</li>
        <li><strong>Urgente:</strong> ${urgente ? "Sim" : "Não"}</li>
        ${urgente ? `<li><strong>Motivo da urgência:</strong> ${escapeHtml(motivo_urgencia)}</li>` : ""}
        <li><strong>Observações:</strong> ${escapeHtml(observacoes || "—")}</li>
      </ul>
    </td></tr>
  </table>
</body></html>`;
          await resend.emails.send({
            from: `${clinicName} <noreply@respiraedesenvolve.com>`,
            to: [avisoEmail],
            subject,
            html: avisoHtml,
          });
        } catch (e) {
          console.error("aviso email failed:", e);
        }
      }
    }

    // Notificação (individual)
    try {
      await supabase.from("notifications").insert({
        clinic_id,
        type: "solicitacao_vaga",
        title: "Novo pedido de vaga",
        message: `${nome_paciente} — ${tipoLabel}${urgente ? " (URGENTE)" : ""}`,
        read: false,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("notification insert failed:", e);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("solicitar-vaga error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
