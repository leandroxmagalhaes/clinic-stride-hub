import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { QuickNote, NoteType } from "./types";
import { NoteCard } from "./NoteCard";
import { NoteForm } from "./NoteForm";
import { toast } from "sonner";

interface Props {
  notes: QuickNote[];
  onAdd: (data: { type: NoteType; text: string; deadline?: string }) => void;
  onEdit: (id: string, data: { type: NoteType; text: string; deadline?: string }) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}

type FilterKey = "Todas" | "Pendentes" | "Tarefas" | "Lembretes" | "Fixas";

export function NotesTab({ notes, onAdd, onEdit, onRemove, onToggle }: Props) {
  const [filter, setFilter] = useState<FilterKey>("Todas");
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<QuickNote | null>(null);

  const pendingCount = notes.filter((n) => !n.completed && n.type !== "fixa").length;

  const filtered = useMemo(() => {
    let list = notes;
    switch (filter) {
      case "Pendentes": list = notes.filter((n) => !n.completed && n.type !== "fixa"); break;
      case "Tarefas": list = notes.filter((n) => n.type === "tarefa"); break;
      case "Lembretes": list = notes.filter((n) => n.type === "lembrete"); break;
      case "Fixas": list = notes.filter((n) => n.type === "fixa"); break;
    }
    return [...list].sort((a, b) => {
      if (a.type === "fixa" && b.type !== "fixa") return -1;
      if (a.type !== "fixa" && b.type === "fixa") return 1;
      if (!a.completed && b.completed) return -1;
      if (a.completed && !b.completed) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notes, filter]);

  const chips: { key: FilterKey; label: string }[] = [
    { key: "Todas", label: "Todas" },
    { key: "Pendentes", label: `Pendentes (${pendingCount})` },
    { key: "Tarefas", label: "Tarefas" },
    { key: "Lembretes", label: "Lembretes" },
    { key: "Fixas", label: "Fixas" },
  ];

  const handleSubmit = (data: { type: NoteType; text: string; deadline?: string }) => {
    if (editingNote) {
      onEdit(editingNote.id, data);
      toast.success("Nota atualizada com sucesso");
    } else {
      onAdd(data);
      toast.success("Nota adicionada com sucesso");
    }
    setShowForm(false);
    setEditingNote(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors whitespace-nowrap ${
                filter === c.key ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-8">Nenhuma nota</p>}
        {filtered.map((n) => (
          <NoteCard key={n.id} note={n} onToggle={onToggle} onEdit={(note) => { setEditingNote(note); setShowForm(true); }} onRemove={(id) => { onRemove(id); toast.success("Nota removida"); }} />
        ))}
      </div>

      {showForm ? (
        <NoteForm editingNote={editingNote} onSubmit={handleSubmit} onCancel={() => { setShowForm(false); setEditingNote(null); }} />
      ) : (
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-blue-600 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Plus className="h-4 w-4" /> Adicionar Nota
          </button>
        </div>
      )}
    </div>
  );
}
