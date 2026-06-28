import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(unsafe: string): string {
  return String(unsafe ?? "")
    .replace(/&/g, "&")
    .replace(//g, ">")
    .replace(/"/g, """)
    .replace(/'/g, "'");
}

// Data "YYYY-MM-DD" no fuso indicado (robusto a DST: deixa o Intl converter)
function dateInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const provided = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const ok =
      provided === serviceKey ||
      (!!cronSecret && provided === cronSecret) ||
      (!!anonKey && provided === anonKey);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const resend = new Resend(resendApiKey);

    // ---------- Travões de teste (opcionais). Produção/cron não passa nenhum. ----------
    const url = new URL(req.url);
    const qp = url.searchParams;
    let body: Record = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { /* sem corpo JSON — ok */ }
    }
    const flag = (k: string): string => {
      const q = qp.get(k);
      if (q != null) return q;
      const b = body[k];
      return b == null ? "" : String(b);
    };
    const isOn = (k: string) => flag(k) === "1" || flag(k) === "true";
    const dryRun = isOn("dry_run");             // não envia, não grava: só mostra quem receberia
    const ignoreCutoff = isOn("ignore_cutoff"); // ignora a hora de corte (testar a qualquer hora)
    const force = isOn("force");                // ignora o dedup (repetir testes) e não grava log
    const onlyEmail = flag("only_email").trim().toLowerCase(); // envia só p/ este email
    const targetDateOverride = flag("target_date").trim();     // YYYY-MM-DD (testar outro dia)

    const now = new Date();
    // Janela ampla; filtramos por igualdade da data local (Lisboa) de cada sessão.
    const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data: settingsRows } = await supabase
      .from("clinic_settings")
      .select(
        "clinic_id, timezone, confirmacao_dia_anterior_ativo, confirmacao_hora_corte, confirmacao_saudacao"
      );
    const settingsMap = new Map();
    for (const r of settingsRows || []) settingsMap.set((r as any).clinic_id, r);

    const { data: sessions, error: sessionsError } = await supabase
      .from("sessoes")
      .select(`
        id, start_time, status, clinic_id, confirmation_token,
        pacientes!sessoes_paciente_id_fkey ( full_name, email ),
        profiles!sessoes_profissional_id_fkey ( full_name ),
        servicos!sessoes_servico_id_fkey ( name ),
        clinics!sessoes_clinic_id_fkey ( name, phone, email )
      `)
      .gte("start_time", now.toISOString())
      .lte("start_time", windowEnd.toISOString())
      .in("status", ["agendado", "confirmado"]);
    if (sessionsError) throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);

    const results = {
      sent: 0,
      skipped: 0,
      pending: 0,
      errors: [] as string[],
      preview: [] as any[],
    };

    for (const session of sessions || []) {
      try {
        const patient = (session as any).pacientes;
        const professional = (session as any).profiles;
        const service = (session as any).servicos;
        const clinic = (session as any).clinics;
        const settings = settingsMap.get((session as any).clinic_id) || {};
        const tz = settings.timezone || "Europe/Lisbon";

        // 1) Funcionalidade ativa para esta clínica?
        if (settings.confirmacao_dia_anterior_ativo === false) {
          results.skipped++;
          continue;
        }

        // 2) Já passou a hora de corte (local de Lisboa)? (saltado em teste com ignore_cutoff)
        if (!ignoreCutoff) {
          const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).formatToParts(now);
          const lh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
          const lm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
          const nowLocalMin = lh * 60 + lm;
          const [chH, chM] = String(settings.confirmacao_hora_corte || "14:00")
            .split(":")
            .map((n) => Number(n));
          const cutoffMin = (chH || 0) * 60 + (chM || 0);
          if (nowLocalMin < cutoffMin) {
            results.pending++;
            continue;
          }
        }

        // 3) A sessão é do dia-alvo? (amanhã em Lisboa, ou target_date em teste)
        const targetDate =
          targetDateOverride ||
          dateInTz(new Date(now.getTime() + 24 * 60 * 60 * 1000), tz);
        const sessLocalDate = dateInTz(new Date((session as any).start_time), tz);
        if (sessLocalDate !== targetDate) {
          continue; // não é do dia-alvo — nem conta
        }

        // 4) Tem email?
        if (!patient?.email) {
          results.skipped++;
          continue;
        }
        if (onlyEmail && String(patient.email).toLowerCase() !== onlyEmail) {
          results.skipped++;
          continue;
        }

        // 5) Dedup — já recebeu o email do dia anterior? (saltado em teste com force)
        if (!force) {
          const { data: existingLog } = await supabase
            .from("reminder_logs")
            .select("id")
            .eq("sessao_id", (session as any).id)
            .eq("canal", "email_dia_anterior")
            .maybeSingle();
          if (existingLog) {
            results.skipped++;
            continue;
          }
        }

        const apt = new Date((session as any).start_time);
        const formattedDate = apt.toLocaleDateString("pt-PT", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: tz,
        });
        const formattedTime = apt.toLocaleTimeString("pt-PT", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: tz,
        });

        const token = (session as any).confirmation_token;
        const baseLink = `${supabaseUrl}/functions/v1/confirmar-presenca?token=${encodeURIComponent(
          token
        )}`;
        const confirmarUrl = `${baseLink}&accao=confirmar`;
        const remarcarUrl = `${baseLink}&accao=remarcar`;

        const saudacao = escapeHtml(
          settings.confirmacao_saudacao ||
            "Olá! Lembramos a consulta do/a {nome} amanhã, {data}, às {hora}. Pode confirmar a presença?"
        )
          .replace(/\{nome\}/g, "" + escapeHtml(patient.full_name) + "")
          .replace(/\{data\}/g, formattedDate)
          .replace(/\{hora\}/g, formattedTime);

        const emailHtml = `




  


    
      
        


          

${escapeHtml(
            clinic?.name || "Respira & Desenvolve"
          )}


        


        


          

${saudacao}


        


        


          
            

Data: ${formattedDate}


            

Hora: ${formattedTime}


            

Profissional: ${escapeHtml(
              professional?.full_name || "A confirmar"
            )}


            

Serviço: ${escapeHtml(
              service?.name || "Consulta"
            )}


          
        



        
        


          
            
              
                ✓ Confirmar presença
              
            
          
        



        
        


          
            
              
                Preciso de remarcar
              
            
          
        



        


          


            Basta um toque. Se precisar de remarcar, pedimos-lhe só uma confirmação no passo seguinte.
          


        



        


          

${escapeHtml(
            clinic?.name || "Respira & Desenvolve"
          )}


          ${clinic?.phone ? `

📞 ${escapeHtml(clinic.phone)}

` : ""}
          ${clinic?.email ? `

✉️ ${escapeHtml(clinic.email)}

` : ""}
        


      
    



`;

        // DRY-RUN: não envia, não grava — só regista no preview
        if (dryRun) {
          results.preview.push({
            to: patient.email,
            nome: patient.full_name,
            data: formattedDate,
            hora: formattedTime,
          });
          results.sent++;
          continue;
        }

        await resend.emails.send({
          from: `${clinic?.name || "Respira & Desenvolve"} @respiraedesenvolve.com>`,
          to: [patient.email],
          subject: `Confirma a consulta de amanhã às ${formattedTime} — ${clinic?.name || "Respira & Desenvolve"}`,
          html: emailHtml,
        });

        // Só grava log fora de modo force (para testes repetíveis não bloquearem)
        if (!force) {
          await supabase
            .from("reminder_logs")
            .insert({ sessao_id: (session as any).id, canal: "email_dia_anterior" });
        }
        results.sent++;
      } catch (e) {
        results.errors.push(
          `Session ${(session as any).id}: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
