import { useState, useMemo, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Merge, X, Phone, Mail, Calendar, Hash, Trash2, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";
import { cascadeDeletePatient } from "@/services/PatientCascadeDeleteService";
import type { Patient } from "@/services/PatientService";

interface DuplicatePatientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  onMergeComplete: () => void;
  isAdminMaster?: boolean;
}

interface DuplicatePair {
  a: Patient;
  b: Patient;
  key: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findDuplicates(patients: Patient[]): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < patients.length; i++) {
    const nameA = normalize(patients[i].full_name || "");
    const wordsA = nameA.split(" ").filter(Boolean);
    if (!nameA) continue;
    for (let j = i + 1; j < patients.length; j++) {
      const nameB = normalize(patients[j].full_name || "");
      if (!nameB) continue;
      if (nameA.includes(nameB) || nameB.includes(nameA)) {
        pairs.push({ a: patients[i], b: patients[j], key: `${patients[i].id}-${patients[j].id}` });
        continue;
      }
      const wordsB = nameB.split(" ").filter(Boolean);
      const intersection = wordsA.filter(w => wordsB.includes(w)).length;
      const overlap = intersection / Math.max(wordsA.length, wordsB.length);
      if (overlap >= 0.8) {
        pairs.push({ a: patients[i], b: patients[j], key: `${patients[i].id}-${patients[j].id}` });
      }
    }
  }
  return pairs;
}

const MERGE_FIELDS: (keyof Patient)[] = [
  'phone', 'email', 'birth_date', 'cpf', 'gender', 'address',
  'emergency_contact', 'emergency_phone', 'health_insurance', 'notes',
];

export function DuplicatePatientsModal({ isOpen, onClose, patients, onMergeComplete, isAdminMaster = false }: DuplicatePatientsModalProps) {
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const [mergingPairKey, setMergingPairKey] = useState<string | null>(null);
  const [mergeChoices, setMergeChoices] = useState<{ keepId: string; name: string; phone: string; email: string }>({ keepId: "", name: "", phone: "", email: "" });
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ patient: Patient; pairKey: string } | null>(null);

  const allPairs = useMemo(() => findDuplicates(patients), [patients]);
  const visiblePairs = useMemo(() => allPairs.filter(p => !dismissedPairs.has(p.key)), [allPairs, dismissedPairs]);

  useEffect(() => {
    if (!isOpen || patients.length === 0) return;
    setLoading(true);
    (supabase as any)
      .from("sessoes")
      .select("paciente_id")
      .then(({ data }: { data: { paciente_id: string }[] | null }) => {
        const counts: Record<string, number> = {};
        (data || []).forEach(row => {
          counts[row.paciente_id] = (counts[row.paciente_id] || 0) + 1;
        });
        setSessionCounts(counts);
        setLoading(false);
      });
  }, [isOpen, patients]);

  useEffect(() => {
    if (!isOpen) {
      setDismissedPairs(new Set());
      setMergingPairKey(null);
      setDeleteTarget(null);
    }
  }, [isOpen]);

  const startMerge = useCallback((pair: DuplicatePair) => {
    setMergingPairKey(pair.key);
    setMergeChoices({
      keepId: pair.a.id,
      name: pair.a.full_name || "",
      phone: pair.a.phone || pair.b.phone || "",
      email: pair.a.email || pair.b.email || "",
    });
  }, []);

  const handleConfirmMerge = async (pair: DuplicatePair) => {
    setActionLoading(true);
    try {
      const keepId = mergeChoices.keepId;
      const discardId = keepId === pair.a.id ? pair.b.id : pair.a.id;

      await (supabase as any).from("sessoes").update({ paciente_id: keepId }).eq("paciente_id", discardId);

      const keptPatient = keepId === pair.a.id ? pair.a : pair.b;
      const updates: Record<string, string> = {};
      if (mergeChoices.name !== (keptPatient.full_name || "")) updates.full_name = mergeChoices.name;
      if (mergeChoices.phone !== (keptPatient.phone || "")) updates.phone = mergeChoices.phone;
      if (mergeChoices.email !== (keptPatient.email || "")) updates.email = mergeChoices.email;
      if (Object.keys(updates).length > 0) {
        await supabase.from("pacientes").update(updates).eq("id", keepId);
      }

      await supabase.from("pacientes").delete().eq("id", discardId);

      setDismissedPairs(prev => new Set(prev).add(pair.key));
      setMergingPairKey(null);
      onMergeComplete();
      toast.success("Pacientes mesclados com sucesso!");
    } catch (err) {
      toast.error("Erro ao mesclar pacientes");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSmartComplete = async (pair: DuplicatePair) => {
    setActionLoading(true);
    try {
      const countA = sessionCounts[pair.a.id] || 0;
      const countB = sessionCounts[pair.b.id] || 0;
      const keep = countA >= countB ? pair.a : pair.b;
      const donor = countA >= countB ? pair.b : pair.a;

      // Build updates: fill empty fields from donor
      const updates: Record<string, any> = {};
      for (const field of MERGE_FIELDS) {
        const keepVal = (keep as any)[field];
        const donorVal = (donor as any)[field];
        if ((!keepVal || keepVal === '') && donorVal && donorVal !== '') {
          updates[field] = donorVal;
        }
      }
      // Also merge health_tags arrays
      const keepTags: string[] = (keep as any).health_tags || [];
      const donorTags: string[] = (donor as any).health_tags || [];
      if (donorTags.length > 0) {
        const merged = [...new Set([...keepTags, ...donorTags])];
        if (merged.length > keepTags.length) {
          updates.health_tags = merged;
        }
      }

      // Reassign donor sessions to keep
      await (supabase as any).from("sessoes").update({ paciente_id: keep.id }).eq("paciente_id", donor.id);

      // Update kept patient
      if (Object.keys(updates).length > 0) {
        await supabase.from("pacientes").update(updates).eq("id", keep.id);
      }

      // Delete donor
      await supabase.from("pacientes").delete().eq("id", donor.id);

      setDismissedPairs(prev => new Set(prev).add(pair.key));
      onMergeComplete();
      toast.success(`Dados completados. Mantido: ${keep.full_name} (${Math.max(countA, countB)} sessões)`);
    } catch (err) {
      toast.error("Erro ao completar dados");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOne = async (patientId: string) => {
    await cascadeDeletePatient(patientId, deleteTarget?.patient.full_name);
    if (deleteTarget) {
      setDismissedPairs(prev => new Set(prev).add(deleteTarget.pairKey));
    }
    setDeleteTarget(null);
    onMergeComplete();
  };

  const renderPatientSide = (patient: Patient, pair: DuplicatePair) => (
    <div className="flex-1 space-y-1.5 min-w-0">
      <p className="font-semibold truncate">{patient.full_name}</p>
      <div className="text-sm text-muted-foreground space-y-1">
        {patient.phone && (
          <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" /><span className="truncate">{patient.phone}</span></div>
        )}
        {patient.email && (
          <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{patient.email}</span></div>
        )}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>{(patient as any).created_at ? format(new Date((patient as any).created_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Hash className="h-3 w-3 shrink-0" />
          <span>{sessionCounts[patient.id] || 0} sessões</span>
        </div>
      </div>
      {isAdminMaster && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 mt-1 h-7 text-xs px-2"
          onClick={() => setDeleteTarget({ patient, pairKey: pair.key })}
          disabled={actionLoading}
        >
          <Trash2 className="h-3 w-3 mr-1" /> Excluir este
        </Button>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verificar Duplicados</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : visiblePairs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="font-medium">Nenhum duplicado encontrado</p>
              <p className="text-sm mt-1">Todos os pacientes parecem ser únicos.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{visiblePairs.length} possível(eis) duplicado(s)</p>
              {visiblePairs.map(pair => {
                const isMerging = mergingPairKey === pair.key;
                const namesDiffer = normalize(pair.a.full_name || "") !== normalize(pair.b.full_name || "");
                const phonesDiffer = (pair.a.phone || "") !== (pair.b.phone || "") && !!(pair.a.phone && pair.b.phone);
                const emailsDiffer = (pair.a.email || "") !== (pair.b.email || "") && !!(pair.a.email && pair.b.email);

                return (
                  <Card key={pair.key}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex gap-4">
                        {renderPatientSide(pair.a, pair)}
                        <div className="w-px bg-border shrink-0" />
                        {renderPatientSide(pair.b, pair)}
                      </div>

                      {!isMerging ? (
                        <div className="flex gap-2 justify-end flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => setDismissedPairs(prev => new Set(prev).add(pair.key))}>
                            <X className="h-3.5 w-3.5 mr-1" /> Não é duplicado
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleSmartComplete(pair)} disabled={actionLoading}>
                            {actionLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />}
                            Completar dados
                          </Button>
                          <Button size="sm" onClick={() => startMerge(pair)}>
                            <Merge className="h-3.5 w-3.5 mr-1" /> Mesclar
                          </Button>
                        </div>
                      ) : (
                        <div className="border-t pt-3 space-y-3">
                          {namesDiffer && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Manter qual nome?</Label>
                              <RadioGroup value={mergeChoices.name} onValueChange={v => setMergeChoices(c => ({ ...c, name: v }))}>
                                <div className="flex items-center gap-2"><RadioGroupItem value={pair.a.full_name || ""} id={`n-a-${pair.key}`} /><Label htmlFor={`n-a-${pair.key}`} className="text-sm">{pair.a.full_name}</Label></div>
                                <div className="flex items-center gap-2"><RadioGroupItem value={pair.b.full_name || ""} id={`n-b-${pair.key}`} /><Label htmlFor={`n-b-${pair.key}`} className="text-sm">{pair.b.full_name}</Label></div>
                              </RadioGroup>
                            </div>
                          )}
                          {phonesDiffer && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Manter qual telefone?</Label>
                              <RadioGroup value={mergeChoices.phone} onValueChange={v => setMergeChoices(c => ({ ...c, phone: v }))}>
                                <div className="flex items-center gap-2"><RadioGroupItem value={pair.a.phone!} id={`p-a-${pair.key}`} /><Label htmlFor={`p-a-${pair.key}`} className="text-sm">{pair.a.phone}</Label></div>
                                <div className="flex items-center gap-2"><RadioGroupItem value={pair.b.phone!} id={`p-b-${pair.key}`} /><Label htmlFor={`p-b-${pair.key}`} className="text-sm">{pair.b.phone}</Label></div>
                              </RadioGroup>
                            </div>
                          )}
                          {emailsDiffer && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Manter qual email?</Label>
                              <RadioGroup value={mergeChoices.email} onValueChange={v => setMergeChoices(c => ({ ...c, email: v }))}>
                                <div className="flex items-center gap-2"><RadioGroupItem value={pair.a.email!} id={`e-a-${pair.key}`} /><Label htmlFor={`e-a-${pair.key}`} className="text-sm">{pair.a.email}</Label></div>
                                <div className="flex items-center gap-2"><RadioGroupItem value={pair.b.email!} id={`e-b-${pair.key}`} /><Label htmlFor={`e-b-${pair.key}`} className="text-sm">{pair.b.email}</Label></div>
                              </RadioGroup>
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Manter qual registro?</Label>
                            <RadioGroup value={mergeChoices.keepId} onValueChange={v => setMergeChoices(c => ({ ...c, keepId: v }))}>
                              <div className="flex items-center gap-2"><RadioGroupItem value={pair.a.id} id={`k-a-${pair.key}`} /><Label htmlFor={`k-a-${pair.key}`} className="text-sm">{pair.a.full_name} ({sessionCounts[pair.a.id] || 0} sessões)</Label></div>
                              <div className="flex items-center gap-2"><RadioGroupItem value={pair.b.id} id={`k-b-${pair.key}`} /><Label htmlFor={`k-b-${pair.key}`} className="text-sm">{pair.b.full_name} ({sessionCounts[pair.b.id] || 0} sessões)</Label></div>
                            </RadioGroup>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setMergingPairKey(null)} disabled={actionLoading}>Cancelar</Button>
                            <Button size="sm" onClick={() => handleConfirmMerge(pair)} disabled={actionLoading}>
                              {actionLoading && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                              Confirmar Mesclagem
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDeleteOne(deleteTarget!.patient.id)}
        title="Excluir Paciente Permanentemente"
        description="Esta ação é irreversível. Todos os dados, sessões, evoluções e registos associados serão apagados permanentemente."
        entityName={deleteTarget?.patient.full_name || ""}
        warnings={[
          "Todas as sessões serão eliminadas",
          "Evoluções e prontuários serão apagados",
          "Esta ação não pode ser revertida",
        ]}
        confirmLabel="Excluir Permanentemente"
      />
    </>
  );
}
