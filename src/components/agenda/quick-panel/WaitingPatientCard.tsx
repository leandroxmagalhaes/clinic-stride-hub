import { useState } from "react";
import { Phone, Pencil, Trash2 } from "lucide-react";
import { WaitingPatient, PRIORITY_CONFIG, getDaysColor, formatPhone } from "./types";

interface Props {
  patient: WaitingPatient;
  onEdit: (patient: WaitingPatient) => void;
  onRemove: (id: string) => void;
}

export function WaitingPatientCard({ patient, onEdit, onRemove }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const priority = PRIORITY_CONFIG[patient.priority];
  const borderColor = getDaysColor(patient.daysWaiting);

  if (confirmDelete) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 animate-fade-in">
        <p className="text-sm font-medium text-red-700 mb-2">Remover {patient.name} da lista?</p>
        <div className="flex gap-2">
          <button
            onClick={() => { onRemove(patient.id); setConfirmDelete(false); }}
            className="px-3 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Sim
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Não
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden animate-fade-in" style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}>
      <div className="p-3">
        <div className="flex items-start justify-between mb-1">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-gray-900 truncate">{patient.name}</p>
            <p className="text-[11px] text-gray-500">{patient.specialty}</p>
          </div>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${priority.bg} ${priority.text} ${priority.border} shrink-0 ml-2`}>
            {priority.label}
          </span>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <Phone className="h-3 w-3" />
            <span>{formatPhone(patient.phone)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: borderColor }} />
            <span style={{ color: borderColor }} className="font-medium">{patient.daysWaiting} dias</span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 flex">
        <button
          onClick={() => window.open(`tel:${patient.phone}`, "_self")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <Phone className="h-3 w-3" /> Contatar
        </button>
        <button
          onClick={() => onEdit(patient)}
          className="px-3 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-l border-gray-100"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          className="px-3 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-gray-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
