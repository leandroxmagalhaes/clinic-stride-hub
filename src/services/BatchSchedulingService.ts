import * as XLSX from "xlsx";
import { Patient } from "@/services/PatientService";
import { Session } from "@/services/SessionService";

export interface BatchRow {
  id: string;
  date: Date | null;
  dayOfWeek: string;
  name: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  notes: string;
  // Matching
  matchedPatient: Patient | null;
  matchCandidates: { patient: Patient; score: number }[];
  matchScore: number;
  matchStatus: "exact" | "suggestion" | "none";
  // Review
  approved: boolean;
  conflict: boolean;
  conflictInfo?: string;
  parseError?: string;
}

// Normalize text: lowercase, remove accents, trim
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Simple similarity score between two normalized strings
function similarityScore(a: string, b: string): number {
  if (a === b) return 100;
  // Check if one contains the other
  if (b.includes(a) || a.includes(b)) {
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    return Math.round((shorter.length / longer.length) * 90);
  }
  // Word-level matching
  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = b.split(/\s+/).filter(Boolean);
  let matched = 0;
  for (const wa of wordsA) {
    if (wordsB.some(wb => wb === wa || wb.startsWith(wa) || wa.startsWith(wb))) {
      matched++;
    }
  }
  if (wordsA.length === 0) return 0;
  return Math.round((matched / Math.max(wordsA.length, wordsB.length)) * 85);
}

export function matchPatient(
  name: string,
  patients: Patient[]
): { matched: Patient | null; candidates: { patient: Patient; score: number }[]; score: number; status: "exact" | "suggestion" | "none" } {
  const norm = normalize(name);
  if (!norm) return { matched: null, candidates: [], score: 0, status: "none" };

  const scored = patients
    .map(p => ({ patient: p, score: similarityScore(norm, normalize(p.full_name)) }))
    .filter(c => c.score > 30)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { matched: null, candidates: [], score: 0, status: "none" };
  }

  const best = scored[0];

  // Exact or very high match
  if (best.score >= 80) {
    // Check for ambiguity
    const close = scored.filter(c => c.score >= 70);
    if (close.length > 1) {
      return { matched: best.patient, candidates: close, score: best.score, status: "suggestion" };
    }
    return { matched: best.patient, candidates: scored.slice(0, 3), score: best.score, status: "exact" };
  }

  // Partial match
  if (best.score >= 50) {
    return { matched: best.patient, candidates: scored.slice(0, 5), score: best.score, status: "suggestion" };
  }

  return { matched: null, candidates: scored.slice(0, 5), score: best.score, status: "none" };
}

// Detect column mapping from header row
const COLUMN_ALIASES: Record<string, string[]> = {
  date: ["data", "date", "dia"],
  dayOfWeek: ["dia da semana", "dia_semana", "day"],
  name: ["evento", "pessoa", "nome", "paciente", "name", "event", "subject", "assunto"],
  startTime: ["inicio", "horario inicio", "hora inicio", "start", "start time", "hora_inicio", "horário início"],
  endTime: ["fim", "horario fim", "hora fim", "end", "end time", "hora_fim", "horário fim"],
  notes: ["observacoes", "notas", "notes", "descricao", "description", "observações", "descrição"],
};

function detectColumns(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  const normHeaders = headers.map(h => normalize(h));

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (let i = 0; i < normHeaders.length; i++) {
      if (aliases.some(a => normHeaders[i].includes(normalize(a)))) {
        mapping[field] = i;
        break;
      }
    }
  }
  return mapping;
}

function parseDate(val: any): Date | null {
  if (!val) return null;
  // Excel serial number
  if (typeof val === "number") {
    const epoch = new Date(1899, 11, 30);
    epoch.setDate(epoch.getDate() + val);
    return epoch;
  }
  const str = String(val).trim();
  // DD/MM/YYYY
  const ddmm = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (ddmm) {
    return new Date(Number(ddmm[3]), Number(ddmm[2]) - 1, Number(ddmm[1]));
  }
  // YYYY-MM-DD
  const iso = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function parseTime(val: any): { hour: number; minute: number } | null {
  if (val == null) return null;
  // Excel time fraction
  if (typeof val === "number" && val < 1) {
    const totalMinutes = Math.round(val * 24 * 60);
    return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
  }
  const str = String(val).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return { hour: Number(m[1]), minute: Number(m[2]) };
  return null;
}

export function parseSpreadsheet(file: File): Promise<BatchRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (raw.length < 2) {
          reject(new Error("A planilha deve ter pelo menos um cabeçalho e uma linha de dados."));
          return;
        }

        const headers = raw[0].map(String);
        const colMap = detectColumns(headers);

        if (colMap.date === undefined && colMap.name === undefined) {
          reject(new Error("Não foi possível identificar as colunas. Certifique-se que a planilha tem colunas como 'Data', 'Nome/Evento', 'Início', 'Fim'."));
          return;
        }

        const rows: BatchRow[] = [];
        for (let i = 1; i < raw.length; i++) {
          const r = raw[i];
          if (!r || r.every(c => c == null || String(c).trim() === "")) continue;

          const nameVal = colMap.name !== undefined ? String(r[colMap.name] || "").trim() : "";
          if (!nameVal) continue;

          const dateVal = colMap.date !== undefined ? r[colMap.date] : null;
          const date = parseDate(dateVal);
          const startTime = colMap.startTime !== undefined ? parseTime(r[colMap.startTime]) : null;
          const endTime = colMap.endTime !== undefined ? parseTime(r[colMap.endTime]) : null;
          const dayOfWeek = colMap.dayOfWeek !== undefined ? String(r[colMap.dayOfWeek] || "").trim() : "";
          const notes = colMap.notes !== undefined ? String(r[colMap.notes] || "").trim() : "";

          let parseError: string | undefined;
          if (!date) parseError = "Data inválida";
          else if (!startTime) parseError = "Horário de início inválido";

          rows.push({
            id: `row-${i}`,
            date,
            dayOfWeek,
            name: nameVal,
            startHour: startTime?.hour ?? 0,
            startMinute: startTime?.minute ?? 0,
            endHour: endTime?.hour ?? (startTime ? startTime.hour + 1 : 0),
            endMinute: endTime?.minute ?? (startTime?.minute ?? 0),
            notes,
            matchedPatient: null,
            matchCandidates: [],
            matchScore: 0,
            matchStatus: "none",
            approved: false,
            conflict: false,
            parseError,
          });
        }
        resolve(rows);
      } catch (err) {
        reject(new Error("Erro ao processar o ficheiro. Verifique o formato."));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o ficheiro."));
    reader.readAsArrayBuffer(file);
  });
}

export function analyzeRows(rows: BatchRow[], patients: Patient[], existingSessions: Session[]): BatchRow[] {
  return rows.map(row => {
    // Match patient
    const match = matchPatient(row.name, patients);
    const updatedRow: BatchRow = {
      ...row,
      matchedPatient: match.matched,
      matchCandidates: match.candidates,
      matchScore: match.score,
      matchStatus: match.status,
      approved: match.status === "exact" && !row.parseError,
    };

    // Check conflicts
    if (updatedRow.date && updatedRow.matchedPatient) {
      const rowStart = new Date(updatedRow.date);
      rowStart.setHours(updatedRow.startHour, updatedRow.startMinute, 0, 0);
      const rowEnd = new Date(updatedRow.date);
      rowEnd.setHours(updatedRow.endHour, updatedRow.endMinute, 0, 0);

      const conflict = existingSessions.find(s => {
        if (s.status === "cancelado" || s.status === "falta") return false;
        const sStart = new Date(s.start_time);
        const sEnd = new Date(s.end_time);
        return sStart < rowEnd && sEnd > rowStart && s.profissional_id;
      });

      if (conflict) {
        updatedRow.conflict = true;
        updatedRow.conflictInfo = "Conflito de horário com sessão existente";
        updatedRow.approved = false;
      }
    }

    // Check notes for no-show
    if (normalize(updatedRow.notes).includes("no-show") || normalize(updatedRow.notes).includes("no show") || normalize(updatedRow.notes).includes("faltou")) {
      // Still allow approval but mark for status "falta"
    }

    return updatedRow;
  });
}

export function getSessionStatus(row: BatchRow): string {
  const now = new Date();
  if (row.date && row.date < now) {
    const n = normalize(row.notes);
    if (n.includes("no-show") || n.includes("no show") || n.includes("faltou") || n.includes("falta")) {
      return "falta";
    }
    return "realizado";
  }
  return "agendado";
}
