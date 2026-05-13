import jsPDF from "jspdf";
import { format, differenceInMonths, differenceInYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ClinicalReport } from "@/services/ClinicalReportService";
import { REPORT_TYPE_LABELS } from "@/services/ClinicalReportService";

interface ClinicInfo {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface ReportExtras {
  /** Texto livre: ex. "a equipa pediátrica" */
  finalidade?: string;
  /** Classificação da resposta clínica */
  classificacao?: "favoravel" | "progressiva" | "consolidacao" | "outra";
  /** Texto livre se classificacao === "outra" */
  classificacaoOutra?: string;
  /** Achado clínico relevante (callout azul) */
  achadoClinico?: string;
  /** Sugestão multidisciplinar (callout laranja) */
  sugestaoMultidisciplinar?: string;
  /** Data da primeira sessão (informativa) */
  dataPrimeiraSessao?: string;
}

const CLASSIFICACAO_LABELS: Record<NonNullable<ReportExtras["classificacao"]>, string> = {
  favoravel: "favorável",
  progressiva: "progressiva",
  consolidacao: "em consolidação",
  outra: "",
};

// Tons (tipados como tuplos para o jsPDF)
const COLOR_TEXT: [number, number, number] = [30, 41, 59];      // slate-800
const COLOR_MUTED: [number, number, number] = [100, 116, 139];  // slate-500
const COLOR_RULE: [number, number, number] = [203, 213, 225];   // slate-300
const COLOR_BG_SOFT: [number, number, number] = [248, 250, 252];// slate-50
const COLOR_BLUE: [number, number, number] = [37, 99, 235];     // blue-600
const COLOR_ORANGE: [number, number, number] = [234, 88, 12];   // orange-600

// ---------- helpers ----------

function ageString(birth?: string | null): string {
  if (!birth) return "—";
  const d = new Date(birth);
  if (isNaN(d.getTime())) return "—";
  const today = new Date();
  const years = differenceInYears(today, d);
  if (years >= 2) return `${years} anos`;
  const months = differenceInMonths(today, d);
  if (months >= 1) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const days = Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86400000));
  return `${days} dias`;
}

/** Faz parse do conteúdo livre dividindo-o em blocos a partir dos marcadores
 *  `=== TÍTULO ===` que o "Importar conteúdo" produz. */
function parseSections(raw: string): { title: string; body: string }[] {
  const text = (raw || "").trim();
  if (!text) return [];
  const re = /^===\s*(.+?)\s*===\s*$/gm;
  const matches: { title: string; idx: number; len: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push({ title: m[1], idx: m.index, len: m[0].length });
  }
  if (!matches.length) {
    return [{ title: "Conteúdo Clínico", body: text }];
  }
  const sections: { title: string; body: string }[] = [];
  // texto antes do primeiro marcador (raro) — ignorado para manter limpeza
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx + matches[i].len;
    const end = i + 1 < matches.length ? matches[i + 1].idx : text.length;
    const body = text.slice(start, end).trim();
    sections.push({ title: matches[i].title, body });
  }
  return sections;
}

// ---------- geração ----------

export async function generateClinicalReportPDF(
  report: ClinicalReport,
  clinicInfo?: ClinicInfo,
  extras: ReportExtras = {}
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const marginTop = 25;
  const marginBottom = 22;
  const contentWidth = pageWidth - marginX * 2;

  const clinicName = clinicInfo?.name || "Respira & Desenvolve";
  const tagline = "Fisioterapia Respiratória  ·  Motora  ·  Pediátrica";

  let y = marginTop;

  const ensureSpace = (h: number) => {
    if (y + h > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  const setSerif = (size: number, weight: "normal" | "bold" | "italic" | "bolditalic" = "normal") => {
    doc.setFont("times", weight);
    doc.setFontSize(size);
  };
  const setSans = (size: number, weight: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", weight);
    doc.setFontSize(size);
  };

  const writeWrapped = (
    text: string,
    x: number,
    maxW: number,
    lineHeight: number,
    opts?: { align?: "left" | "center" | "right" }
  ): void => {
    const lines = doc.splitTextToSize(text, maxW) as string[];
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, x, y, opts?.align ? { align: opts.align } : undefined);
      y += lineHeight;
    }
  };

  // ===== CABEÇALHO =====
  doc.setTextColor(...COLOR_TEXT);
  setSerif(22, "bold");
  doc.text(clinicName, pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setTextColor(...COLOR_MUTED);
  setSans(9);
  doc.text(tagline, pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setDrawColor(...COLOR_RULE);
  doc.setLineWidth(0.2);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5;

  // Caixa Nome | Idade
  const patientName = report.paciente?.full_name || "—";
  const idade = ageString(report.paciente?.birth_date);
  const boxHeight = 12;
  doc.setDrawColor(...COLOR_RULE);
  doc.rect(marginX, y, contentWidth, boxHeight);
  doc.line(marginX + contentWidth * 0.65, y, marginX + contentWidth * 0.65, y + boxHeight);

  doc.setTextColor(...COLOR_MUTED);
  setSans(8, "bold");
  doc.text("NOME DO UTENTE", marginX + 3, y + 4);
  doc.text("IDADE", marginX + contentWidth * 0.65 + 3, y + 4);

  doc.setTextColor(...COLOR_TEXT);
  setSerif(11);
  doc.text(patientName, marginX + 3, y + 9);
  doc.text(idade, marginX + contentWidth * 0.65 + 3, y + 9);
  y += boxHeight + 4;

  doc.setDrawColor(...COLOR_RULE);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  // Título
  doc.setTextColor(...COLOR_TEXT);
  setSerif(18, "bold");
  doc.text("Relatório de Fisioterapia", pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setTextColor(...COLOR_MUTED);
  setSerif(10, "italic");
  doc.text("— Acompanhamento Multidisciplinar —", pageWidth / 2, y, { align: "center" });
  y += 10;

  // ===== Renderização de secções =====
  let sectionNumber = 0;
  const renderSectionTitle = (title: string) => {
    sectionNumber += 1;
    ensureSpace(10);
    doc.setTextColor(...COLOR_TEXT);
    setSans(11, "bold");
    doc.text(`${sectionNumber}. ${title}`, marginX, y);
    y += 2;
    doc.setDrawColor(...COLOR_RULE);
    doc.line(marginX, y, marginX + 50, y);
    y += 5;
  };

  const renderSubTitle = (sub: string) => {
    ensureSpace(7);
    doc.setTextColor(...COLOR_TEXT);
    setSans(10, "bold");
    doc.text(sub, marginX, y);
    y += 5;
  };

  const renderParagraph = (text: string) => {
    doc.setTextColor(...COLOR_TEXT);
    setSerif(11);
    writeWrapped(text, marginX, contentWidth, 5.2);
    y += 2;
  };

  const renderBullet = (text: string) => {
    doc.setTextColor(...COLOR_TEXT);
    setSerif(11);
    const bulletX = marginX + 2;
    const textX = marginX + 6;
    const maxW = contentWidth - 6;
    const lines = doc.splitTextToSize(text, maxW) as string[];
    ensureSpace(lines.length * 5);
    doc.text("•", bulletX, y);
    for (const line of lines) {
      ensureSpace(5);
      doc.text(line, textX, y);
      y += 5;
    }
  };

  const renderCallout = (
    label: string,
    text: string,
    accent: [number, number, number]
  ) => {
    setSerif(11);
    const innerW = contentWidth - 10;
    const lines = doc.splitTextToSize(text, innerW) as string[];
    const h = 8 + lines.length * 5 + 4;
    ensureSpace(h + 4);
    doc.setFillColor(...COLOR_BG_SOFT);
    doc.rect(marginX, y, contentWidth, h, "F");
    doc.setFillColor(...accent);
    doc.rect(marginX, y, 1.5, h, "F");

    doc.setTextColor(...accent);
    setSans(8, "bold");
    doc.text(label.toUpperCase(), marginX + 5, y + 5);

    doc.setTextColor(...COLOR_TEXT);
    setSerif(11);
    let ty = y + 11;
    for (const line of lines) {
      doc.text(line, marginX + 5, ty);
      ty += 5;
    }
    y += h + 4;
  };

  /** Renderiza um corpo textual já estruturado linha-a-linha:
   *  - linhas iniciadas por `• ` viram bullets
   *  - linhas `─────` (separadores) e `=== … ===` são ignoradas
   *  - linhas tipo `N. Título` (anamnese) viram subtítulos
   *  - resto vira parágrafo */
  const renderBody = (body: string) => {
    const raw = body.split("\n");
    const buf: string[] = [];

    const flushParagraph = () => {
      if (!buf.length) return;
      const txt = buf.join(" ").replace(/\s+/g, " ").trim();
      if (txt) renderParagraph(txt);
      buf.length = 0;
    };

    for (let i = 0; i < raw.length; i++) {
      const line = raw[i].replace(/\s+$/g, "");
      const trimmed = line.trim();
      if (!trimmed) { flushParagraph(); continue; }
      if (/^─+$/.test(trimmed) || /^-{3,}$/.test(trimmed)) { flushParagraph(); continue; }
      if (/^===\s*.+\s*===$/.test(trimmed)) { flushParagraph(); continue; }
      // Bullet
      if (/^•\s+/.test(trimmed)) {
        flushParagraph();
        renderBullet(trimmed.replace(/^•\s+/, ""));
        continue;
      }
      // Subtítulo numerado da anamnese: "1. Título"
      if (/^\d+\.\s+\S/.test(trimmed) && trimmed.length < 90 && !/[.!?]$/.test(trimmed)) {
        flushParagraph();
        renderSubTitle(trimmed);
        continue;
      }
      // "Label: valor" -> bullet
      if (/^\s{0,4}[A-ZÀ-Úa-zà-ú0-9 ()\-_/]+:\s+/.test(line)) {
        flushParagraph();
        renderBullet(trimmed);
        continue;
      }
      buf.push(trimmed);
    }
    flushParagraph();
  };

  // ===== 1. Enquadramento Clínico =====
  const profName = report.profissional?.full_name || "—";
  const periodoIni = format(new Date(report.periodo_inicio), "dd/MM/yyyy", { locale: ptBR });
  const periodoFim = format(new Date(report.periodo_fim), "dd/MM/yyyy", { locale: ptBR });
  const dataPrimeira = extras.dataPrimeiraSessao
    ? format(new Date(extras.dataPrimeiraSessao), "dd/MM/yyyy", { locale: ptBR })
    : null;
  const finalidade = (extras.finalidade || "").trim();

  renderSectionTitle("Enquadramento Clínico");
  const intro =
    `O/A utente ${patientName} encontra-se em acompanhamento fisioterapêutico ` +
    `na ${clinicName}${dataPrimeira ? ` desde ${dataPrimeira}` : ""}, ` +
    `sob a responsabilidade de ${profName}. O presente relatório consolida ` +
    `os achados clínicos e a evolução terapêutica no período compreendido entre ` +
    `${periodoIni} e ${periodoFim}` +
    (finalidade ? `, com o propósito de informar ${finalidade}.` : ".");
  renderParagraph(intro);

  // ===== Conteúdo (parseado) =====
  const sections = parseSections(report.conteudo || "");
  for (const s of sections) {
    renderSectionTitle(s.title);
    if (s.body) renderBody(s.body);
    else renderParagraph("— sem conteúdo registado —");
  }

  // ===== Callouts opcionais =====
  if (extras.achadoClinico?.trim()) {
    renderCallout("Achado clínico persistente", extras.achadoClinico.trim(), COLOR_BLUE);
  }
  if (extras.sugestaoMultidisciplinar?.trim()) {
    renderCallout("Sugestão no âmbito multidisciplinar", extras.sugestaoMultidisciplinar.trim(), COLOR_ORANGE);
  }

  // ===== Conclusão =====
  const cls = extras.classificacao;
  const classificacaoTxt =
    cls === "outra"
      ? (extras.classificacaoOutra?.trim() || "em curso")
      : cls
      ? CLASSIFICACAO_LABELS[cls]
      : "progressiva";
  renderSectionTitle("Conclusão");
  renderParagraph(
    `O/A utente ${patientName} apresenta resposta clínica ${classificacaoTxt} ao ` +
    `acompanhamento fisioterapêutico em curso. A equipa da ${clinicName} mantém-se ` +
    `disponível para articulação clínica directa, em benefício do desenvolvimento integral ` +
    `e da qualidade de vida do/da utente.`
  );

  // ===== Assinatura =====
  ensureSpace(40);
  y += 8;
  doc.setTextColor(...COLOR_TEXT);
  setSerif(11);
  doc.text("A Fisioterapeuta,", marginX, y);
  y += 18;
  doc.setDrawColor(...COLOR_MUTED);
  doc.line(marginX, y, marginX + 80, y);
  y += 5;
  setSerif(11, "bold");
  doc.text(profName, marginX, y);
  y += 5;
  setSans(9);
  doc.setTextColor(...COLOR_MUTED);
  if (report.profissional?.council_number) {
    doc.text(`(Cédula Profissional n.º ${report.profissional.council_number})`, marginX, y);
    y += 5;
  }
  if (report.profissional?.specialty) {
    doc.text(report.profissional.specialty, marginX, y);
    y += 5;
  }

  // ===== Rodapé em todas as páginas (numeração + identidade) =====
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...COLOR_RULE);
    doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14);
    doc.setTextColor(...COLOR_MUTED);
    setSans(8);
    const left = `${clinicName.toUpperCase()}  ·  FISIOTERAPIA`;
    const right = `Página ${p} de ${totalPages}`;
    doc.text(left, marginX, pageHeight - 8);
    doc.text(right, pageWidth - marginX, pageHeight - 8, { align: "right" });
  }

  // ===== Save =====
  const cleanName = (patientName || "Utente").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
  const dateStr = format(new Date(), "yyyyMM");
  doc.save(`Relatorio_${cleanName}_${dateStr}.pdf`);
}
