import { memo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DiaryNotification {
  id: string;
  paciente_id: string;
  tipo: string;
  titulo: string;
  texto_preview: string | null;
  urgente: boolean;
  lida: boolean;
  referencia_id: string | null;
  created_at: string;
  patient_name?: string;
}

export const DiaryFloatingButton = memo(function DiaryFloatingButton() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<DiaryNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasUrgent, setHasUrgent] = useState(false);
  const [bounce, setBounce] = useState(false);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("portal_notificacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) return;

      const items: DiaryNotification[] = data || [];

      // Fetch patient names
      const patientIds = [...new Set(items.map((n) => n.paciente_id))];
      let nameMap: Record<string, string> = {};
      if (patientIds.length > 0) {
        const { data: patients } = await supabase
          .from("pacientes")
          .select("id, full_name")
          .in("id", patientIds);
        (patients || []).forEach((p: any) => {
          nameMap[p.id] = p.full_name;
        });
      }

      const enriched = items.map((n) => ({
        ...n,
        patient_name: nameMap[n.paciente_id] || "Paciente",
      }));

      setNotifications(enriched);
      const unread = enriched.filter((n) => !n.lida);
      setUnreadCount(unread.length);
      setHasUrgent(unread.some((n) => n.urgente));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Bounce animation when count changes
  useEffect(() => {
    if (unreadCount > 0) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 600);
      return () => clearTimeout(t);
    }
  }, [unreadCount]);

  const handleClickNotification = async (n: DiaryNotification) => {
    if (!n.lida) {
      await (supabase as any)
        .from("portal_notificacoes")
        .update({ lida: true })
        .eq("id", n.id);
    }
    setOpen(false);
    navigate(`/prontuarios?paciente=${n.paciente_id}&tab=diario`);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    await (supabase as any)
      .from("portal_notificacoes")
      .update({ lida: true })
      .eq("lida", false);
    fetchNotifications();
  };

  const getIcon = (n: DiaryNotification) => {
    if (n.urgente) return "🚨";
    if (n.tipo === "diary_reply") return "💬";
    return "📝";
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-6 right-6 z-[90] flex h-[52px] w-[52px] items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105",
          "bg-gradient-to-br from-blue-800 to-blue-500",
          bounce && "animate-bounce"
        )}
        style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}
        aria-label="Mensagens do diário"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white",
              hasUrgent
                ? "bg-red-600 ring-2 ring-red-300 animate-pulse"
                : "bg-destructive"
            )}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-[84px] right-6 z-[91] w-[360px] max-h-[480px] rounded-xl border bg-background shadow-xl flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <h3 className="font-semibold text-sm">Mensagens do Diário</h3>
              {unreadCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {unreadCount} não lida{unreadCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="h-7 text-xs gap-1">
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar lidas
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* List */}
          <ScrollArea className="flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Sem mensagens recentes</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-colors hover:bg-accent/50",
                      !n.lida && "bg-yellow-50",
                      n.urgente && !n.lida && "bg-red-50 border-l-2 border-l-destructive"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-base mt-0.5">{getIcon(n)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {n.patient_name}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {n.titulo}
                        </p>
                        {n.texto_preview && (
                          <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-2">
                            {n.texto_preview}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pt })}
                        </p>
                      </div>
                      {!n.lida && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </>
  );
});
