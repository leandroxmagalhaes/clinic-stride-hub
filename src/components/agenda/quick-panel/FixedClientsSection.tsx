import { useState, useMemo } from "react";
import { ChevronDown, Plus, Calendar } from "lucide-react";
import { FixedClient, Frequency, FREQUENCY_LABELS } from "@/hooks/useFixedClients";
import { FixedClientCard } from "./FixedClientCard";
import { SPECIALTIES } from "./types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  fixedClients: FixedClient[];
  fixedClientSessions: Record<string, number>;
  totalMissingSessions: number;
  onAdd: (data: { nome: string; telefone?: string; especialidade?: string; frequencia: Frequency; sessoes_por_periodo: number; paciente_id?: string }) => void;
  onEdit: (id: string, data: { nome: string; telefone?: string; especialidade?: string; frequencia: Frequency; sessoes_por_periodo: number; paciente_id?: string }) => void;
  onRemove: (id: string) => void;
  onSchedule: (patientId: string) => void;
  patients?: Array<{ id: string; full_name: string }>;
}

const FREQ_OPTIONS: Frequency[] = ["weekly", "biweekly", "monthly", "every2months", "every3months", "every6months"];

export function FixedClientsSection({ fixedClients, fixedClientSessions, totalMissingSessions, onAdd, onEdit, onRemove, onSchedule, patients }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<FixedClient | null>(null);

  // Form state
  const [nome, setNome] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [frequencia, setFrequencia] = useState<Frequency>("weekly");
  const [sessoesPorPeriodo, setSessoesPorPeriodo] = useState(1);
  const [pacienteId, setPacienteId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");

  const hasMissing = totalMissingSessions > 0;

  const filteredPatients = useMemo(() => {
    if (!patients || !patientSearch) return [];
    const q = patientSearch.toLowerCase();
    return patients.filter((p) => p.full_name.toLowerCase().includes(q)).slice(0, 5);
  }, [patients, patientSearch]);

  const resetForm = () => {
    setNome("");
    setEspecialidade("");
    setFrequencia("weekly");
    setSessoesPorPeriodo(1);
    setPacienteId("");
    setPatientSearch("");
    setEditingClient(null);
    setShowForm(false);
  };

  const openEditForm = (client: FixedClient) => {
    setEditingClient(client);
    setNome(client.nome);
    setEspecialidade(client.especialidade || "");
    setFrequencia(client.frequencia);
    setSessoesPorPeriodo(client.sessoes_por_periodo);
    setPacienteId(client.paciente_id || "");
    setPatientSearch("");
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!nome.trim()) return;
    const data = {
      nome: nome.trim(),
      especialidade: especialidade || undefined,
      frequencia,
      sessoes_por_periodo: sessoesPorPeriodo,
      paciente_id: pacienteId || undefined,
    };
    if (editingClient) {
      onEdit(editingClient.id, data);
    } else {
      onAdd(data);
    }
    resetForm();
  };

  const handleRemove = (id: string) => {
    if (confirm("Remover este cliente fixo?")) {
      onRemove(id);
    }
  };

  return (
    <div className="border-b" style={{ borderColor: "#e2e8f0" }}>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors"
        style={{ backgroundColor: hasMissing ? "#fef2f2" : "#f8fafc" }}
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-gray-500" />
          <span className="text-[12px] font-semibold text-gray-800">Clientes Fixos</span>
          {hasMissing ? (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white"
              style={{ animation: "pulse-opacity 2s ease-in-out infinite" }}
            >
              {totalMissingSessions} sessão(ões) em falta
            </span>
          ) : fixedClients.length > 0 ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
              Tudo agendado ✓
            </span>
          ) : null}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 py-2 space-y-2">
          {fixedClients.length === 0 && !showForm && (
            <p className="text-center text-[11px] text-gray-400 py-2">Nenhum cliente fixo</p>
          )}
          {fixedClients.map((c) => (
            <FixedClientCard
              key={c.id}
              client={c}
              sessionsBooked={fixedClientSessions[c.id] || 0}
              onEdit={openEditForm}
              onRemove={handleRemove}
              onSchedule={onSchedule}
            />
          ))}

          {showForm ? (
            <div className="space-y-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[11px] font-semibold text-gray-700">
                {editingClient ? "Editar Cliente Fixo" : "Adicionar Cliente Fixo"}
              </p>

              {/* Patient autocomplete */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nome do paciente"
                  value={pacienteId ? nome : patientSearch || nome}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (pacienteId) {
                      setPacienteId("");
                    }
                    setNome(val);
                    setPatientSearch(val);
                  }}
                  className="w-full h-8 px-2 text-xs border border-gray-200 rounded bg-white focus:ring-1 focus:ring-blue-300 focus:border-blue-300 outline-none"
                />
                {filteredPatients.length > 0 && patientSearch && !pacienteId && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto">
                    {filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setNome(p.full_name);
                          setPacienteId(p.id);
                          setPatientSearch("");
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 transition-colors"
                      >
                        {p.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Specialty */}
              <Select value={especialidade} onValueChange={setEspecialidade}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Especialidade" />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Frequency */}
              <Select value={frequencia} onValueChange={(v) => setFrequencia(v as Frequency)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQ_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sessions per period */}
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Sessões por período</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSessoesPorPeriodo(n)}
                      className={`w-8 h-7 text-xs font-medium rounded border transition-colors ${
                        sessoesPorPeriodo === n
                          ? "border-blue-400 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSubmit}
                  disabled={!nome.trim()}
                  className="flex-1 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editingClient ? "Salvar Alterações" : "Adicionar Cliente Fixo"}
                </button>
                <button onClick={resetForm} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-blue-600 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Cliente Fixo
            </button>
          )}
        </div>
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse-opacity {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
