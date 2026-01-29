// AuditLogsPanel - View audit history of all actions
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  History, 
  User, 
  Calendar, 
  UserX, 
  CalendarX, 
  Tag, 
  UserMinus,
  RefreshCw,
  FileText,
  CheckCircle2,
  Edit
} from "lucide-react";
import { AuditService, AuditLogEntry, EntityType, AuditAction } from "@/services/AuditService";
import { toast } from "sonner";

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <FileText className="h-4 w-4 text-success" />,
  update: <Edit className="h-4 w-4 text-primary" />,
  delete: <UserX className="h-4 w-4 text-destructive" />,
  cancel: <CalendarX className="h-4 w-4 text-warning" />,
  complete: <CheckCircle2 className="h-4 w-4 text-success" />,
  reschedule: <RefreshCw className="h-4 w-4 text-primary" />,
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  patient: <User className="h-4 w-4" />,
  session: <Calendar className="h-4 w-4" />,
  service: <Tag className="h-4 w-4" />,
  professional: <UserMinus className="h-4 w-4" />,
};

export function AuditLogsPanel() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<EntityType | "all">("all");
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await AuditService.getLogs({
        limit: 100,
        entityType: entityFilter !== "all" ? entityFilter : undefined,
        action: actionFilter !== "all" ? actionFilter : undefined,
      });

      if (error) {
        toast.error("Erro ao carregar logs de auditoria");
        return;
      }

      setLogs(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityFilter, actionFilter]);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Logs de Auditoria
        </CardTitle>
        <CardDescription>
          Histórico de ações realizadas no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select
            value={entityFilter}
            onValueChange={(v) => setEntityFilter(v as EntityType | "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="patient">Pacientes</SelectItem>
              <SelectItem value="session">Sessões</SelectItem>
              <SelectItem value="service">Serviços</SelectItem>
              <SelectItem value="professional">Profissionais</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={actionFilter}
            onValueChange={(v) => setActionFilter(v as AuditAction | "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              <SelectItem value="create">Criação</SelectItem>
              <SelectItem value="update">Atualização</SelectItem>
              <SelectItem value="delete">Exclusão</SelectItem>
              <SelectItem value="cancel">Cancelamento</SelectItem>
              <SelectItem value="complete">Finalização</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={fetchLogs}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Logs List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum registro encontrado</p>
            <p className="text-sm">As ações realizadas aparecerão aqui.</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {ACTION_ICONS[log.action] || <History className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {AuditService.getActionLabel(log.action)}
                        </span>
                        <Badge variant="outline" className="text-xs gap-1">
                          {ENTITY_ICONS[log.entity_type]}
                          {AuditService.getEntityTypeLabel(log.entity_type)}
                        </Badge>
                        {log.entity_name && (
                          <span className="text-sm text-muted-foreground truncate">
                            "{log.entity_name}"
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{formatDate(log.created_at)}</span>
                        <span>•</span>
                        <span>{log.user_email || "Utilizador desconhecido"}</span>
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && log.details.reason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Motivo: {log.details.reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
