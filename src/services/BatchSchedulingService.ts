import * as XLSX from "xlsx";

// ── Types ──

export type MatchConfidence = "exato" | "sugestao" | "sem_match";

export interface MatchResult {
  id: string | null;
  name: string;
  confidence: MatchConfidence;
}

export interface ParsedRow {
  rowIndex: number;
  rawPaciente: string;
  rawProfissional: string;
  rawServico: string;
  rawData: string;
  rawHora: number | null;
  rawMinuto: number | null;
  rawObservacoes: string;
  pacienteMatch: MatchResult;
  profissionalMatch: MatchResult;
  servicoMatch: MatchResult;
  parsedDate: Date | null;
  isRetroactive: boolean;
  approved: boolean;
  validationError: string | null;
}

export interface NamedEntity {
  id: string;
  name: string;
}

// ── Normalisation helpers ──

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

// ── Fuzzy matching ──

function findBestMatch(
  input: string,
  candidates: NamedEntity[]
): MatchResult {
  if (!input || !input.trim()) {
    return { id: null, name: "", confidence: "sem_match" };
  }

  const normInput = normalize(input);
  const inputTokens = tokenize(input);

  // 1. Exact match
  for (const c of candidates) {
    if (normalize(c.name) === normInput) {
      return { id: c.id, name: c.name, confidence: "exato" };
    }
  }

  // 2. Contains match & token scoring
  let bestCandidate: NamedEntity | null = null;
  let bestScore = 0;

  for (const c of candidates) {
    const normName = normalize(c.name);
    const nameTokens = tokenize(c.name);

    // Full contains
    if (normName.includes(normInput) || normInput.includes(normName)) {
      const score = normInput.length / Math.max(normName.length, 1);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = c;
      }
      continue;
    }

    // Token overlap
    const matchingTokens = inputTokens.filter((t) =>
      nameTokens.some((nt) => nt.includes(t) || t.includes(nt))
    );
    const tokenScore =
      matchingTokens.length / Math.max(inputTokens.length, nameTokens.length);
    if (tokenScore > bestScore && tokenScore >= 0.4) {
      bestScore = tokenScore;
      bestCandidate = c;
    }
  }

  if (bestCandidate) {
    return { id: bestCandidate.id, name: bestCandidate.name, confidence: "sugestao" };
  }

  return { id: null, name: "", confidence: "sem_match" };
}

// ── Date parsing ──

function parseDate(raw: string | number | Date): Date | null {
  if (!raw) return null;

  // If xlsx returns a JS Date object
  if (raw instanceof Date) return raw;

  // If xlsx returns a serial number
  if (typeof raw === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const result = new Date(excelEpoch.getTime() + raw * 86400000);
    return isNaN(result.getTime()) ? null : result;
  }

  const str = String(raw).trim();

  // DD/MM/YYYY
  const ddMM = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (ddMM) {
    const d = new Date(Number(ddMM[3]), Number(ddMM[2]) - 1, Number(ddMM[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function parseIntSafe(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : Math.floor(n);
}

// ── Main service ──

export const BatchSchedulingService = {
  /**
   * Parse an uploaded Excel/CSV file and match against existing entities.
   */
  parseFile(
    file: File,
    patients: NamedEntity[],
    professionals: NamedEntity[],
    servicesList: NamedEntity[]
  ): Promise<ParsedRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Erro ao ler ficheiro"));
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            reject(new Error("Ficheiro vazio"));
            return;
          }
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: "",
          });

          if (json.length === 0) {
            reject(new Error("Planilha sem dados"));
            return;
          }

          const now = new Date();
          const rows: ParsedRow[] = json.map((row, idx) => {
            const rawPaciente = String(row["paciente"] ?? row["Paciente"] ?? "").trim();
            const rawProfissional = String(row["profissional"] ?? row["Profissional"] ?? "").trim();
            const rawServico = String(row["servico"] ?? row["Servico"] ?? row["serviço"] ?? row["Serviço"] ?? "").trim();
            const rawData = row["data"] ?? row["Data"] ?? "";
            const rawHora = parseIntSafe(row["hora"] ?? row["Hora"]);
            const rawMinuto = parseIntSafe(row["minuto"] ?? row["Minuto"]) ?? 0;
            const rawObservacoes = String(row["observacoes"] ?? row["Observacoes"] ?? row["observações"] ?? row["Observações"] ?? "").trim();

            const pacienteMatch = findBestMatch(rawPaciente, patients);
            const profissionalMatch = findBestMatch(rawProfissional, professionals);
            const servicoMatch = findBestMatch(rawServico, servicesList);

            const parsedDate = parseDate(rawData as string | number | Date);

            let validationError: string | null = null;
            if (!rawPaciente) validationError = "Paciente em falta";
            else if (!rawProfissional) validationError = "Profissional em falta";
            else if (!parsedDate) validationError = "Data inválida";
            else if (rawHora === null || rawHora < 0 || rawHora > 23)
              validationError = "Hora inválida";

            const isRetroactive = parsedDate ? parsedDate < now : false;

            return {
              rowIndex: idx + 1,
              rawPaciente,
              rawProfissional,
              rawServico,
              rawData: String(rawData),
              rawHora,
              rawMinuto,
              rawObservacoes,
              pacienteMatch,
              profissionalMatch,
              servicoMatch,
              parsedDate,
              isRetroactive,
              approved: !validationError && pacienteMatch.confidence !== "sem_match" && profissionalMatch.confidence !== "sem_match",
              validationError,
            };
          });

          resolve(rows);
        } catch (err) {
          reject(new Error("Erro ao processar ficheiro: " + (err instanceof Error ? err.message : String(err))));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Download a template spreadsheet.
   */
  downloadTemplate() {
    const templateData = [
      {
        paciente: "João Silva",
        profissional: "Dr. Maria Santos",
        servico: "Fisioterapia",
        data: "15/02/2026",
        hora: 10,
        minuto: 0,
        observacoes: "Primeira sessão",
      },
      {
        paciente: "Ana Costa",
        profissional: "Dr. Pedro Lima",
        servico: "Pilates",
        data: "16/02/2026",
        hora: 14,
        minuto: 30,
        observacoes: "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agendamentos");

    // Set column widths
    ws["!cols"] = [
      { wch: 25 },
      { wch: 25 },
      { wch: 20 },
      { wch: 12 },
      { wch: 6 },
      { wch: 8 },
      { wch: 30 },
    ];

    XLSX.writeFile(wb, "modelo_agendamento_lote.xlsx");
  },
};
