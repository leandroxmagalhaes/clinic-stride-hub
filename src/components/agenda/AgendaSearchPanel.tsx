import { useMemo, useState } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  X,
  CalendarIcon,
  FileSpreadsheet,
  FileDown,
  MoreVertical,
  Filter,
  Trash2,
  Copy,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Session } from "@/services/SessionService";
import { filterSessions, isCriteriaActive, EMPTY_CRITERIA, SearchCriteria } from "@/services/AgendaSearchService";
import { AgendaExportService } from "@/services/AgendaExportService";
import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialQuery: string;
  sessions: Session[];
  professionals: { id: string; full_name: string }[];
  services: { id: string; name: string; color?: string | null }[];
  clinicName: string;
  onEditSession: (s: Session) => void;
  onDuplicateSession: (s: Session) => void;
  onDeleteSession: (id: string) => Promise<void> | void;
  onUpdateStatus: (id: string, status: string) => Promise<void> | void;
  onGoToDate: (date: Date) => void;
}

const STATUS_OPTIONS = [
  { value: "agendado", label: "Agendado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "realizado", label: "Realizado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "falta", label: "Falta" },
];

const PAYMENT_OPTIONS = [
  { value: "pago", label: "Pago" },
  { value: "pendente", label: "Pendente" },
  { value: "parcial", label: "Parcial" },
];

function statusColor(status: string) {
  switch (status) {
    case "agendado": return "bg-blue-500 text-white";
    case "confirmado": return "bg-green-500 text-white";
    case "realizado": return "bg-muted text-foreground";
    case "cancelado": return "bg-destructive text-destructive-foreground";
    case "falta":
    case "faltou": return "bg-amber-500 text-white";
    default: return "bg-muted";
  }
}

export function AgendaSearchPanel({
  isOpen,
  onClose,
  initialQuery,
  sessions,
  professionals,
  services,
  clinicName,
  onEditSession,
  onDuplicateSession,
  onDeleteSession,
  onUpdateStatus,
  onGoToDate,
}: Props) {
  const [criteria, setCriteria] = useState<SearchCriteria>({ ...EMPTY_CRITERIA, query: initialQuery });
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);

  // Sync external query changes
  useMemo(() => {
    setCriteria((c) => ({ ...c, query: initialQuery }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const results = useMemo(() => filterSessions(sessions, criteria), [sessions, criteria]);
  const totalValue = results.reduce((acc, s) => acc + (s.price || 0), 0);

  const setRange = (preset: "today" | "week" | "month" | "30d" | "all") => {
    const now = new Date();
    if (preset === "all") return setCriteria({ ...criteria, dateFrom: null, dateTo: null });
    if (preset === "today") return setCriteria({ ...criteria, dateFrom: now, dateTo: now });
    if (preset === "week")
      return setCriteria({
        ...criteria,
        dateFrom: startOfWeek(now, { weekStartsOn: 1 }),
        dateTo: endOfWeek(now, { weekStartsOn: 1 }),
      });
    if (preset === "month")
      return setCriteria({ ...criteria, dateFrom: startOfMonth(now), dateTo: endOfMonth(now) });
    if (preset === "30d") return setCriteria({ ...criteria, dateFrom: subDays(now, 30), dateTo: now });
  };

  const toggleArr = (key: "professionalIds" | "serviceIds" | "statuses" | "paymentStatuses", val: string) => {
    setCriteria((c) => {
      const cur = c[key];
      return { ...c, [key]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] };
    });
  };

  const handleExportPDF = () => {
    if (!results.length) return toast.error("Sem resultados para exportar");
    AgendaExportService.exportToPDF(results, criteria, clinicName, professionals, services);
    toast.success("PDF gerado");
  };
  const handleExportXLSX = () => {
    if (!results.length) return toast.error("Sem resultados para exportar");
    AgendaExportService.exportToExcel(results, criteria, professionals, services);
    toast.success("Planilha gerada");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onDeleteSession(deleteTarget.id);
      toast.success("Sessão excluída");
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir");
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Pesquisar agenda
            </SheetTitle>
          </SheetHeader>

          {/* Search input */}
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={criteria.query}
                onChange={(e) => setCriteria({ ...criteria, query: e.target.value })}
                placeholder="Pesquisar utente, profissional, serviço, notas…"
                className="pl-9 pr-9"
              />
              {criteria.query && (
                <button
                  onClick={() => setCriteria({ ...criteria, query: "" })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Date range presets */}
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRange("all")}>Tudo</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRange("today")}>Hoje</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRange("week")}>Esta semana</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRange("month")}>Este mês</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRange("30d")}>Últimos 30 dias</Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {criteria.dateFrom ? format(criteria.dateFrom, "dd/MM/yy") : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={criteria.dateFrom ?? undefined}
                    onSelect={(d) => setCriteria({ ...criteria, dateFrom: d ?? null })}
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {criteria.dateTo ? format(criteria.dateTo, "dd/MM/yy") : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={criteria.dateTo ?? undefined}
                    onSelect={(d) => setCriteria({ ...criteria, dateTo: d ?? null })}
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Multi-select filters */}
            <div className="flex flex-wrap gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Filter className="h-3 w-3" /> Profissional
                    {criteria.professionalIds.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{criteria.professionalIds.length}</Badge>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-72 overflow-auto bg-background z-50">
                  {professionals.map((p) => (
                    <DropdownMenuItem key={p.id} onSelect={(e) => { e.preventDefault(); toggleArr("professionalIds", p.id); }}>
                      <Checkbox checked={criteria.professionalIds.includes(p.id)} className="mr-2" />
                      {p.full_name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Filter className="h-3 w-3" /> Serviço
                    {criteria.serviceIds.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{criteria.serviceIds.length}</Badge>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-72 overflow-auto bg-background z-50">
                  {services.map((p) => (
                    <DropdownMenuItem key={p.id} onSelect={(e) => { e.preventDefault(); toggleArr("serviceIds", p.id); }}>
                      <Checkbox checked={criteria.serviceIds.includes(p.id)} className="mr-2" />
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Filter className="h-3 w-3" /> Status
                    {criteria.statuses.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{criteria.statuses.length}</Badge>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-background z-50">
                  {STATUS_OPTIONS.map((p) => (
                    <DropdownMenuItem key={p.value} onSelect={(e) => { e.preventDefault(); toggleArr("statuses", p.value); }}>
                      <Checkbox checked={criteria.statuses.includes(p.value)} className="mr-2" />
                      {p.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Filter className="h-3 w-3" /> Pagamento
                    {criteria.paymentStatuses.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{criteria.paymentStatuses.length}</Badge>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-background z-50">
                  {PAYMENT_OPTIONS.map((p) => (
                    <DropdownMenuItem key={p.value} onSelect={(e) => { e.preventDefault(); toggleArr("paymentStatuses", p.value); }}>
                      <Checkbox checked={criteria.paymentStatuses.includes(p.value)} className="mr-2" />
                      {p.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {isCriteriaActive(criteria) && (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setCriteria(EMPTY_CRITERIA)}>
                  <X className="h-3 w-3" /> Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between p-3 border-b bg-muted/30">
            <div className="text-sm">
              <span className="font-semibold">{results.length}</span> sessões
              <span className="text-muted-foreground"> • Total: € {totalValue.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleExportPDF}>
                <FileDown className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleExportXLSX}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </Button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-auto">
            {results.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma sessão encontrada com os filtros atuais.
              </div>
            ) : (
              <ul className="divide-y">
                {results.map((s) => {
                  const start = new Date(s.start_time);
                  return (
                    <li key={s.id} className="p-3 hover:bg-muted/40 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="text-center min-w-[58px]">
                          <div className="text-xs text-muted-foreground uppercase">{format(start, "MMM", { locale: ptBR })}</div>
                          <div className="text-lg font-semibold leading-none">{format(start, "dd")}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{format(start, "EEE", { locale: ptBR })}</div>
                          <div className="text-xs mt-1 font-medium">{format(start, "HH:mm")}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{s.paciente?.full_name ?? "—"}</span>
                            <Badge className={cn("text-[10px] h-5", statusColor(s.status))}>{s.status}</Badge>
                            {s.payment_status === "pago" && (
                              <Badge variant="outline" className="text-[10px] h-5 border-green-500 text-green-600">Pago</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {s.servico?.name} • {s.profissional?.full_name}
                          </div>
                          {s.notes && <div className="text-xs text-muted-foreground italic truncate mt-0.5">{s.notes}</div>}
                          <div className="text-xs mt-1">€ {(s.price || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}</div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background z-50">
                            <DropdownMenuItem onClick={() => onEditSession(s)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDuplicateSession(s)}>
                              <Copy className="h-4 w-4 mr-2" /> Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { onGoToDate(start); onClose(); }}>
                              <CalendarIcon className="h-4 w-4 mr-2" /> Ir para na agenda
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onUpdateStatus(s.id, "realizado")}>
                              <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" /> Marcar Realizado
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateStatus(s.id, "cancelado")}>
                              <XCircle className="h-4 w-4 mr-2 text-destructive" /> Marcar Cancelado
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateStatus(s.id, "falta")}>
                              <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" /> Marcar Falta
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(s)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <DeleteConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Excluir sessão"
        description={
          deleteTarget
            ? `Excluir a sessão de ${deleteTarget.paciente?.full_name} em ${format(new Date(deleteTarget.start_time), "dd/MM/yyyy HH:mm")}?`
            : ""
        }
        entityName="sessão"
      />
    </>
  );
}
