import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { WaitingPatient, Priority, SPECIALTIES, PRIORITY_CONFIG, formatPhone } from "./types";

interface Props {
  editingPatient?: WaitingPatient | null;
  onSubmit: (data: Omit<WaitingPatient, "id" | "daysWaiting" | "addedAt">) => void;
  onCancel: () => void;
}

export function WaitingPatientForm({ editingPatient, onSubmit, onCancel }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState<string>(SPECIALTIES[0]);
  const [priority, setPriority] = useState<Priority>("normal");
  const [observations, setObservations] = useState("");

  useEffect(() => {
    if (editingPatient) {
      setName(editingPatient.name);
      setPhone(formatPhone(editingPatient.phone));
      setSpecialty(editingPatient.specialty);
      setPriority(editingPatient.priority);
      setObservations(editingPatient.observations || "");
    }
  }, [editingPatient]);

  const handlePhoneChange = (val: string) => {
    setPhone(formatPhone(val));
  };

  const handleSubmit = () => {
    if (!name.trim() || phone.replace(/\D/g, "").length < 9) return;
    onSubmit({ name: name.trim(), phone: phone.replace(/\D/g, ""), specialty, priority, observations: observations.trim() || undefined });
  };

  const isEditing = !!editingPatient;

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">
          {isEditing ? "Editar Paciente" : "Adicionar Paciente"}
        </h4>
        <button onClick={onCancel} className="text-xs text-blue-600 hover:underline">Cancelar</button>
      </div>

      <Input placeholder="Nome do paciente" value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
      <Input placeholder="912 345 678" value={phone} onChange={(e) => handlePhoneChange(e.target.value)} className="h-9 text-sm" maxLength={11} />

      <select
        value={specialty}
        onChange={(e) => setSpecialty(e.target.value)}
        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <div className="flex gap-2">
        {(["normal", "alta", "urgente"] as Priority[]).map((p) => {
          const cfg = PRIORITY_CONFIG[p];
          const active = priority === p;
          return (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-colors ${active ? `${cfg.bg} ${cfg.text} ${cfg.border}` : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      <Textarea placeholder="Observações (opcional)" value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} className="text-sm resize-none" />

      <Button onClick={handleSubmit} className="w-full h-9 text-sm" disabled={!name.trim() || phone.replace(/\D/g, "").length < 9}>
        {isEditing ? "Salvar Alterações" : "Adicionar à Lista"}
      </Button>
    </div>
  );
}
