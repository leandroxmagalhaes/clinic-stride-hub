import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Tool definitions for function calling (READ-ONLY — Phase 1) ───────────
const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "search_patients",
      description: "Procura utentes por nome aproximado na clínica. Devolve id, nome, telefone e email.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Nome ou parte do nome do utente" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Verifica horários disponíveis para um profissional num determinado dia.",
      parameters: {
        type: "object",
        properties: {
          professional_id: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          min_time: { type: "string", description: "HH:MM (opcional)" },
        },
        required: ["date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_today_sessions",
      description: "Lista as sessões agendadas para hoje (do utilizador actual ou de toda a clínica conforme permissões).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sessions_by_date_range",
      description: "Lista sessões num intervalo de datas. Use para 'amanhã', 'esta semana', 'próximos dias'.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "YYYY-MM-DD" },
          end_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["start_date", "end_date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_evolutions",
      description: "Lista sessões realizadas que ainda não têm evolução clínica registada.",
      parameters: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_evolutions",
      description: "Últimas evoluções clínicas criadas (mais recentes primeiro).",
      parameters: { type: "object", properties: { limit: { type: "number", description: "default 10" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_payments",
      description: "Sessões com pagamento pendente.",
      parameters: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_expiring_packs",
      description: "Packs/pacotes que expiram nos próximos N dias.",
      parameters: { type: "object", properties: { days: { type: "number" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_daily_summary",
      description: "Resumo do dia: sessões, pendências, alertas.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inactive_patients",
      description: "Utentes sem sessão há mais de N dias.",
      parameters: { type: "object", properties: { days: { type: "number" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_unread_messages_summary",
      description: "Resumo das mensagens do diário de acompanhamento ainda não lidas (por utente).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_professional_patient_count",
      description: "Quantos utentes distintos um profissional acompanha (com base em sessões). Procura por nome.",
      parameters: {
        type: "object",
        properties: { professional_name: { type: "string" } },
        required: ["professional_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_active_patients",
      description: "Lista utentes activos da clínica (com sessão nos últimos N dias, default 30).",
      parameters: { type: "object", properties: { days: { type: "number" } }, additionalProperties: false },
    },
  },
];

// ── Fuzzy matching helpers ─────────────────────────────────────────────────
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function fuzzyScore(input: string, candidate: string): number {
  const a = normalizeText(input);
  const b = normalizeText(candidate);
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.85;
  const aTokens = a.split(/\s+/);
  const bTokens = b.split(/\s+/);
  let matched = 0;
  for (const t of aTokens) {
    if (bTokens.some((bt) => bt.includes(t) || t.includes(bt))) matched++;
  }
  return aTokens.length > 0 ? matched / Math.max(aTokens.length, bTokens.length) : 0;
}

// ── Excel/CSV parsing via SheetJS ──────────────────────────────────────────
async function parseSpreadsheet(base64: string, mimeType: string): Promise<Record<string, string>[]> {
  const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs");

  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  const workbook = XLSX.read(bytes, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows.slice(0, 500);
}

// ── Tool execution ─────────────────────────────────────────────────────────
interface UserScope {
  isAdmin: boolean;
  isProfessional: boolean;
  isSecretary: boolean;
  professionalProfileId: string | null;
}

function scopeSessions(query: any, scope: UserScope) {
  // Admin & secretary see all clinic data; professional (non-admin) sees only own
  if (scope.isProfessional && !scope.isAdmin && scope.professionalProfileId) {
    return query.eq("profissional_id", scope.professionalProfileId);
  }
  return query;
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  supabaseAdmin: any,
  clinicId: string,
  extraContext?: { fileUpload?: { name: string; base64: string; mime_type: string }; userId?: string; lovableApiKey?: string; scope?: UserScope }
): Promise<string> {
  const scope: UserScope = extraContext?.scope || { isAdmin: true, isProfessional: false, isSecretary: false, professionalProfileId: null };
  try {
    switch (toolName) {
      case "search_patients": {
        const q = (args.query as string) || "";
        const { data, error } = await supabaseAdmin
          .from("pacientes")
          .select("id, full_name, phone, email, is_active")
          .eq("clinic_id", clinicId)
          .ilike("full_name", `%${q}%`)
          .limit(10);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ patients: data || [] });
      }

      case "check_availability": {
        const date = args.date as string;
        const profId = args.professional_id as string | undefined;
        const minTime = args.min_time as string | undefined;
        const startOfDay = `${date}T00:00:00`;
        const endOfDay = `${date}T23:59:59`;
        let sessionsQuery = supabaseAdmin
          .from("sessoes")
          .select("start_time, end_time, profissional_id, status")
          .eq("clinic_id", clinicId)
          .gte("start_time", startOfDay)
          .lte("start_time", endOfDay)
          .not("status", "in", '("cancelado","falta")');
        if (profId) sessionsQuery = sessionsQuery.eq("profissional_id", profId);
        const { data: sessions } = await sessionsQuery;

        let professionals: Array<{ id: string; full_name: string }> = [];
        if (!profId) {
          const { data: profs } = await supabaseAdmin
            .from("profissionais")
            .select("id, full_name")
            .eq("clinic_id", clinicId)
            .eq("is_active", true);
          professionals = profs || [];
        } else {
          const { data: prof } = await supabaseAdmin
            .from("profissionais")
            .select("id, full_name")
            .eq("id", profId)
            .single();
          if (prof) professionals = [prof];
        }

        const slots: Array<{ time: string; professional_id: string; professional_name: string }> = [];
        for (const prof of professionals) {
          for (let h = 8; h < 20; h++) {
            for (const m of [0, 30]) {
              const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              if (minTime && time < minTime) continue;
              const slotStart = `${date}T${time}:00`;
              const slotEnd = new Date(new Date(slotStart).getTime() + 60 * 60000).toISOString();
              const conflict = (sessions || []).some(
        (s: any) =>
                  s.profissional_id === prof.id &&
                  new Date(s.start_time) < new Date(slotEnd) &&
                  new Date(s.end_time) > new Date(slotStart)
              );
              if (!conflict) {
                slots.push({ time, professional_id: prof.id, professional_name: prof.full_name });
              }
            }
          }
        }
        return JSON.stringify({ date, available_slots: slots.slice(0, 15) });
      }

      case "propose_session":
      case "create_session":
      case "cancel_session": {
        return JSON.stringify({
          error: "ACTION_NOT_AVAILABLE",
          message: "Nesta versão posso apenas consultar informação. Para criar, alterar ou cancelar sessões use a Agenda.",
        });
      }

      case "get_pending_evolutions": {
        if (scope.isSecretary && !scope.isAdmin && !scope.isProfessional) {
          return JSON.stringify({ error: "Acesso a evoluções clínicas não disponível para o seu perfil." });
        }
        const limit = (args.limit as number) || 10;
        let q = supabaseAdmin
          .from("sessoes")
          .select("id, start_time, paciente_id, pacientes!sessoes_paciente_id_fkey(full_name), profissional_id")
          .eq("clinic_id", clinicId)
          .eq("status", "realizado")
          .is("notes", null)
          .order("start_time", { ascending: false })
          .limit(limit);
        q = scopeSessions(q, scope);
        const { data } = await q;

        const sessionIds = (data || []).map((s: any) => s.id);
        if (sessionIds.length === 0) return JSON.stringify({ pending: [] });

        const { data: evolutions } = await supabaseAdmin
          .from("evolucoes_clinicas")
          .select("sessao_id")
          .in("sessao_id", sessionIds);
        const evolvedIds = new Set((evolutions || []).map((e: any) => e.sessao_id));
        const pending = (data || []).filter((s: any) => !evolvedIds.has(s.id)).map((s: any) => ({
          session_id: s.id,
          date: s.start_time,
          patient_name: (s as any).pacientes?.full_name || "N/A",
        }));
        return JSON.stringify({ pending });
      }

      case "get_pending_payments": {
        const limit = (args.limit as number) || 10;
        let q = supabaseAdmin
          .from("sessoes")
          .select("id, start_time, price, pacientes!sessoes_paciente_id_fkey(full_name)")
          .eq("clinic_id", clinicId)
          .eq("payment_status", "pendente")
          .eq("status", "realizado")
          .order("start_time", { ascending: false })
          .limit(limit);
        q = scopeSessions(q, scope);
        const { data } = await q;
        const pending = (data || []).map((s: any) => ({
          session_id: s.id,
          date: s.start_time,
          price: s.price,
          patient_name: (s as any).pacientes?.full_name || "N/A",
        }));
        return JSON.stringify({ pending_payments: pending });
      }

      case "get_expiring_packs": {
        const days = (args.days as number) || 7;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        const { data } = await supabaseAdmin
          .from("scheduling_packages")
          .select("id, total_sessions, sessions_created, end_date, pacientes!scheduling_packages_paciente_id_fkey(full_name)")
          .eq("clinic_id", clinicId)
          .eq("status", "ativo")
          .not("end_date", "is", null)
          .lte("end_date", futureDate.toISOString().split("T")[0])
          .order("end_date", { ascending: true });
        const packs = (data || []).map((p: any) => ({
          id: p.id,
          patient_name: (p as any).pacientes?.full_name || "N/A",
          total: p.total_sessions,
          used: p.sessions_created,
          remaining: p.total_sessions - p.sessions_created,
          end_date: p.end_date,
        }));
        return JSON.stringify({ expiring_packs: packs });
      }

      case "get_daily_summary": {
        const today = new Date().toISOString().split("T")[0];
        const startOfDay = `${today}T00:00:00`;
        const endOfDay = `${today}T23:59:59`;

        const [sessionsRes, pendingPayRes] = await Promise.all([
          supabaseAdmin
            .from("sessoes")
            .select("id, start_time, status, pacientes!sessoes_paciente_id_fkey(full_name)")
            .eq("clinic_id", clinicId)
            .gte("start_time", startOfDay)
            .lte("start_time", endOfDay)
            .order("start_time"),
          supabaseAdmin
            .from("sessoes")
            .select("id", { count: "exact" })
            .eq("clinic_id", clinicId)
            .eq("payment_status", "pendente")
            .eq("status", "realizado"),
        ]);

        const sessions = sessionsRes.data || [];
        const total = sessions.length;
        const confirmed = sessions.filter((s: any) => s.status === "agendado").length;
        const completed = sessions.filter((s: any) => s.status === "realizado").length;
        const cancelled = sessions.filter((s: any) => s.status === "cancelado" || s.status === "falta").length;

        return JSON.stringify({
          date: today,
          total_sessions: total,
          confirmed,
          completed,
          cancelled,
          pending_payments: pendingPayRes.count || 0,
          sessions: sessions.map((s: any) => ({
            time: s.start_time,
            patient: (s as any).pacientes?.full_name || "N/A",
            status: s.status,
          })),
        });
      }

      case "get_inactive_patients": {
        const days = (args.days as number) || 14;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const { data: patients } = await supabaseAdmin
          .from("pacientes")
          .select("id, full_name, phone, email")
          .eq("clinic_id", clinicId)
          .eq("is_active", true);

        if (!patients || patients.length === 0) return JSON.stringify({ inactive: [] });

        const patientIds = patients.map((p: any) => p.id);
        const { data: recentSessions } = await supabaseAdmin
          .from("sessoes")
          .select("paciente_id, start_time")
          .eq("clinic_id", clinicId)
          .in("paciente_id", patientIds)
          .gte("start_time", cutoff.toISOString())
          .not("status", "in", '("cancelado","falta")');

        const activePatientIds = new Set((recentSessions || []).map((s: any) => s.paciente_id));
        const inactive = patients
          .filter((p: any) => !activePatientIds.has(p.id))
          .slice(0, 20)
          .map((p: any) => ({ id: p.id, name: p.full_name, phone: p.phone, email: p.email }));

        return JSON.stringify({ inactive, days_threshold: days });
      }

      // ── File import tools ────────────────────────────────────────────────
      case "parse_import_file": {
        const fileUpload = extraContext?.fileUpload;
        if (!fileUpload) {
          return JSON.stringify({ error: "Nenhum ficheiro foi enviado. Peça ao utilizador para anexar um ficheiro." });
        }

        const { name, base64, mime_type } = fileUpload;
        const isSpreadsheet = mime_type.includes("spreadsheet") || mime_type.includes("excel") ||
          mime_type === "text/csv" || name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
        const isPdf = mime_type === "application/pdf" || name.endsWith(".pdf");

        if (!isSpreadsheet && !isPdf) {
          return JSON.stringify({ error: `Tipo de ficheiro não suportado: ${mime_type}. Aceita: Excel (.xlsx/.xls), CSV (.csv) ou PDF (.pdf).` });
        }

        // Fetch existing patients and professionals for matching
        const [patientsRes, professionalsRes, servicesRes] = await Promise.all([
          supabaseAdmin.from("pacientes").select("id, full_name").eq("clinic_id", clinicId).eq("is_active", true),
          supabaseAdmin.from("profissionais").select("id, full_name").eq("clinic_id", clinicId).eq("is_active", true),
          supabaseAdmin.from("servicos").select("id, name").eq("clinic_id", clinicId).eq("is_active", true),
        ]);

        const existingPatients = patientsRes.data || [];
        const existingProfessionals = professionalsRes.data || [];
        const existingServices = servicesRes.data || [];

        let extractedRows: Record<string, string>[] = [];

        if (isSpreadsheet) {
          try {
            extractedRows = await parseSpreadsheet(base64, mime_type);
          } catch (e) {
            return JSON.stringify({ error: `Erro ao ler ficheiro: ${e instanceof Error ? e.message : "formato inválido"}` });
          }
        } else if (isPdf) {
          // For PDF: decode, extract text via AI
          try {
            const binaryStr = atob(base64);
            // Extract readable text (basic – works for text PDFs)
            let textContent = "";
            const textParts: string[] = [];
            for (let i = 0; i < binaryStr.length - 4; i++) {
              if (binaryStr[i] === "(" ) {
                let j = i + 1;
                let s = "";
                while (j < binaryStr.length && binaryStr[j] !== ")") {
                  s += binaryStr[j];
                  j++;
                }
                if (s.length > 1 && /[a-zA-Z0-9]/.test(s)) textParts.push(s);
                i = j;
              }
            }
            textContent = textParts.join(" ").slice(0, 10000);

            if (textContent.length < 20) {
              return JSON.stringify({ error: "Não foi possível extrair texto do PDF. Tente converter para Excel/CSV antes de importar." });
            }

            // Use AI to extract structured data from PDF text
            const lovableApiKey = extraContext?.lovableApiKey;
            if (!lovableApiKey) {
              return JSON.stringify({ error: "Chave de API não disponível para processar PDF." });
            }

            const pdfAiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${lovableApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "system",
                    content: `Extraia dados tabulares do texto a seguir. Retorne um JSON array onde cada objeto tem os campos: paciente, profissional, servico, data (YYYY-MM-DD), hora (HH:MM), observacoes. Se algum campo não existir, use string vazia. Retorne APENAS o JSON array, sem markdown.`,
                  },
                  { role: "user", content: textContent },
                ],
              }),
            });

            if (pdfAiResp.ok) {
              const pdfAiData = await pdfAiResp.json();
              const content = pdfAiData.choices?.[0]?.message?.content || "[]";
              const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
              try {
                extractedRows = JSON.parse(cleaned);
              } catch {
                return JSON.stringify({ error: "Não foi possível estruturar os dados do PDF. Tente um ficheiro Excel/CSV." });
              }
            } else {
              return JSON.stringify({ error: "Erro ao processar PDF com IA." });
            }
          } catch (e) {
            return JSON.stringify({ error: `Erro ao processar PDF: ${e instanceof Error ? e.message : "desconhecido"}` });
          }
        }

        if (extractedRows.length === 0) {
          return JSON.stringify({ error: "Nenhuma linha de dados encontrada no ficheiro." });
        }

        // Normalize column names
        const normalizedRows = extractedRows.map((row) => {
          const normalized: Record<string, string> = {};
          for (const [key, val] of Object.entries(row)) {
            const nk = normalizeText(key);
            if (nk.includes("paciente") || nk.includes("cliente") || nk.includes("patient") || nk.includes("nome")) normalized.paciente = String(val);
            else if (nk.includes("profissional") || nk.includes("terapeuta") || nk.includes("professional")) normalized.profissional = String(val);
            else if (nk.includes("servico") || nk.includes("service") || nk.includes("tipo")) normalized.servico = String(val);
            else if (nk.includes("data") || nk.includes("date") || nk.includes("dia")) normalized.data = String(val);
            else if (nk.includes("hora") || nk.includes("time") || nk.includes("horario")) normalized.hora = String(val);
            else if (nk.includes("obs") || nk.includes("nota") || nk.includes("note")) normalized.observacoes = String(val);
            else if (nk.includes("telefone") || nk.includes("phone") || nk.includes("telemovel")) normalized.telefone = String(val);
            else if (nk.includes("email") || nk.includes("mail")) normalized.email = String(val);
            // Keep original key too
            if (!normalized[nk]) normalized[nk] = String(val);
          }
          return normalized;
        });

        // Fuzzy match and insert into import_queue
        let matchedCount = 0;
        let needsReviewCount = 0;
        let notFoundCount = 0;
        let newPatientsFound: string[] = [];
        const inserts: any[] = [];

        for (const row of normalizedRows) {
          const patientName = row.paciente || "";
          let bestPatient: { id: string; full_name: string } | null = null;
          let bestScore = 0;

          if (patientName) {
            for (const p of existingPatients) {
              const score = fuzzyScore(patientName, p.full_name);
              if (score > bestScore) {
                bestScore = score;
                bestPatient = p;
              }
            }
          }

          if (bestScore >= 0.8) matchedCount++;
          else if (bestScore >= 0.5) needsReviewCount++;
          else {
            notFoundCount++;
            if (patientName && !newPatientsFound.includes(patientName)) {
              newPatientsFound.push(patientName);
            }
          }

          // Match service
          let bestService: { id: string; name: string } | null = null;
          if (row.servico) {
            let bestSvcScore = 0;
            for (const s of existingServices) {
              const score = fuzzyScore(row.servico, s.name);
              if (score > bestSvcScore) {
                bestSvcScore = score;
                bestService = s;
              }
            }
            if (bestSvcScore < 0.4) bestService = null;
          }

          inserts.push({
            clinic_id: clinicId,
            raw_data: row,
            suggested_patient_id: bestScore >= 0.5 ? bestPatient?.id : null,
            suggested_service_id: bestService?.id || null,
            match_confidence: bestScore,
            status: "pending",
            created_by: extraContext?.userId || null,
          });
        }

        // Batch insert into import_queue
        const BATCH = 50;
        let insertedTotal = 0;
        for (let i = 0; i < inserts.length; i += BATCH) {
          const batch = inserts.slice(i, i + BATCH);
          const { error } = await supabaseAdmin.from("import_queue").insert(batch);
          if (error) {
            console.error("Import queue insert error:", error);
            return JSON.stringify({ error: `Erro ao guardar dados: ${error.message}` });
          }
          insertedTotal += batch.length;
        }

        // Log
        try {
          await supabaseAdmin.from("ai_usage_logs").insert({
            clinic_id: clinicId,
            user_id: extraContext?.userId || "",
            feature: "copilot",
            action: "file_import",
            model: "parse",
          });
        } catch { /* ignore */ }

        return JSON.stringify({
          success: true,
          file_name: name,
          total_rows: normalizedRows.length,
          matched_patients: matchedCount,
          needs_review: needsReviewCount,
          not_found: notFoundCount,
          new_patients_detected: newPatientsFound.slice(0, 10),
          message: `Extraí ${normalizedRows.length} linhas do ficheiro "${name}". ${matchedCount} pacientes identificados automaticamente, ${needsReviewCount} precisam de verificação e ${notFoundCount} não encontrados.`,
        });
      }

      case "get_import_queue": {
        const limit = (args.limit as number) || 20;
        const { data, error } = await supabaseAdmin
          .from("import_queue")
          .select("id, raw_data, suggested_patient_id, suggested_service_id, match_confidence, status, created_at")
          .eq("clinic_id", clinicId)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(limit);

        if (error) return JSON.stringify({ error: error.message });

        // Enrich with patient names
        const patientIds = [...new Set((data || []).map((d: any) => d.suggested_patient_id).filter(Boolean))];
        let patientMap: Record<string, string> = {};
        if (patientIds.length > 0) {
          const { data: patients } = await supabaseAdmin
            .from("pacientes")
            .select("id, full_name")
            .in("id", patientIds);
          for (const p of patients || []) patientMap[p.id] = p.full_name;
        }

        const items = (data || []).map((d: any) => ({
          id: d.id,
          raw: d.raw_data,
          matched_patient: d.suggested_patient_id ? patientMap[d.suggested_patient_id] || "ID: " + d.suggested_patient_id : null,
          confidence: d.match_confidence,
          status: d.status,
        }));

        return JSON.stringify({ queue_items: items, total: items.length });
      }

      case "confirm_import_rows": {
        const rowIds = (args.row_ids as string[]) || [];

        // If no IDs, confirm all pending
        let query = supabaseAdmin
          .from("import_queue")
          .select("id, raw_data, suggested_patient_id, suggested_service_id")
          .eq("clinic_id", clinicId)
          .eq("status", "pending");

        if (rowIds.length > 0) {
          query = query.in("id", rowIds);
        }

        const { data: rows, error } = await query;
        if (error) return JSON.stringify({ error: error.message });
        if (!rows || rows.length === 0) return JSON.stringify({ error: "Nenhum item pendente encontrado." });

        // Get first professional as fallback
        const { data: defaultProf } = await supabaseAdmin
          .from("profissionais")
          .select("id")
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .limit(1)
          .single();

        let created = 0;
        let errors: string[] = [];

        for (const row of rows) {
          const raw = row.raw_data as Record<string, string>;
          const patientId = row.suggested_patient_id;
          if (!patientId) {
            errors.push(`Linha sem paciente: ${raw.paciente || "desconhecido"}`);
            continue;
          }

          // Parse date and time
          let dateStr = raw.data || "";
          let timeStr = raw.hora || "09:00";

          // Try to normalize date
          if (dateStr && !dateStr.includes("-")) {
            // Try DD/MM/YYYY
            const parts = dateStr.split(/[\/\.]/);
            if (parts.length === 3) {
              const [d, m, y] = parts;
              dateStr = `${y.length === 2 ? "20" + y : y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
            }
          }

          if (!dateStr) {
            errors.push(`Linha sem data: ${raw.paciente || "desconhecido"}`);
            continue;
          }

          // Normalize time
          if (timeStr && !timeStr.includes(":")) {
            timeStr = timeStr.padStart(4, "0");
            timeStr = timeStr.slice(0, 2) + ":" + timeStr.slice(2);
          }

          const startTime = `${dateStr}T${timeStr}:00`;
          const endDate = new Date(startTime);
          endDate.setMinutes(endDate.getMinutes() + 60);
          const endTime = endDate.toISOString();

          const isPast = new Date(startTime) < new Date();

          const { error: sessError } = await supabaseAdmin.from("sessoes").insert({
            clinic_id: clinicId,
            paciente_id: patientId,
            profissional_id: defaultProf?.id || "",
            servico_id: row.suggested_service_id || null,
            start_time: startTime,
            end_time: endTime,
            notes: raw.observacoes || null,
            status: isPast ? "realizado" : "agendado",
            payment_status: "pendente",
          });

          if (sessError) {
            errors.push(`Erro para ${raw.paciente || "?"}: ${sessError.message}`);
          } else {
            created++;
            // Mark as confirmed
            await supabaseAdmin.from("import_queue").update({ status: "confirmed" }).eq("id", row.id);
          }
        }

        return JSON.stringify({
          success: true,
          sessions_created: created,
          errors: errors.length > 0 ? errors : undefined,
          message: `${created} sessões criadas com sucesso.${errors.length > 0 ? ` ${errors.length} erros.` : ""}`,
        });
      }

      case "register_new_patients": {
        const patients = (args.patients as Array<{ full_name: string; phone?: string; email?: string }>) || [];
        if (patients.length === 0) return JSON.stringify({ error: "Nenhum paciente para registar." });

        let created = 0;
        const results: Array<{ name: string; id?: string; error?: string }> = [];

        for (const p of patients) {
          if (!p.full_name || p.full_name.trim().length < 2) {
            results.push({ name: p.full_name || "", error: "Nome inválido" });
            continue;
          }

          const { data, error } = await supabaseAdmin.from("pacientes").insert({
            clinic_id: clinicId,
            full_name: p.full_name.trim(),
            phone: p.phone || null,
            email: p.email || null,
          }).select("id").single();

          if (error) {
            results.push({ name: p.full_name, error: error.message });
          } else {
            results.push({ name: p.full_name, id: data?.id });
            created++;
          }
        }

        return JSON.stringify({
          success: true,
          patients_created: created,
          results,
          message: `${created} pacientes registados com sucesso.`,
        });
      }

      default:
        return JSON.stringify({ error: `Tool '${toolName}' não reconhecida.` });
    }
  } catch (e) {
    console.error(`Tool ${toolName} error:`, e);
    return JSON.stringify({ error: `Erro ao executar ${toolName}` });
  }
}

// ── System prompt ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é o Copiloto, um assistente inteligente integrado numa plataforma de gestão de clínicas de fisioterapia. Você tem acesso a ferramentas para consultar e agir sobre dados reais do sistema.

REGRAS CRÍTICAS:
1. NUNCA execute ações destrutivas sem confirmação. Para criar ou cancelar sessões, SEMPRE use propose_session primeiro e aguarde confirmação.
2. Responda SEMPRE em português (pt-PT/pt-BR conforme o contexto do utilizador).
3. Seja conciso e direto. Use formatação clara com listas quando apropriado.
4. Quando o utilizador mencionar um nome de paciente, use search_patients para encontrar o paciente correto.
5. Se houver ambiguidade (múltiplos pacientes com nomes semelhantes), pergunte qual.
6. Para agendamentos, SEMPRE verifique disponibilidade com check_availability antes de propor.
7. Use o contexto fornecido (página atual, paciente selecionado) para antecipar o que o utilizador precisa.
8. Para ações de escrita (create_session, cancel_session), explique o que vai fazer e peça confirmação explícita.
9. Formate datas e horas de forma legível (ex: "Quarta, 15 de março às 18:30").
10. Se não conseguir encontrar dados, informe claramente e sugira alternativas.

CAPACIDADES:
- Buscar pacientes por nome
- Verificar disponibilidade de horários
- Propor e criar sessões (com confirmação)
- Cancelar sessões (com confirmação)
- Listar evoluções pendentes
- Listar pagamentos pendentes
- Verificar packs a vencer
- Resumo diário completo
- Listar pacientes inativos

IMPORTAÇÃO DE FICHEIROS:
- Quando o utilizador envia um ficheiro (Excel, CSV ou PDF), use parse_import_file para extrair e processar os dados.
- SEMPRE apresente um resumo dos dados extraídos antes de qualquer ação (quantas linhas, quantos matches, quantos precisam revisão).
- Use get_import_queue para mostrar os dados em formato de tabela quando o utilizador pedir para revisar.
- Para confirmar a importação, use confirm_import_rows APENAS após confirmação explícita do utilizador.
- Se houver pacientes não encontrados na base, pergunte se deve registar como novos usando register_new_patients.
- Apresente os dados extraídos em tabela markdown simples para fácil leitura.
- Se o ficheiro contiver dados de novos pacientes (com nome, telefone, email), proponha o cadastro antes de criar sessões.`;

// ── Main handler ───────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Get clinic_id
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("clinic_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.clinic_id) {
      return new Response(JSON.stringify({ error: "Utilizador sem clínica associada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const clinicId = profile.clinic_id;

    const { messages, context, file_upload } = await req.json();

    // Build context message
    let contextNote = `Contexto: Data/hora atual: ${new Date().toISOString()}. Clinic ID: ${clinicId}.`;
    if (context?.currentPage) contextNote += ` Página atual: ${context.currentPage}.`;
    if (context?.patientId) contextNote += ` Paciente selecionado ID: ${context.patientId}.`;
    if (context?.patientName) contextNote += ` Paciente selecionado: ${context.patientName}.`;
    if (context?.selectedDate) contextNote += ` Data selecionada na agenda: ${context.selectedDate}.`;
    if (file_upload) contextNote += ` FICHEIRO ANEXADO: "${file_upload.name}" (${file_upload.mime_type}). Use parse_import_file para processar.`;

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextNote },
      ...messages,
    ];

    // Extra context for tool execution
    const toolExtraContext = {
      fileUpload: file_upload || undefined,
      userId,
      lovableApiKey,
    };

    // Call AI with tools — loop for tool calls
    let currentMessages = [...fullMessages];
    const MAX_TOOL_ROUNDS = 5;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: currentMessages,
          tools: toolDefinitions,
          stream: round === MAX_TOOL_ROUNDS - 1 ? true : false,
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errorText);
        return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if it's a tool call (non-streaming response)
      const responseData = await aiResponse.json();
      const choice = responseData.choices?.[0];

      if (choice?.finish_reason === "tool_calls" || choice?.message?.tool_calls?.length > 0) {
        const toolCalls = choice.message.tool_calls;
        currentMessages.push(choice.message);

        // Execute all tool calls
        for (const tc of toolCalls) {
          let toolArgs: Record<string, unknown> = {};
          try {
            toolArgs = typeof tc.function.arguments === "string"
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments || {};
          } catch {
            toolArgs = {};
          }

          const result = await executeTool(tc.function.name, toolArgs, adminClient, clinicId, toolExtraContext);
          currentMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }
        // Continue the loop for the next AI call
        continue;
      }

      // No tool call — return the text response as SSE stream
      const textContent = choice?.message?.content || "";

      // Log usage
      try {
        await adminClient.from("ai_usage_logs").insert({
          clinic_id: clinicId,
          user_id: userId,
          feature: "copilot",
          action: file_upload ? "file_import_chat" : "chat",
          model: "google/gemini-3-flash-preview",
          tokens_used: responseData.usage?.total_tokens || null,
        });
      } catch (e) {
        console.error("Log error:", e);
      }

      // Simulate SSE stream from the text
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const sseData = JSON.stringify({
            choices: [{ delta: { content: textContent }, finish_reason: null }],
          });
          controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    // Fallback if max rounds exceeded
    return new Response(
      JSON.stringify({ error: "O agente atingiu o limite de iterações." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Copilot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
