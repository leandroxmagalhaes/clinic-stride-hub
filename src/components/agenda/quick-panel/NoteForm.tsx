import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { QuickNote, NoteType, NOTE_TYPE_CONFIG } from "./types";

interface Props {
  editingNote?: QuickNote | null;
  onSubmit: (data: { type: NoteType; text: string; deadline?: string }) => void;
  onCancel: () => void;
}

export function NoteForm({ editingNote, onSubmit, onCancel }: Props) {
  const [type, setType] = useState<NoteType>("tarefa");
  const [text, setText] = useState("");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (editingNote) {
      setType(editingNote.type);
      setText(editingNote.text);
      setDeadline(editingNote.deadline || "");
    }
  }, [editingNote]);

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit({ type, text: text.trim(), deadline: type !== "fixa" && deadline ? deadline : undefined });
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">
          {editingNote ? "Editar Nota" : "Adicionar Nota"}
        </h4>
        <button onClick={onCancel} className="text-xs text-blue-600 hover:underline">Cancelar</button>
      </div>

      <div className="flex gap-2">
        {(["tarefa", "lembrete", "fixa"] as NoteType[]).map((t) => {
          const cfg = NOTE_TYPE_CONFIG[t];
          const active = type === t;
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-colors ${active ? `${cfg.bg} ${cfg.color} ${cfg.border}` : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
            >
              {cfg.icon} {cfg.label}
            </button>
          );
        })}
      </div>

      <Textarea placeholder="Escreva a nota..." value={text} onChange={(e) => setText(e.target.value)} rows={3} className="text-sm resize-none" />

      {type !== "fixa" && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Prazo (opcional)</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
      )}

      <Button onClick={handleSubmit} className="w-full h-9 text-sm" disabled={!text.trim()}>
        {editingNote ? "Salvar Alterações" : "Adicionar Nota"}
      </Button>
    </div>
  );
}
