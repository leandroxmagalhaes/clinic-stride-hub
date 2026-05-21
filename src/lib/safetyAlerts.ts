// Extracts the 5 critical safety fields from a patient's Anamnese (portal_questionario.respostas).
// Read-only. Does not mutate the questionnaire or its schema.

export type AnamneseAlertEstado = "risco" | "sem_risco" | "vazio";

export interface AnamneseAlert {
  termo: string;
  valor: string;
  estado: AnamneseAlertEstado;
}

const NEGATIVE_WORDS = new Set([
  "nao", "n", "nenhum", "nenhuma", "nenhumas", "nenhuns",
  "na", "n/a", "sem", "nega", "desconhece", "desconheco",
  "0", "-", "—", "nada", "sem registo", "sem alergias", "sem alergia",
  "nao tem", "nao ha", "nao possui", "nao toma", "nao faz", "nao usa",
  "negativo", "ausente",
]);

const FILLER_WORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "ou", "a", "o",
  "tem", "tenho", "possui", "ha", "tem nenhum",
]);

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function classifyValue(value: unknown): AnamneseAlertEstado {
  if (value === null || value === undefined) return "vazio";
  const raw = Array.isArray(value) ? value.join(", ") : String(value);
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "—" || trimmed === "-") return "vazio";
  const normalized = normalize(trimmed).replace(/[.,;!?:()]/g, "").trim();
  if (!normalized) return "vazio";
  if (NEGATIVE_WORDS.has(normalized)) return "sem_risco";
  const tokens = normalized.split(/\s+/);
  if (tokens.every((t) => NEGATIVE_WORDS.has(t) || FILLER_WORDS.has(t))) {
    return "sem_risco";
  }
  return "risco";
}

interface FieldDef {
  termo: string;
  // RegExps that the field label must match (any of). Tested against normalized label.
  labelMatchers: RegExp[];
  // Section title patterns to AVOID (e.g. mother sections in baby template).
  excludeSection?: RegExp[];
  // Field label patterns to AVOID.
  excludeLabel?: RegExp[];
}

const FIELD_DEFS: FieldDef[] = [
  {
    termo: "Alergia",
    labelMatchers: [/alerg/],
    excludeSection: [/mae/, /pre.?natal/],
  },
  {
    termo: "Doenças/internamentos",
    labelMatchers: [
      /doencas?.*(internament|cronic|posterior|prev)/,
      /internament.*(doenca|posterior)/,
      /doencas? cronicas?/,
      /doencas? ou internament/,
      /antecedente/,
      /historico.*medic/,
    ],
    excludeSection: [/mae/, /pre.?natal/, /estado da m/],
  },
  {
    termo: "Episódios respiratórios",
    labelMatchers: [
      /episodios? respirat/,
      /respirat.*(frequente|bronquiol|pneumon|sibil)/,
      /(bronquiol|pneumon|sibil).*respirat/,
    ],
  },
  {
    termo: "Diagnóstico clínico",
    labelMatchers: [/diagnostico/],
    excludeSection: [/mae/, /pre.?natal/, /estado da m/],
  },
  {
    termo: "Medicação contínua",
    labelMatchers: [/medicament/, /medicacao/, /medicac/],
    excludeSection: [/mae/, /pre.?natal/, /estado da m/, /historico pre/],
    excludeLabel: [/mae/],
  },
];

interface TemplateField {
  key: string;
  label?: string;
}
interface TemplateSection {
  id: string;
  title?: string;
  fields?: TemplateField[];
}
interface TemplateSchema {
  sections?: TemplateSection[];
}

function formatValueText(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return String(value);
}

/**
 * Extracts the 5 critical safety fields. Always returns 5 entries, in the
 * canonical order (Alergia, Doenças/internamentos, Episódios respiratórios,
 * Diagnóstico clínico, Medicação contínua). Missing template/responses produce
 * "vazio" entries so the professional sees the complete safety panorama.
 */
export function extrairAlertasAnamnese(
  respostas: Record<string, Record<string, unknown>> | null | undefined,
  templateSchema: TemplateSchema | null | undefined,
): AnamneseAlert[] {
  const sections = templateSchema?.sections || [];
  const results: AnamneseAlert[] = [];

  for (const def of FIELD_DEFS) {
    let foundValue: unknown = undefined;
    let foundAny = false;

    outer: for (const section of sections) {
      const sectionTitleNorm = normalize(section.title || "");
      if (def.excludeSection?.some((rx) => rx.test(sectionTitleNorm))) continue;
      for (const field of section.fields || []) {
        const labelNorm = normalize(field.label || "");
        if (!labelNorm) continue;
        if (def.excludeLabel?.some((rx) => rx.test(labelNorm))) continue;
        if (def.labelMatchers.some((rx) => rx.test(labelNorm))) {
          const sectionAns = respostas?.[section.id];
          foundValue = sectionAns ? sectionAns[field.key] : undefined;
          foundAny = true;
          break outer;
        }
      }
    }

    const estado = foundAny ? classifyValue(foundValue) : "vazio";
    let valor: string;
    if (estado === "vazio") valor = "não preenchido";
    else if (estado === "sem_risco") valor = "não / desconhece";
    else valor = formatValueText(foundValue);

    results.push({ termo: def.termo, valor, estado });
  }

  return results;
}

/** Sort: risco first, then sem_risco, then vazio. Stable within group. */
export function sortAlertsByRisk(alerts: AnamneseAlert[]): AnamneseAlert[] {
  const weight = (e: AnamneseAlertEstado) => (e === "risco" ? 0 : e === "sem_risco" ? 1 : 2);
  return [...alerts].sort((a, b) => weight(a.estado) - weight(b.estado));
}
