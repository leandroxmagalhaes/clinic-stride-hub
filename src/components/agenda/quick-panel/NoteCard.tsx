import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { QuickNote, NOTE_TYPE_CONFIG, getDeadlineBadge } from "./types";

interface Props {
  note: QuickNote;
  onToggle: (id: string) => void;
  onEdit: (note: QuickNote) => void;
  onRemove: (id: string) => void;
}

export function NoteCard({ note, onToggle, onEdit, onRemove }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cfg = NOTE_TYPE_CONFIG[note.type];
  const deadlineBadge = note.deadline ? getDeadlineBadge(note.deadline, note.completed) : null;
  const isFixed = note.type === "fixa";
  const borderColor = note.completed ? "#cbd5e1" : undefined;

  if (confirmDelete) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 animate-fade-in">
        <p className="text-sm font-medium text-red-700 mb-2">Remover esta nota?</p>
        <div className="flex gap-2">
          <button onClick={() => { onRemove(note.id); setConfirmDelete(false); }} className="px-3 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors">Sim</button>
          <button onClick={() => setConfirmDelete(false)} className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors">Não</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border overflow-hidden animate-fade-in ${isFixed && !note.completed ? "bg-purple-50/50 border-purple-200" : "bg-white border-gray-200"}`}
      style={{ borderLeftWidth: 3, borderLeftColor: borderColor || (note.type === "tarefa" ? "#3b82f6" : note.type === "lembrete" ? "#f59e0b" : "#8b5cf6") }}
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          {isFixed ? (
            <span className="text-sm mt-0.5 shrink-0">📌</span>
          ) : (
            <input
              type="checkbox"
              checked={note.completed}
              onChange={() => onToggle(note.id)}
              className="mt-1 h-3.5 w-3.5 rounded border-gray-300 accent-blue-600 shrink-0 cursor-pointer"
            />
          )}

          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium leading-snug ${note.completed ? "line-through opacity-55 text-gray-500" : "text-gray-800"}`}>
              {note.text}
            </p>

            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                {cfg.label}
              </span>
              {deadlineBadge && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${deadlineBadge.className}`}>
                  {deadlineBadge.label}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => onEdit(note)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
              <Pencil className="h-3 w-3" />
            </button>
            <button onClick={() => setConfirmDelete(true)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
