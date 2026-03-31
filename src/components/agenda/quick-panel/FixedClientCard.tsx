import { Pencil, Trash2, Plus } from "lucide-react";
import { FixedClient, FREQUENCY_SHORT } from "@/hooks/useFixedClients";

interface Props {
  client: FixedClient;
  sessionsBooked: number;
  onEdit: (client: FixedClient) => void;
  onRemove: (id: string) => void;
  onSchedule: (patientId: string) => void;
}

export function FixedClientCard({ client, sessionsBooked, onEdit, onRemove, onSchedule }: Props) {
  const needed = client.sessoes_por_periodo;
  const booked = Math.min(sessionsBooked, needed);
  const missing = needed - booked;
  const isComplete = missing === 0;
  const progress = needed > 0 ? (booked / needed) * 100 : 100;

  const progressColor = isComplete ? "#22c55e" : booked > 0 ? "#f59e0b" : "#ef4444";
  const borderColor = isComplete ? "#22c55e" : "#ef4444";
  const bgColor = isComplete ? "#fafff9" : "#fffbfb";
  const cardBorderColor = isComplete ? "#bbf7d0" : "#fecaca";

  return (
    <div
      className="rounded-lg p-2.5 text-xs transition-colors"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        background: bgColor,
        border: `1px solid ${cardBorderColor}`,
        borderLeftWidth: "3px",
        borderLeftColor: borderColor,
      }}
    >
      {/* Row 1: Name + specialty + frequency + status */}
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <span className="font-bold text-gray-900 text-[12px] truncate block">{client.nome}</span>
          <div className="flex items-center gap-1 mt-0.5">
            {client.especialidade && (
              <span className="text-[10px] text-gray-500">{client.especialidade}</span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
              {needed}x{FREQUENCY_SHORT[client.frequencia]}
            </span>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
            isComplete ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {isComplete ? `✓ ${booked}/${needed}` : `${booked}/${needed} — faltam ${missing}`}
        </span>
      </div>

      {/* Row 2: Progress bar */}
      <div className="mt-1.5 h-1 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progress}%`, backgroundColor: progressColor }}
        />
      </div>

      {/* Row 3: Actions */}
      <div className="flex items-center justify-end gap-1 mt-1.5">
        {!isComplete && client.paciente_id && (
          <button
            onClick={() => onSchedule(client.paciente_id!)}
            className="flex items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
          >
            <Plus className="h-3 w-3" /> Agendar
          </button>
        )}
        <button onClick={() => onEdit(client)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
          <Pencil className="h-3 w-3" />
        </button>
        <button onClick={() => onRemove(client.id)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
