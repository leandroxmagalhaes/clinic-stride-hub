import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ClinicalReport } from "@/services/ClinicalReportService";
import { REPORT_TYPE_LABELS } from "@/services/ClinicalReportService";

interface ClinicInfo {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
}

/**
 * Generate a professional PDF for a clinical report
 */
export async function generateClinicalReportPDF(
  report: ClinicalReport,
  clinicInfo?: ClinicInfo
): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Colors
  const primaryColor = [16, 185, 129] as [number, number, number]; // Emerald/Primary
  const textColor = [30, 41, 59] as [number, number, number]; // Slate 800
  const mutedColor = [100, 116, 139] as [number, number, number]; // Slate 500

  // Helper function to add text with word wrap
  const addWrappedText = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number = 5
  ): number => {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * lineHeight;
  };

  // Helper function to check page break
  const checkPageBreak = (requiredSpace: number): void => {
    if (yPos + requiredSpace > pageHeight - 30) {
      doc.addPage();
      yPos = margin;
    }
  };

  // =====================
  // HEADER
  // =====================
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(clinicInfo?.name || "Clínica", margin, 15);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("RELATÓRIO FISIOTERAPÊUTICO", margin, 25);

  yPos = 45;

  // =====================
  // PATIENT INFO
  // =====================
  doc.setTextColor(...textColor);
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.rect(margin, yPos, contentWidth, 25, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO PACIENTE", margin + 5, yPos + 6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedColor);

  const patientName = report.paciente?.full_name || "N/A";
  const birthDate = report.paciente?.birth_date
    ? format(new Date(report.paciente.birth_date), "dd/MM/yyyy", { locale: ptBR })
    : "N/A";
  const phone = report.paciente?.phone || "N/A";
  const email = report.paciente?.email || "N/A";

  doc.text(`Nome: ${patientName}`, margin + 5, yPos + 13);
  doc.text(`Data de Nascimento: ${birthDate}`, margin + 5, yPos + 19);
  doc.text(`Telefone: ${phone} | Email: ${email}`, pageWidth / 2, yPos + 13);

  yPos += 32;

  // =====================
  // REPORT INFO
  // =====================
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("INFORMAÇÕES DO RELATÓRIO", margin, yPos);
  yPos += 6;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedColor);

  const reportType = REPORT_TYPE_LABELS[report.tipo];
  const periodStart = format(new Date(report.periodo_inicio), "dd/MM/yyyy", { locale: ptBR });
  const periodEnd = format(new Date(report.periodo_fim), "dd/MM/yyyy", { locale: ptBR });
  const sessions = report.sessoes_realizadas || 0;

  doc.text(`Tipo: ${reportType}`, margin, yPos);
  doc.text(`Período: ${periodStart} a ${periodEnd}`, margin + 60, yPos);
  doc.text(`Sessões Realizadas: ${sessions}`, margin + 130, yPos);

  yPos += 10;

  // =====================
  // CLINICAL CONTENT
  // =====================
  
  // Check if using new single content field or legacy fields
  if (report.conteudo) {
    // New format: Single content field
    checkPageBreak(30);
    
    doc.setTextColor(...primaryColor);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("CONTEÚDO DO RELATÓRIO", margin, yPos);
    yPos += 6;
    
    doc.setTextColor(...textColor);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    yPos = addWrappedText(report.conteudo, margin, yPos, contentWidth, 5);
    yPos += 10;
  } else {
    // Legacy format: Multiple section fields (retrocompatibility)
    const sections = [
      { title: "DIAGNÓSTICO CLÍNICO", content: report.diagnostico_clinico },
      { title: "OBJETIVO DO TRATAMENTO", content: report.objetivo_tratamento },
      { title: "EVOLUÇÃO DO PACIENTE", content: report.evolucao_paciente },
      { title: "RESULTADOS OBTIDOS", content: report.resultados_obtidos },
      { title: "RECOMENDAÇÕES", content: report.recomendacoes },
      { title: "OBSERVAÇÕES", content: report.observacoes },
    ];

    for (const section of sections) {
      if (!section.content) continue;

      checkPageBreak(25);

      // Section title
      doc.setTextColor(...primaryColor);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(section.title, margin, yPos);
      yPos += 5;

      // Section content
      doc.setTextColor(...textColor);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      yPos = addWrappedText(section.content, margin, yPos, contentWidth, 4.5);
      yPos += 8;
    }
  }

  // =====================
  // RECIPIENT
  // =====================
  if (report.destinatario_nome) {
    checkPageBreak(25);

    doc.setDrawColor(...primaryColor);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("DESTINATÁRIO", margin, yPos);
    yPos += 6;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedColor);
    doc.text(report.destinatario_nome, margin, yPos);
    if (report.destinatario_especialidade) {
      doc.text(report.destinatario_especialidade, margin + 60, yPos);
    }
    if (report.destinatario_identificacao) {
      doc.text(report.destinatario_identificacao, margin + 120, yPos);
    }
    yPos += 10;
  }

  // =====================
  // SIGNATURE
  // =====================
  checkPageBreak(40);

  yPos = Math.max(yPos, pageHeight - 60);

  doc.setDrawColor(...mutedColor);
  doc.line(margin, yPos, margin + 70, yPos);

  yPos += 5;
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(report.profissional?.full_name || "Profissional", margin, yPos);

  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedColor);
  doc.setFontSize(9);

  if (report.profissional?.specialty) {
    doc.text(report.profissional.specialty, margin, yPos);
    yPos += 4;
  }
  if (report.profissional?.council_number) {
    doc.text(report.profissional.council_number, margin, yPos);
    yPos += 4;
  }

  // Date and location
  const currentDate = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.text(`Data: ${currentDate}`, margin, yPos + 3);

  // =====================
  // FOOTER
  // =====================
  doc.setFillColor(248, 250, 252);
  doc.rect(0, pageHeight - 15, pageWidth, 15, "F");

  doc.setTextColor(...mutedColor);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  const footerText = [
    clinicInfo?.name,
    clinicInfo?.address,
    clinicInfo?.phone,
    clinicInfo?.email,
  ]
    .filter(Boolean)
    .join(" | ");

  doc.text(footerText || "Documento gerado digitalmente", pageWidth / 2, pageHeight - 7, {
    align: "center",
  });

  // =====================
  // SAVE PDF
  // =====================
  const patientNameClean = (report.paciente?.full_name || "Paciente")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 30);
  const dateStr = format(new Date(), "yyyyMM");
  const filename = `Relatorio_${patientNameClean}_${dateStr}.pdf`;

  doc.save(filename);
}
