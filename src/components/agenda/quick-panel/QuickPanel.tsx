import { useState, useMemo } from "react";
import { ChevronRight, X } from "lucide-react";
import { WaitingPatient, QuickNote, NoteType } from "./types";
import { QuickPanelButton } from "./QuickPanelButton";
import { WaitingListTab } from "./WaitingListTab";
import { NotesTab } from "./NotesTab";

export interface QuickPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  patients: WaitingPatient[];
  notes: QuickNote[];
  onAddPatient: (data: Omit<WaitingPatient, "id" | "daysWaiting" | "addedAt">) => void;
  onEditPatient: (id: string, data: Omit<WaitingPatient, "id" | "daysWaiting" | "addedAt">) => void;
  onRemovePatient: (id: string) => void;
  onAddNote: (data: { type: NoteType; text: string; deadline?: string }) => void;
  onEditNote: (id: string, data: { type: NoteType; text: string; deadline?: string }) => void;
  onRemoveNote: (id: string) => void;
  onToggleNote: (id: string) => void;
}

type Tab = "espera" | "notas";

export function QuickPanel({
  isOpen, onToggle, patients, notes,
  onAddPatient, onEditPatient, onRemovePatient,
  onAddNote, onEditNote, onRemoveNote, onToggleNote,
}: QuickPanelProps) {
  const [tab, setTab] = useState<Tab>("espera");

  const hasUrgent = useMemo(() => patients.some((p) => p.priority === "urgente" || p.daysWaiting >= 8), [patients]);
  const pendingNotesCount = notes.filter((n) => !n.completed && n.type !== "fixa").length;

  if (!isOpen) {
    return (
      <QuickPanelButton
        waitingCount={patients.length}
        notesCount={pendingNotesCount}
        hasUrgent={hasUrgent}
        onClick={onToggle}
      />
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full w-[380px] bg-white shadow-[-4px_0_16px_rgba(0,0,0,0.1)] z-40 flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-900">Painel Rápido</h2>
        <button onClick={onToggle} className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab("espera")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors relative ${
            tab === "espera" ? "text-gray-900 font-semibold" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Lista de Espera
          <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${hasUrgent ? "bg-red-500 text-white" : "bg-gray-200 text-gray-600"}`}>
            {patients.length}
          </span>
          {tab === "espera" && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-600 rounded-t" />}
        </button>
        <button
          onClick={() => setTab("notas")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors relative ${
            tab === "notas" ? "text-gray-900 font-semibold" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Lembretes & Notas
          <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">
            {pendingNotesCount}
          </span>
          {tab === "notas" && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-600 rounded-t" />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === "espera" ? (
          <WaitingListTab patients={patients} onAdd={onAddPatient} onEdit={onEditPatient} onRemove={onRemovePatient} />
        ) : (
          <NotesTab notes={notes} onAdd={onAddNote} onEdit={onEditNote} onRemove={onRemoveNote} onToggle={onToggleNote} />
        )}
      </div>
    </div>
  );
}
