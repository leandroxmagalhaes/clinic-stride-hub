// PackManagerModal — Gestão de packs por paciente
// Acessível no perfil do paciente e na agenda
import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  Plus,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
  X,
  RotateCcw,
} from "lucide-react";
import { useData, Pack } from "@/contexts/DataContext";

const METHOD_OPTIONS = [
  { value: "cash", label: "💵 Numerário" },
  { value: "mbway", label: "📱 MB Way" },
  { value: "multibanco", label: "🏧 Multibanco" },
  { value: "transfer", label: "🔁 Transferência" },
  { value: "credit_card", label: "💳 Cartão" },
];

interface PackManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pacienteId: string;
  pacienteNome: string;
  embedded?: boolean;
}

type ViewMode = "list" | "create" | "edit";

export function PackManagerModal({ isOpen, onClose, pacienteId, pacienteNome, embedded = false }: PackManagerModalProps) {
  const { packs, addPack, updatePack, deletePack, sessions, associateSessionToPack, refreshPacks } = useData();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingPack, setEditingPack] = useState<Pack | null>(null);
  const [expandedPackId, setExpandedPackId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formDataInicio, setFormDataInicio] = useState<Date | undefined>();
  const [formQtd, setFormQtd] = useState("10");
  const [formValor, setFormValor] = useState("");
  const [formPayStatus, setFormPayStatus] = useState<"pago" | "pendente" | "parcial">("pendente");
  const [formPayMethod, setFormPayMethod] = useState("cash");
  const [formPaidAt, setFormPaidAt] = useState<Date | undefined>();
  const [formNotes, setFormNotes] = useState("");

  const patientPacks = packs.filter((p) => p.paciente_id === pacienteId).sort((a, b) => b.numero_pack - a.numero_pack);

  useEffect(() => {
    if (!isOpen) {
      setViewMode("list");
      setEditingPack(null);
    }
  }, [isOpen]);

  const resetForm = () => {
    setFormDataInicio(undefined);
    setFormQtd("10");
    setFormValor("");
    setFormPayStatus("pendente");
    setFormPayMethod("cash");
    setFormPaidAt(undefined);
    setFormNotes("");
  };

  const loadFormFromPack = (pack: Pack) => {
    setFormDataInicio(parseISO(pack.data_inicio));
    setFormQtd(String(pack.quantidade_sessoes));
    setFormValor(String(pack.valor_total));
    setFormPayStatus(pack.payment_status);
    setFormPayMethod(pack.payment_method || "cash");
    setFormPaidAt(pack.paid_at ? parseISO(pack.paid_at) : undefined);
    setFormNotes(pack.notes || "");
  };

  const handleCreatePack = async () => {
    if (!formDataInicio) {
      toast.error("Selecione a data de início");
      return;
    }
    if (!formValor || parseFloat(formValor) <= 0) {
      toast.error("Indique o valor do pack");
      return;
    }
    setIsSubmitting(true);
    try {
      await addPack({
        paciente_id: pacienteId,
        data_inicio: format(formDataInicio, "yyyy-MM-dd"),
        quantidade_sessoes: parseInt(formQtd) || 10,
        valor_total: parseFloat(formValor),
        payment_status: formPayStatus,
        payment_method: formPayStatus !== "pendente" ? formPayMethod : null,
        paid_at: formPayStatus === "pago" && formPaidAt ? formPaidAt.toISOString() : null,
        notes: formNotes || null,
        is_active: true,
      });
      toast.success("Pack criado! Sessões associadas automaticamente.");
      resetForm();
      setViewMode("list");
    } catch (err: any) {
      toast.error("Erro ao criar pack: " + (err?.message || "Tente novamente"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPack = async () => {
    if (!editingPack || !formDataInicio) {
      toast.error("Selecione a data de início");
      return;
    }
    setIsSubmitting(true);
    try {
      await updatePack(editingPack.id, {
        data_inicio: format(formDataInicio, "yyyy-MM-dd"),
        quantidade_sessoes: parseInt(formQtd) || 10,
        valor_total: parseFloat(formValor),
        payment_status: formPayStatus,
        payment_method: formPayStatus !== "pendente" ? formPayMethod : null,
        paid_at: formPayStatus === "pago" && formPaidAt ? formPaidAt.toISOString() : null,
        notes: formNotes || null,
      });
      toast.success("Pack actualizado!");
      setViewMode("list");
      setEditingPack(null);
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Tente novamente"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePack = async (id: string) => {
    try {
      await deletePack(id);
      toast.success("Pack removido.");
      setDeleteConfirmId(null);
    } catch (err: any) {
      toast.error("Erro: " + err?.message);
    }
  };

  const handleDesassociarSessao = async (sessionId: string) => {
    await associateSessionToPack(sessionId, null);
    await refreshPacks();
    toast.success("Sessão desassociada do pack.");
  };

  // Sessões associadas a um pack
  const getPackSessions = (packId: string) =>
    sessions
      .filter((s) => (s as any).pack_id === packId)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const alertColor = (status?: Pack["alert_status"]) => {
    if (status === "esgotado") return "bg-gray-100 text-gray-600 border-gray-300";
    if (status === "ultima_sessao") return "bg-red-50 text-red-700 border-red-300";
    if (status === "penultima_sessao") return "bg-orange-50 text-orange-700 border-orange-300";
    return "bg-green-50 text-green-700 border-green-300";
  };

  const alertLabel = (status?: Pack["alert_status"]) => {
    if (status === "esgotado") return "Esgotado";
    if (status === "ultima_sessao") return "⚠️ Última sessão";
    if (status === "penultima_sessao") return "⚠️ Penúltima sessão";
    return "Activo";
  };

  // ── FORM (criar / editar) ─────────────────────────────────────────────────
  const renderForm = (mode: "create" | "edit") => (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        {/* Data de início */}
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Data de início *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start font-normal min-h-[40px]",
                  !formDataInicio && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formDataInicio ? format(formDataInicio, "dd/MM/yyyy") : "Selecionar (pode ser retroativa)"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formDataInicio}
                onSelect={setFormDataInicio}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {formDataInicio && formDataInicio < new Date() && (
            <p className="text-xs text-amber-600">
              📅 Data retroativa — sessões existentes serão associadas automaticamente.
            </p>
          )}
        </div>

        {/* Quantidade */}
        <div className="space-y-1">
          <Label className="text-xs">Nº de sessões *</Label>
          <Input
            type="number"
            min="1"
            max="100"
            value={formQtd}
            onChange={(e) => setFormQtd(e.target.value)}
            className="min-h-[40px]"
          />
        </div>

        {/* Valor */}
        <div className="space-y-1">
          <Label className="text-xs">Valor total (€) *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formValor}
              onChange={(e) => setFormValor(e.target.value)}
              className="pl-7 min-h-[40px]"
              placeholder="0,00"
            />
          </div>
          {formQtd && formValor && parseFloat(formValor) > 0 && parseInt(formQtd) > 0 && (
            <p className="text-xs text-muted-foreground">
              {(parseFloat(formValor) / parseInt(formQtd)).toFixed(2)}€ / sessão
            </p>
          )}
        </div>
      </div>

      {/* Pagamento */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Estado do pagamento</Label>
        <RadioGroup value={formPayStatus} onValueChange={(v) => setFormPayStatus(v as any)} className="space-y-2">
          {[
            { value: "pago", label: "💚 Pago na totalidade", desc: "Pack totalmente liquidado" },
            { value: "parcial", label: "🟡 Parcialmente pago", desc: "Entrada paga, resto pendente" },
            { value: "pendente", label: "🟠 Pendente de pagamento", desc: "A cobrar" },
          ].map((opt) => (
            <div
              key={opt.value}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors",
                formPayStatus === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
              )}
              onClick={() => setFormPayStatus(opt.value as any)}
            >
              <RadioGroupItem value={opt.value} id={`pay-${opt.value}`} />
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      {formPayStatus !== "pendente" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Método de pagamento</Label>
            <Select value={formPayMethod} onValueChange={setFormPayMethod}>
              <SelectTrigger className="min-h-[40px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data do pagamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start font-normal min-h-[40px]",
                    !formPaidAt && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formPaidAt ? format(formPaidAt, "dd/MM/yyyy") : "Quando?"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formPaidAt}
                  onSelect={setFormPaidAt}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Notas (opcional)</Label>
        <Textarea
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          rows={2}
          className="resize-none"
          placeholder="Ex: desconto especial, pack familiar..."
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            setViewMode("list");
            setEditingPack(null);
            resetForm();
          }}
        >
          Cancelar
        </Button>
        <Button
          className="flex-1 gap-2"
          onClick={mode === "create" ? handleCreatePack : handleEditPack}
          disabled={isSubmitting}
        >
          <Package className="h-4 w-4" />
          {isSubmitting ? "A guardar..." : mode === "create" ? "Criar Pack" : "Guardar Alterações"}
        </Button>
      </div>
    </div>
  );

  // ── LISTA DE PACKS ────────────────────────────────────────────────────────
  const renderList = () => (
    <div className="space-y-3 py-2">
      {patientPacks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum pack criado para este paciente.</p>
          <Button
            className="mt-4 gap-2"
            onClick={() => {
              resetForm();
              setViewMode("create");
            }}
          >
            <Plus className="h-4 w-4" />
            Criar Primeiro Pack
          </Button>
        </div>
      ) : (
        patientPacks.map((pack) => {
          const packSessions = getPackSessions(pack.id);
          const isExpanded = expandedPackId === pack.id;
          const progress = pack.quantidade_sessoes > 0 ? (pack.sessoes_usadas / pack.quantidade_sessoes) * 100 : 0;

          return (
            <div
              key={pack.id}
              className={cn(
                "border rounded-xl overflow-hidden transition-all",
                !pack.is_active ? "opacity-60" : "",
                pack.alert_status === "ultima_sessao"
                  ? "border-red-300"
                  : pack.alert_status === "penultima_sessao"
                    ? "border-orange-300"
                    : "border-border",
              )}
            >
              {/* Header do pack */}
              <div className="p-3 bg-muted/30 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">Pack {pack.numero_pack}</span>
                    <Badge variant="outline" className={cn("text-xs", alertColor(pack.alert_status))}>
                      {alertLabel(pack.alert_status)}
                    </Badge>
                    {pack.payment_status === "pago" && <Badge className="bg-green-600 text-white text-xs">Pago</Badge>}
                    {pack.payment_status === "pendente" && (
                      <Badge className="bg-orange-500 text-white text-xs">Pendente</Badge>
                    )}
                    {pack.payment_status === "parcial" && (
                      <Badge className="bg-yellow-500 text-white text-xs">Parcial</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Início: {format(parseISO(pack.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                    {" · "}
                    {pack.valor_total.toFixed(2)}€{" · "}
                    {(pack.valor_total / pack.quantidade_sessoes).toFixed(2)}€/sessão
                  </p>

                  {/* Barra de progresso */}
                  <div className="mt-2 space-y-0.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {pack.sessoes_usadas} realizadas · {pack.sessoes_agendadas} agendadas · {pack.sessoes_disponiveis} disponíveis · {pack.quantidade_sessoes} total
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          progress >= 100
                            ? "bg-gray-400"
                            : progress >= 80
                              ? "bg-red-500"
                              : progress >= 60
                                ? "bg-orange-400"
                                : "bg-green-500",
                        )}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      loadFormFromPack(pack);
                      setEditingPack(pack);
                      setViewMode("edit");
                    }}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirmId(pack.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setExpandedPackId(isExpanded ? null : pack.id)}
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Sessões do pack (expandido) */}
              {isExpanded && (
                <div className="border-t">
                  {packSessions.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">Nenhuma sessão associada.</p>
                  ) : (
                    <div className="divide-y">
                      {packSessions.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/20"
                        >
                          <div className="flex items-center gap-2">
                            {s.status === "realizado" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                            ) : s.status === "falta" ? (
                              <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                            <span>{format(new Date(s.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            <span className="text-muted-foreground">{s.servico?.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-muted-foreground hover:text-destructive gap-1 px-2"
                            onClick={() => handleDesassociarSessao(s.id)}
                          >
                            <X className="h-3 w-3" />
                            Desassociar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Alerta de renovação */}
                  {(pack.alert_status === "ultima_sessao" || pack.alert_status === "penultima_sessao") && (
                    <div
                      className={cn(
                        "mx-3 mb-3 mt-1 p-2.5 rounded-lg text-xs flex items-start gap-2",
                        pack.alert_status === "ultima_sessao"
                          ? "bg-red-50 border border-red-200 text-red-700"
                          : "bg-orange-50 border border-orange-200 text-orange-700",
                      )}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">
                          {pack.alert_status === "ultima_sessao"
                            ? "Última sessão do pack!"
                            : "Penúltima sessão do pack!"}
                        </p>
                        <p className="mt-0.5 opacity-80">Considere enviar aviso ao cliente para renovar.</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 text-[11px] gap-1"
                          onClick={() => {
                            const msg = `Olá ${pacienteNome}, o seu pack de sessões (Pack ${pack.numero_pack}) está quase a terminar — ${pack.alert_status === "ultima_sessao" ? "só lhe resta 1 sessão" : "restam 2 sessões"}. Entre em contacto para renovar!`;
                            navigator.clipboard.writeText(msg);
                            toast.success("Mensagem copiada para a área de transferência!");
                          }}
                        >
                          📋 Copiar mensagem de aviso
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {patientPacks.length > 0 && (
        <Button
          variant="outline"
          className="w-full gap-2 mt-2"
          onClick={() => {
            resetForm();
            setViewMode("create");
          }}
        >
          <Plus className="h-4 w-4" />
          Criar Novo Pack
        </Button>
      )}
    </div>
  );

  const titleMap: Record<ViewMode, string> = {
    list: `Packs — ${pacienteNome}`,
    create: "Criar Novo Pack",
    edit: `Editar Pack ${editingPack?.numero_pack}`,
  };

  const content = (
    <>
      {!embedded && (
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {titleMap[viewMode]}
          </DialogTitle>
          {viewMode === "list" && (
            <DialogDescription>
              {patientPacks.length} pack{patientPacks.length !== 1 ? "s" : ""} registado
              {patientPacks.length !== 1 ? "s" : ""}
              {" · "}Pack activo:{" "}
              {patientPacks.find((p) => p.is_active)
                ? `Pack ${patientPacks.find((p) => p.is_active)!.numero_pack}`
                : "nenhum"}
            </DialogDescription>
          )}
          {viewMode === "create" && (
            <DialogDescription>
              As sessões a partir da data de início serão associadas automaticamente.
            </DialogDescription>
          )}
        </DialogHeader>
      )}

      {viewMode === "list" && renderList()}
      {viewMode === "create" && renderForm("create")}
      {viewMode === "edit" && renderForm("edit")}
    </>
  );

  if (embedded) {
    return (
      <>
        {content}
        <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover Pack?</AlertDialogTitle>
              <AlertDialogDescription>
                As sessões associadas a este pack serão desassociadas mas não apagadas. Esta acção não pode ser revertida.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteConfirmId && handleDeletePack(deleteConfirmId)}
              >
                Remover Pack
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {content}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Pack?</AlertDialogTitle>
            <AlertDialogDescription>
              As sessões associadas a este pack serão desassociadas mas não apagadas. Esta acção não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && handleDeletePack(deleteConfirmId)}
            >
              Remover Pack
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
