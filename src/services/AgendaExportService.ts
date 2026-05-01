import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Session } from "./SessionService";
import { SearchCriteria } from "./AgendaSearchService";

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
  falta: "Falta",
  faltou: "Falta",
};

const PAYMENT_LABEL: Record<string, string> = {
  pago: "Pago",
  pendente: "Pendente",
  parcial: "Parcial",
};

function fmtMoney(n: number) {
  return `€ ${(n || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function describeFilters(c: SearchCriteria, professionals: { id: string; full_name: string }[], services: { id: string; name: string }[]): string[] {
  const out: string[] = [];
  if (c.query.trim()) out.push(`Pesquisa: "${c.query.trim()}"`);
  if (c.dateFrom || c.dateTo) {
    const a = c.dateFrom ? format(c.dateFrom, "dd/MM/yyyy") : "início";
    const b = c.dateTo ? format(c.dateTo, "dd/MM/yyyy") : "hoje";
    out.push(`Período: ${a} → ${b}`);
  }
  if (c.professionalIds.length) {
    const names = c.professionalIds.map((id) => professionals.find((p) => p.id === id)?.full_name ?? id);
    out.push(`Profissionais: ${names.join(", ")}`);
  }
  if (c.serviceIds.length) {
    const names = c.serviceIds.map((id) => services.find((p) => p.id === id)?.name ?? id);
    out.push(`Serviços: ${names.join(", ")}`);
  }
  if (c.statuses.length) out.push(`Status: ${c.statuses.map((s) => STATUS_LABEL[s] ?? s).join(", ")}`);
  if (c.paymentStatuses.length) out.push(`Pagamento: ${c.paymentStatuses.map((s) => PAYMENT_LABEL[s] ?? s).join(", ")}`);
  if (!out.length) out.push("Sem filtros aplicados");
  return out;
}

export const AgendaExportService = {
  exportToPDF(
    sessions: Session[],
    criteria: SearchCriteria,
    clinicName: string,
    professionals: { id: string; full_name: string }[],
    services: { id: string; name: string }[],
  ) {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const today = format(new Date(), "dd/MM/yyyy HH:mm");

    doc.setFontSize(16);
    doc.text(clinicName || "Agenda", 40, 40);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Pesquisa de sessões — gerado em ${today}`, 40, 58);

    const filters = describeFilters(criteria, professionals, services);
    doc.setFontSize(9);
    let y = 78;
    filters.forEach((line) => {
      doc.text(line, 40, y);
      y += 12;
    });

    const total = sessions.reduce((acc, s) => acc + (s.price || 0), 0);
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(`${sessions.length} sessões  •  Total: ${fmtMoney(total)}`, 40, y + 6);

    autoTable(doc, {
      startY: y + 18,
      head: [["Data", "Hora", "Utente", "Profissional", "Serviço", "Status", "Valor", "Pagamento"]],
      body: sessions.map((s) => [
        format(new Date(s.start_time), "dd/MM/yyyy"),
        format(new Date(s.start_time), "HH:mm"),
        s.paciente?.full_name ?? "—",
        s.profissional?.full_name ?? "—",
        s.servico?.name ?? "—",
        STATUS_LABEL[s.status] ?? s.status,
        fmtMoney(s.price || 0),
        PAYMENT_LABEL[s.payment_status] ?? s.payment_status,
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });

    doc.save(`agenda_pesquisa_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  },

  exportToExcel(
    sessions: Session[],
    criteria: SearchCriteria,
    professionals: { id: string; full_name: string }[],
    services: { id: string; name: string }[],
  ) {
    const wb = XLSX.utils.book_new();

    const rows = sessions.map((s) => ({
      Data: format(new Date(s.start_time), "dd/MM/yyyy"),
      Hora: format(new Date(s.start_time), "HH:mm"),
      "Hora fim": format(new Date(s.end_time), "HH:mm"),
      "Dia da semana": format(new Date(s.start_time), "EEEE", { locale: ptBR }),
      Utente: s.paciente?.full_name ?? "",
      Profissional: s.profissional?.full_name ?? "",
      Serviço: s.servico?.name ?? "",
      Status: STATUS_LABEL[s.status] ?? s.status,
      Valor: s.price || 0,
      Pagamento: PAYMENT_LABEL[s.payment_status] ?? s.payment_status,
      "Método pagamento": s.payment_method ?? "",
      Notas: s.notes ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Sessões");

    const filters = describeFilters(criteria, professionals, services).map((f) => ({ Filtro: f }));
    const ws2 = XLSX.utils.json_to_sheet(filters);
    XLSX.utils.book_append_sheet(wb, ws2, "Filtros");

    XLSX.writeFile(wb, `agenda_pesquisa_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  },
};
