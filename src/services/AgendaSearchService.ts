import { Session } from "./SessionService";

export interface SearchCriteria {
  query: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  professionalIds: string[];
  serviceIds: string[];
  statuses: string[];
  paymentStatuses: string[];
}

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const EMPTY_CRITERIA: SearchCriteria = {
  query: "",
  dateFrom: null,
  dateTo: null,
  professionalIds: [],
  serviceIds: [],
  statuses: [],
  paymentStatuses: [],
};

export function filterSessions(sessions: Session[], c: SearchCriteria): Session[] {
  const terms = norm(c.query).split(/\s+/).filter(Boolean);

  const from = c.dateFrom ? new Date(c.dateFrom) : null;
  if (from) from.setHours(0, 0, 0, 0);
  const to = c.dateTo ? new Date(c.dateTo) : null;
  if (to) to.setHours(23, 59, 59, 999);

  const result = sessions.filter((s) => {
    const start = new Date(s.start_time);
    if (from && start < from) return false;
    if (to && start > to) return false;
    if (c.professionalIds.length && !c.professionalIds.includes(s.profissional_id)) return false;
    if (c.serviceIds.length && !c.serviceIds.includes(s.servico_id)) return false;
    if (c.statuses.length && !c.statuses.includes(s.status)) return false;
    if (c.paymentStatuses.length && !c.paymentStatuses.includes(s.payment_status)) return false;

    if (terms.length) {
      const haystack = norm(
        [
          s.paciente?.full_name,
          s.profissional?.full_name,
          s.servico?.name,
          s.notes,
          s.status,
        ]
          .filter(Boolean)
          .join(" "),
      );
      for (const t of terms) if (!haystack.includes(t)) return false;
    }
    return true;
  });

  return result.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

export function isCriteriaActive(c: SearchCriteria): boolean {
  return !!(
    c.query.trim() ||
    c.dateFrom ||
    c.dateTo ||
    c.professionalIds.length ||
    c.serviceIds.length ||
    c.statuses.length ||
    c.paymentStatuses.length
  );
}
