import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { WaitingPatient, Priority, SPECIALTIES } from "./types";
import { WaitingPatientCard } from "./WaitingPatientCard";
import { WaitingPatientForm } from "./WaitingPatientForm";
import { toast } from "sonner";

interface Props {
  patients: WaitingPatient[];
  onAdd: (data: Omit<WaitingPatient, "id" | "daysWaiting" | "addedAt">) => void;
  onEdit: (id: string, data: Omit<WaitingPatient, "id" | "daysWaiting" | "addedAt">) => void;
  onRemove: (id: string) => void;
}

const PRIORITY_ORDER: Record<Priority, number> = { urgente: 0, alta: 1, normal: 2 };

export function WaitingListTab({ patients, onAdd, onEdit, onRemove }: Props) {
  const [filter, setFilter] = useState("Todas");
  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<WaitingPatient | null>(null);

  const usedSpecialties = useMemo(() => {
    const set = new Set(patients.map((p) => p.specialty));
    return SPECIALTIES.filter((s) => set.has(s));
  }, [patients]);

  const sorted = useMemo(() => {
    let list = filter === "Todas" ? patients : patients.filter((p) => p.specialty === filter);
    return [...list].sort((a, b) => {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pd !== 0) return pd;
      return b.daysWaiting - a.daysWaiting;
    });
  }, [patients, filter]);

  const handleSubmit = (data: Omit<WaitingPatient, "id" | "daysWaiting" | "addedAt">) => {
    if (editingPatient) {
      onEdit(editingPatient.id, data);
      toast.success("Paciente atualizado com sucesso");
    } else {
      onAdd(data);
      toast.success("Paciente adicionado à lista de espera");
    }
    setShowForm(false);
    setEditingPatient(null);
  };

  const handleEdit = (patient: WaitingPatient) => {
    setEditingPatient(patient);
    setShowForm(true);
  };

  const handleRemove = (id: string) => {
    onRemove(id);
    toast.success("Paciente removido da lista de espera");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter chips */}
      <div className="px-4 py-2 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {["Todas", ...usedSpecialties].map((chip) => (
            <button
              key={chip}
              onClick={() => setFilter(chip)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors whitespace-nowrap ${
                filter === chip
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {sorted.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-8">Nenhum paciente na lista</p>
        )}
        {sorted.map((p) => (
          <WaitingPatientCard key={p.id} patient={p} onEdit={handleEdit} onRemove={handleRemove} />
        ))}
      </div>

      {/* Add button or form */}
      {showForm ? (
        <WaitingPatientForm
          editingPatient={editingPatient}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingPatient(null); }}
        />
      ) : (
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-blue-600 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Plus className="h-4 w-4" /> Adicionar Paciente
          </button>
        </div>
      )}
    </div>
  );
}
