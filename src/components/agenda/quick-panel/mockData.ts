import { WaitingPatient, QuickNote } from "./types";

export const MOCK_WAITING_PATIENTS: WaitingPatient[] = [
  { id: "wp1", name: "Sofia Rodrigues", phone: "912345678", specialty: "Motora", daysWaiting: 14, priority: "urgente", addedAt: "2026-03-11" },
  { id: "wp2", name: "Tiago Ferreira", phone: "963456789", specialty: "Respiratória", daysWaiting: 8, priority: "alta", addedAt: "2026-03-17" },
  { id: "wp3", name: "Beatriz Almeida", phone: "926789012", specialty: "Neurodes.", daysWaiting: 4, priority: "normal", addedAt: "2026-03-21" },
  { id: "wp4", name: "Martim Costa", phone: "914567890", specialty: "Motora", daysWaiting: 1, priority: "normal", addedAt: "2026-03-24" },
  { id: "wp5", name: "Leonor Mendes", phone: "935678901", specialty: "Pediátrica", daysWaiting: 10, priority: "alta", addedAt: "2026-03-15" },
  { id: "wp6", name: "Gonçalo Nunes", phone: "961234567", specialty: "Reab. Vestibular", daysWaiting: 2, priority: "normal", addedAt: "2026-03-23" },
];

export const MOCK_NOTES: QuickNote[] = [
  { id: "n1", type: "tarefa", text: "Entregar relatório mensal à contabilidade", deadline: "2026-03-28", completed: false, createdAt: "2026-03-20" },
  { id: "n2", type: "lembrete", text: "Ligar para Sofia Rodrigues — confirmar disponibilidade", deadline: "2026-03-25", completed: false, createdAt: "2026-03-22" },
  { id: "n3", type: "fixa", text: "Wi-Fi: Physione2026 / Senha: Respira@2026", completed: false, createdAt: "2026-03-01" },
  { id: "n4", type: "tarefa", text: "Pedir material de reabilitação vestibular", deadline: "2026-03-24", completed: true, createdAt: "2026-03-18" },
  { id: "n5", type: "fixa", text: "Horário de almoço: 13h–14h (não agendar)", completed: false, createdAt: "2026-03-01" },
  { id: "n6", type: "lembrete", text: "Reunião de equipa — sexta 17h", deadline: "2026-03-27", completed: false, createdAt: "2026-03-23" },
];
