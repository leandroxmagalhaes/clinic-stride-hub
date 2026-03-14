import { useState, useMemo, useEffect, useRef } from "react";
import { getPublicBaseUrl } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  Phone,
  Mail,
  AlertCircle,
  ExternalLink,
  FileUp,
  Send,
  Link2,
  Check,
  FileBarChart2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Users,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ImportPatientsModal } from "@/components/patients/ImportPatientsModal";
import { SendOnboardingLinkModal } from "@/components/patients/SendOnboardingLinkModal";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

import { useData } from "@/contexts/DataContext";
import { PatientService, Patient } from "@/services/PatientService";
import { HealthTagList } from "@/components/ui/health-tag-badge";
import { PatientDetailModal } from "@/components/patients/PatientDetailModal";
import { HealthTag } from "@/services/HealthTagService";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { TableSkeleton } from "@/components/skeletons/PageSkeletons";
import { DuplicatePatientsModal } from "@/components/patients/DuplicatePatientsModal";

export default function Pacientes() {
  const { patients, refreshPatients, deletePatient, updatePatient, isLoading } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [clinicId, setClinicId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClinicId() {
      if (!user) return;
      const { data, error } = await supabase.from("profiles").select("clinic_id").eq("user_id", user.id).maybeSingle();
      if (error) {
        console.error("ERRO SUPABASE:", error);
        return;
      }
      if (data?.clinic_id) setClinicId(data.clinic_id);
    }
    fetchClinicId();
  }, [user]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isOnboardingLinkModalOpen, setIsOnboardingLinkModalOpen] = useState(false);
  const [genericLinkCopied, setGenericLinkCopied] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Report state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  type ReportSortField = "created_at" | "full_name" | "origin";
  type ReportSortDir = "asc" | "desc";
  type OriginFilter = "all" | "sistema" | "link";
  const [reportSearch, setReportSearch] = useState("");
  const [reportOrigin, setReportOrigin] = useState<OriginFilter>("all");
  const [reportSortField, setReportSortField] = useState<ReportSortField>("created_at");
  const [reportSortDir, setReportSortDir] = useState<ReportSortDir>("desc");
  const reportTableRef = useRef<HTMLDivElement>(null);

  function detectOrigin(patient: Patient): "sistema" | "link" {
    const p = patient as any;
    if (p.source === "link" || p.onboarding_token || p.onboarding_completed_at) return "link";
    return "sistema";
  }

  const reportData = useMemo(() => {
    let data = [...patients];
    if (reportOrigin !== "all") data = data.filter((p) => detectOrigin(p) === reportOrigin);
    if (reportSearch.trim()) {
      const term = reportSearch.toLowerCase();
      data = data.filter(
        (p) =>
          p.full_name?.toLowerCase().includes(term) ||
          p.email?.toLowerCase().includes(term) ||
          p.phone?.toLowerCase().includes(term),
      );
    }
    data.sort((a, b) => {
      let valA = "",
        valB = "";
      if (reportSortField === "created_at") {
        valA = (a as any).created_at || "";
        valB = (b as any).created_at || "";
      } else if (reportSortField === "full_name") {
        valA = a.full_name || "";
        valB = b.full_name || "";
      } else if (reportSortField === "origin") {
        valA = detectOrigin(a);
        valB = detectOrigin(b);
      }
      const cmp = valA.localeCompare(valB, "pt-PT");
      return reportSortDir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [patients, reportSearch, reportOrigin, reportSortField, reportSortDir]);

  const toggleSort = (field: ReportSortField) => {
    if (reportSortField === field) setReportSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setReportSortField(field);
      setReportSortDir("asc");
    }
  };

  const handleExportCSV = () => {
    const headers = ["Data Cadastro", "Hora", "Nome Completo", "Origem", "Telefone", "Email", "Estado"];
    const rows = reportData.map((p) => {
      const dt = (p as any).created_at ? new Date((p as any).created_at) : null;
      return [
        dt ? format(dt, "dd/MM/yyyy", { locale: ptBR }) : "-",
        dt ? format(dt, "HH:mm", { locale: ptBR }) : "-",
        p.full_name || "-",
        detectOrigin(p) === "link" ? "Link (cliente)" : "Sistema",
        p.phone || "-",
        p.email || "-",
        p.is_active ? "Ativo" : "Inativo",
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pacientes_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const handleExportPDF = () => {
    const dateStr = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório Pacientes</title><style>body{font-family:system-ui,sans-serif;padding:20px;font-size:12px}h1{font-size:18px;margin-bottom:4px}p.sub{color:#666;margin-bottom:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5;font-weight:600}.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px}.link{background:#dbeafe;color:#1d4ed8}.sistema{background:#f0fdf4;color:#15803d}.ativo{background:#f0fdf4;color:#15803d}.inativo{background:#fef2f2;color:#dc2626}@media print{body{padding:0}}</style></head><body><h1>Relatório de Pacientes</h1><p class="sub">Gerado em ${dateStr} · ${reportData.length} paciente(s)</p><table><thead><tr><th>Data</th><th>Hora</th><th>Nome</th><th>Origem</th><th>Telefone</th><th>Email</th><th>Estado</th></tr></thead><tbody>${reportData
      .map((p) => {
        const dt = (p as any).created_at ? new Date((p as any).created_at) : null;
        const o = detectOrigin(p);
        return `<tr><td>${dt ? format(dt, "dd/MM/yyyy", { locale: ptBR }) : "-"}</td><td>${dt ? format(dt, "HH:mm", { locale: ptBR }) : "-"}</td><td>${p.full_name || "-"}</td><td><span class="badge ${o}">${o === "link" ? "Link" : "Sistema"}</span></td><td>${p.phone || "-"}</td><td>${p.email || "-"}</td><td><span class="badge ${p.is_active ? "ativo" : "inativo"}">${p.is_active ? "Ativo" : "Inativo"}</span></td></tr>`;
      })
      .join("")}</tbody></table></body></html>`;
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Permita popups para exportar PDF");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  };

  const [formData, setFormData] = useState({
    full_name: "",
    cpf: "",
    birth_date: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    emergency_contact: "",
    emergency_phone: "",
    health_insurance: "",
    notes: "",
    privacy_consent: false,
  });

  const filteredPatients = PatientService.filterBySearch(patients, searchTerm);

  const handleOpenPatient = (patient: Patient) => setSelectedPatient(patient);

  const handleUpdatePatient = async (patientId: string, data: Partial<Patient>) => {
    const { error } = await supabase.from("pacientes").update(data).eq("id", patientId);
    if (error) {
      toast.error(`Erro ao atualizar paciente: ${error.message}`);
      throw error;
    }
    updatePatient(patientId, data);
    if (selectedPatient?.id === patientId) setSelectedPatient({ ...selectedPatient, ...data } as Patient);
    toast.success("Dados do paciente atualizados!");
  };

  const handleNavigateToProntuario = (patientId: string) => {
    setSelectedPatient(null);
    navigate(`/prontuarios?paciente=${patientId}`);
  };

  const handleCreatePatient = async () => {
    const validation = PatientService.validate(formData);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }
    if (!formData.privacy_consent) {
      toast.error("Você deve aceitar a Política de Privacidade para cadastrar o paciente.");
      return;
    }
    try {
      if (!clinicId) {
        toast.error("Clínica não identificada. Faça login novamente.");
        return;
      }
      const payload = {
        clinic_id: clinicId,
        full_name: formData.full_name.trim(),
        cpf: formData.cpf || null,
        birth_date: formData.birth_date || null,
        gender: formData.gender || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        emergency_contact: formData.emergency_contact || null,
        emergency_phone: formData.emergency_phone || null,
        health_insurance: formData.health_insurance || null,
        notes: formData.notes || null,
        health_tags: [],
        is_active: true,
        privacy_consent_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("pacientes").insert(payload);
      if (error) {
        toast.error(`Erro ao cadastrar paciente: ${error.message}`);
        return;
      }
      await refreshPatients();
      toast.success("Paciente cadastrado com sucesso!");
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar paciente");
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      cpf: "",
      birth_date: "",
      gender: "",
      phone: "",
      email: "",
      address: "",
      emergency_contact: "",
      emergency_phone: "",
      health_insurance: "",
      notes: "",
      privacy_consent: false,
    });
  };

  if (isLoading) {
    return (
      <AppLayout
        title="Pacientes"
        subtitle="Carregando..."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" disabled className="gap-2">
              <FileUp className="h-4 w-4" />
              <span className="hidden sm:inline">Importar Planilha</span>
            </Button>
            <Button disabled className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Paciente</span>
            </Button>
          </div>
        }
      >
        <TableSkeleton rows={6} />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Pacientes"
      subtitle={`${patients.length} pacientes cadastrados`}
      actions={
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setIsDuplicateModalOpen(true)} className="gap-2 min-h-[44px]">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Verificar Duplicados</span>
          </Button>
          <Button variant="outline" onClick={() => setIsReportModalOpen(true)} className="gap-2 min-h-[44px]">
            <FileBarChart2 className="h-4 w-4" />
            <span className="hidden sm:inline">Relatório</span>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              if (!clinicId) {
                toast.error("Clínica não identificada.");
                return;
              }
              try {
                const { data: clinicData } = await supabase
                  .from("clinics")
                  .select("slug")
                  .eq("id", clinicId)
                  .maybeSingle();
                const genericUrl = clinicData?.slug
                  ? `${getPublicBaseUrl()}/r/${clinicData.slug}`
                  : `${getPublicBaseUrl()}/pre-registo/novo?c=${clinicId}`;
                await navigator.clipboard.writeText(genericUrl);
                setGenericLinkCopied(true);
                toast.success("Link genérico copiado!");
                setTimeout(() => setGenericLinkCopied(false), 2000);
              } catch {
                toast.error("Erro ao copiar link");
              }
            }}
            className="gap-2"
          >
            {genericLinkCopied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{genericLinkCopied ? "Copiado!" : "Link Genérico"}</span>
            <span className="sm:hidden">{genericLinkCopied ? "✓" : "Link"}</span>
          </Button>
          <Button variant="outline" onClick={() => setIsOnboardingLinkModalOpen(true)} className="gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Enviar Link</span>
            <span className="sm:hidden">Enviar</span>
          </Button>
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)} className="gap-2">
            <FileUp className="h-4 w-4" />
            <span className="hidden sm:inline">Importar Planilha</span>
            <span className="sm:hidden">Importar</span>
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Paciente</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4 animate-fade-in">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map((patient) => {
            const healthTags = (patient.health_tags as HealthTag[]) || [];
            return (
              <Card
                key={patient.id}
                className="shadow-card hover:shadow-medium transition-shadow cursor-pointer"
                onClick={() => handleOpenPatient(patient)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {(patient.full_name ?? "")
                          .split(" ")
                          .filter(Boolean)
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{patient.full_name}</h3>
                        {patient.is_active ? (
                          <Badge variant="secondary" className="bg-success/10 text-success text-[10px]">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px]">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span className="truncate">{patient.phone}</span>
                        </div>
                        {patient.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{patient.email}</span>
                          </div>
                        )}
                      </div>
                      {healthTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <HealthTagList tags={healthTags} maxVisible={2} size="sm" showTooltip={false} />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredPatients.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold mb-1">Nenhum paciente encontrado</h3>
              <p className="text-sm text-muted-foreground">Tente ajustar sua busca ou cadastre um novo paciente</p>
            </CardContent>
          </Card>
        )}
      </div>

      <PatientDetailModal
        patient={selectedPatient}
        isOpen={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        onDeletePatient={deletePatient}
        onUpdatePatient={handleUpdatePatient}
        onNavigateToProntuario={handleNavigateToProntuario}
      />

      {/* New Patient Modal */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Paciente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Nome completo do paciente"
                />
              </div>
              <div className="space-y-2">
                <Label>NIF / CPF</Label>
                <Input
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="Número fiscal (9-14 dígitos)"
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Gênero</Label>
                <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                    <SelectItem value="O">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+351 912 345 678"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Morada</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Morada, número, localidade, código postal"
                />
              </div>
              <div className="space-y-2">
                <Label>Contato de Emergência</Label>
                <Input
                  value={formData.emergency_contact}
                  onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                  placeholder="Nome do contato"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone de Emergência</Label>
                <Input
                  value={formData.emergency_phone}
                  onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                  placeholder="+351 912 345 678"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Seguradora / Entidade</Label>
                <Input
                  value={formData.health_insurance}
                  onChange={(e) => setFormData({ ...formData, health_insurance: e.target.value })}
                  placeholder="Nome da seguradora (se aplicável)"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Informações adicionais sobre o paciente..."
                  rows={3}
                />
              </div>
              <div className="col-span-2 space-y-3 pt-4 border-t">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="privacy_consent"
                    checked={formData.privacy_consent}
                    onCheckedChange={(checked) => setFormData({ ...formData, privacy_consent: checked === true })}
                    className="mt-0.5"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="privacy_consent"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Aceito a Política de Privacidade *
                    </label>
                    <p className="text-xs text-muted-foreground">
                      O paciente foi informado e concorda com o tratamento dos seus dados pessoais conforme descrito na{" "}
                      <Link
                        to="/privacy"
                        target="_blank"
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        Política de Privacidade
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreatePatient}>Cadastrar Paciente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SendOnboardingLinkModal
        isOpen={isOnboardingLinkModalOpen}
        onClose={() => setIsOnboardingLinkModalOpen(false)}
        patients={patients}
      />

      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Relatório de Cadastros</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar nome, email ou telefone..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={reportOrigin} onValueChange={(v) => setReportOrigin(v as OriginFilter)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as origens</SelectItem>
                  <SelectItem value="sistema">Sistema (utilizador)</SelectItem>
                  <SelectItem value="link">Link (cliente)</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1">
                  <Download className="h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1">
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{reportData.length} paciente(s) encontrado(s)</p>
            <div className="overflow-x-auto rounded-md border" ref={reportTableRef}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("created_at")}>
                      Data{" "}
                      {reportSortField === "created_at" ? (
                        reportSortDir === "asc" ? (
                          <ArrowUp className="inline h-3 w-3" />
                        ) : (
                          <ArrowDown className="inline h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="inline h-3 w-3 opacity-40" />
                      )}
                    </TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("full_name")}>
                      Nome{" "}
                      {reportSortField === "full_name" ? (
                        reportSortDir === "asc" ? (
                          <ArrowUp className="inline h-3 w-3" />
                        ) : (
                          <ArrowDown className="inline h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="inline h-3 w-3 opacity-40" />
                      )}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("origin")}>
                      Origem{" "}
                      {reportSortField === "origin" ? (
                        reportSortDir === "asc" ? (
                          <ArrowUp className="inline h-3 w-3" />
                        ) : (
                          <ArrowDown className="inline h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="inline h-3 w-3 opacity-40" />
                      )}
                    </TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum paciente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportData.map((patient) => {
                      const dt = (patient as any).created_at ? new Date((patient as any).created_at) : null;
                      const origin = detectOrigin(patient);
                      return (
                        <TableRow key={patient.id}>
                          <TableCell>{dt ? format(dt, "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                          <TableCell>{dt ? format(dt, "HH:mm", { locale: ptBR }) : "—"}</TableCell>
                          <TableCell className="font-medium">{patient.full_name}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                origin === "link" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                              }
                            >
                              {origin === "link" ? "🔗 Link (cliente)" : "💻 Sistema"}
                            </Badge>
                          </TableCell>
                          <TableCell>{patient.phone || "—"}</TableCell>
                          <TableCell>{patient.email || "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                patient.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                              }
                            >
                              {patient.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {clinicId && (
        <ImportPatientsModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          clinicId={clinicId}
          onImportComplete={() => {
            refreshPatients();
            toast.success("Pacientes importados com sucesso!");
          }}
        />
      )}
    </AppLayout>
  );
}
