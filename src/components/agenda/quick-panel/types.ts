export type Priority = "normal" | "alta" | "urgente";

export type NoteType = "tarefa" | "lembrete" | "fixa";

export interface WaitingPatient {
  id: string;
  name: string;
  phone: string;
  specialty: string;
  daysWaiting: number;
  priority: Priority;
  observations?: string;
  addedAt: string;
}

export interface QuickNote {
  id: string;
  type: NoteType;
  text: string;
  deadline?: string;
  completed: boolean;
  createdAt: string;
}

export const SPECIALTIES = [
  "Motora",
  "Respiratória",
  "Neurodes.",
  "Reab. Vestibular",
  "Pediátrica",
  "Desportiva",
  "Pélvica",
] as const;

export const PRIORITY_CONFIG: Record<Priority, { label: string; bg: string; text: string; border: string }> = {
  normal: { label: "Normal", bg: "bg-green-50", text: "text-green-700", border: "border-green-300" },
  alta: { label: "Alta", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  urgente: { label: "Urgente", bg: "bg-red-50", text: "text-red-700", border: "border-red-300" },
};

export const NOTE_TYPE_CONFIG: Record<NoteType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  tarefa: { label: "Tarefa", icon: "☐", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-300" },
  lembrete: { label: "Lembrete", icon: "🔔", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-300" },
  fixa: { label: "Nota fixa", icon: "📌", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-300" },
};

export function getDaysColor(days: number): string {
  if (days <= 3) return "#22c55e";
  if (days <= 7) return "#f59e0b";
  return "#ef4444";
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function getDeadlineBadge(deadline: string, completed: boolean): { label: string; className: string } | null {
  if (completed || !deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { label: `${Math.abs(diff)}d atrasado`, className: "bg-red-50 text-red-600 border-red-200" };
  if (diff === 0) return { label: "Hoje", className: "bg-amber-50 text-amber-600 border-amber-200" };
  if (diff === 1) return { label: "Amanhã", className: "bg-blue-50 text-blue-600 border-blue-200" };
  return { label: `${diff}d`, className: "bg-gray-100 text-gray-500 border-gray-200" };
}
