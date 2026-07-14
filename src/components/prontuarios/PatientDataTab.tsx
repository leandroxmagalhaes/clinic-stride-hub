import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Phone, Mail, MapPin, Calendar, IdCard, ShieldAlert, Package, Globe, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Patient } from "@/services/PatientService";
import { HealthTag } from "@/services/HealthTagService";
import { HealthTagList } from "@/components/ui/health-tag-badge";
import { EditPatientModal } from "@/components/patients/EditPatientModal";
import { PatientPriceCard } from "@/components/patients/PatientPriceCard";
import { useData } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { differenceInYears, differenceInMonths, format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";

interface PatientDataTabProps {
  patient: Patient;
  onPatientUpdated?: (updated: Partial<Patient>) => void;
}

function calcAge(birth?: string | null): string {
  if (!birth) return "";
  try {
    const d = parseISO(birth);
    const years = differenceInYears(new Date(), d);
    if (years >= 2) return `${years} anos`;
    const months = differenceInMonths(new Date(), d);
    if (months >= 1) return `${months} ${months === 1 ? "mês" : "meses"}`;
    return "Recém-nascido";
  } catch {
    return "";
  }
}

function fmtDate(d?: string | null): string {
  if (!d) return "-";
  try {
    return format(parseISO(d), "dd/MM/yyyy", { locale: pt });
  } catch {
    return d;
  }
}

export function PatientDataTab({ patient, onPatientUpdated }: PatientDataTabProps) {
  const { packs, updatePatient } = useData();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [portalActive, setPortalActive] = useState<boolean | null>(null);
  const [portalLoading, setPortalLoading] = useState(true);
  const [sendingLink, setSendingLink] = useState(false);

  const healthTags = (patient.health_tags as HealthTag[]) || [];
  const activePacks = packs.filter((p: any) => p.paciente_id === patient.id && p.is_active).length;
  const age = calcAge(patient.birth_date);

  useEffect(() => {
    let cancelled = false;
    setPortalLoading(true);
    (async () => {
      const { count } = await (supabase as any)
        .from("portal_conta_pacientes")
        .select("conta_id", { count: "exact", head: true })
        .eq("paciente_id", patient.id);
      if (!cancelled) {
        setPortalActive((count || 0) > 0);
        setPortalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patient.id]);

  const handleSave = async (patientId: string, data: Partial<Patient>) => {
    const { error } = await supabase.from("pacientes").update(data).eq("id", patientId);
    if (error) {
      toast.error("Não foi possível atualizar os dados.");
      throw error;
    }
    updatePatient(patientId, data);
    onPatientUpdated?.(data);
    toast.success("Dados atualizados!");
  };

  const handleSendPortalLink = async () => {
    if (!patient.email) {
      toast.error("Utente sem email — adicione um email primeiro.");
      return;
    }
    setSendingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-patient-portal-link", {
        body: { to: patient.email, patientName: patient.full_name, type: "access" },
      });
      if (error) throw error;
      if (data?.success) toast.success(`Link enviado para ${patient.email}`);
      else throw new Error(data?.error || "Erro ao enviar link");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar link");
    } finally {
      setSendingLink(false);
    }
  };

  return (
    <>
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="font-display text-lg">Dados do Utente</CardTitle>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Editar Dados
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                <IdCard className="h-3 w-3" />
                NIF / CPF
              </p>
              <p className="font-medium">{patient.cpf || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                Data de Nascimento
              </p>
              <p className="font-medium">
                {fmtDate(patient.birth_date)}
                {age && <span className="text-muted-foreground"> ({age})</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                <Phone className="h-3 w-3" />
                Telefone
              </p>
              <p className="font-medium">{patient.phone || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                Email
              </p>
              <p className="font-medium truncate">{patient.email || "-"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                Morada
              </p>
              <p className="font-medium">{patient.address || "-"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                <ShieldAlert className="h-3 w-3" />
                Contacto de Emergência
              </p>
              <p className="font-medium">
                {patient.emergency_contact || "-"}
                {patient.emergency_phone && <span className="text-muted-foreground"> — {patient.emergency_phone}</span>}
              </p>
            </div>
            {patient.health_insurance && (
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Seguradora / Entidade</p>
                <p className="font-medium">{patient.health_insurance}</p>
              </div>
            )}
            {patient.notes && (
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Observações</p>
                <p className="text-sm whitespace-pre-wrap">{patient.notes}</p>
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Etiquetas</p>
              {healthTags.length > 0 ? (
                <HealthTagList tags={healthTags} maxVisible={10} size="sm" />
              ) : (
                <p className="text-sm text-muted-foreground italic">Sem etiquetas atribuídas</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Package className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Packs activos</p>
                  <p className="font-semibold">{activePacks}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Globe className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Portal do Utente</p>
                  {portalLoading ? (
                    <p className="text-sm flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" /> A verificar...
                    </p>
                  ) : portalActive ? (
                    <p className="font-semibold flex items-center gap-1.5 text-green-600">
                      <CheckCircle2 className="h-4 w-4" /> Activo
                    </p>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium flex items-center gap-1.5 text-muted-foreground">
                        <XCircle className="h-4 w-4" /> Inactivo
                      </p>
                      <Button size="sm" variant="outline" disabled={sendingLink || !patient.email} onClick={handleSendPortalLink}>
                        {sendingLink ? <Loader2 className="h-3 w-3 animate-spin" /> : "Activar"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <PatientPriceCard
        patientId={patient.id}
        precoConsulta={(patient as any).preco_consulta ?? null}
        onChange={(v) => {
          updatePatient(patient.id, { preco_consulta: v } as any);
          onPatientUpdated?.({ preco_consulta: v } as any);
        }}
      />



      <EditPatientModal
        patient={patient}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}
