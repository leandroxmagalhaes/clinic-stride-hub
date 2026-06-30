import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_BASE = "https://physione.app";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function redirectTo(path: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${APP_BASE}${path}`,
      ...corsHeaders,
    },
  });
}

function isUuid(s: string | null): s is string {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const accao = url.searchParams.get("accao");
    const confirmar = url.searchParams.get("confirmar") === "1";

    if (!isUuid(token) || (accao !== "confirmar" && accao !== "remarcar")) {
      return redirectTo("/r?e=erro");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: session, error } = await supabase
      .from("sessoes")
      .select(`
        id, start_time, status, clinic_id, paciente_id, confirmacao_estado,
        pacientes!sessoes_paciente_id_fkey ( full_name ),
        profiles!sessoes_profissional_id_fkey ( full_name ),
        servicos!sessoes_servico_id_fkey ( name ),
        clinics!sessoes_clinic_id_fkey ( name, phone, email )
      `)
      .eq("confirmation_token", token)
      .maybeSingle();

    if (error || !session) {
      return redirectTo("/r?e=erro");
    }

    const s: any = session;
    const patient = s.pacientes;
    const professional = s.profiles;
    const service = s.servicos;
    const clinic = s.clinics;
    const clinicName = clinic?.name || "Clinica";
    const clinicEmail = clinic?.email || "";
    const patientName = patient?.full_name || "";

    const apt = new Date(s.start_time);
    const tz = "Europe/Lisbon";
    const dataFormatada = apt.toLocaleDateString("pt-PT", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz,
    });
    const horaFormatada = apt.toLocaleTimeString("pt-PT", {
      hour: "2-digit", minute: "2-digit", timeZone: tz,
    });

    // === CONFIRMAR ===
    if (accao === "confirmar") {
      if (s.status === "cancelado") {
        return redirectTo("/r?e=remarcado");
      }

      if (s.confirmacao_estado === "confirmado") {
        return redirectTo("/r?e=ja-confirmado");
      }

      await supabase
        .from("sessoes")
        .update({ confirmacao_estado: "confirmado", confirmacao_em: new Date().toISOString() })
        .eq("id", s.id);

      return redirectTo("/r?e=confirmado");
    }

    // === REMARCAR ===
    if (!confirmar) {
      return redirectTo(`/r-confirmar?token=${encodeURIComponent(token!)}`);
    }

    if (s.status === "cancelado") {
      return redirectTo("/r?e=remarcado");
    }

    if (s.confirmacao_estado !== "remarcacao") {
      await supabase
        .from("sessoes")
        .update({
          status: "cancelado",
          confirmacao_estado: "remarcacao",
          confirmacao_em: new Date().toISOString(),
        })
        .eq("id", s.id);

      await supabase.from("notifications").insert({
        clinic_id: s.clinic_id,
        type: "remarcacao",
        title: "Pedido de remarcacao",
        message: `${patientName} pediu para remarcar a consulta de ${dataFormatada} as ${horaFormatada}.`,
        patient_id: s.paciente_id,
        read: false,
      });

      try {
        const { data: settings } = await supabase
          .from("clinic_settings")
          .select("notificar_clinica_email_remarcacao")
          .eq("clinic_id", s.clinic_id)
          .maybeSingle();

        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (settings?.notificar_clinica_email_remarcacao && clinicEmail && resendKey) {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: `${clinicName} <noreply@respiraedesenvolve.com>`,
            to: [clinicEmail],
            subject: `Pedido de remarcacao - ${patientName}`,
            html: `<p><strong>${esc(patientName)}</strong> pediu para remarcar a consulta de <strong>${esc(dataFormatada)}</strong> as <strong>${esc(horaFormatada)}</strong>.</p><p>Servico: ${esc(service?.name || "Consulta")}<br>Profissional: ${esc(professional?.full_name || "-")}</p>`,
          });
        }
      } catch (_e) { /* nao bloquear */ }
    }

    return redirectTo("/r?e=remarcado");
  } catch (_e) {
    return redirectTo("/r?e=erro");
  }
});
