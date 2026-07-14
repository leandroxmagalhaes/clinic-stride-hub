import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useState } from "react";
import { DraggableSession } from "./DraggableSession";
import { DroppableSlot, HOUR_HEIGHT } from "./DroppableSlot";
import { ReservedSlotCard } from "./ReservedSlotCard";
import { GripVertical } from "lucide-react";
import { ReservedSlot } from "@/services/ReservedSlotService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Session {
  id: string;
  start_time: Date;
  end_time: Date;
  status: string;
  confirmacao_estado?: string;
  payment_status?: string;
  paciente?: { full_name: string; id?: string };
  profissional?: { full_name: string };
  servico?: { name: string; color: string };
}

interface ReservedSlotOccurrence {
  date: string;
  time: string;
  reservation: ReservedSlot;
}

interface AgendaDesktopGridProps {
  weekDays: Date[];
  hours: number[];
  sessions: Session[];
  reservedSlotOccurrences?: ReservedSlotOccurrence[];
  onSlotClick: (date: Date, hour: number) => void;
  onSessionClick: (session: Session) => void;
  onSessionReschedule?: (sessionId: string, newDate: Date, newHour: number) => void;
  onReservedSlotClick?: (reservation: ReservedSlot) => void;
  getCreditBalance?: (patientId: string) => number;
}

// --- Overlap logic ---
function computeOverlapPositions<T extends { startMin: number; endMin: number }>(
  items: T[],
): (T & { index: number; total: number })[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const groups: (typeof sorted)[] = [];
  let currentGroup = [sorted[0]];
  let groupEnd = sorted[0].endMin;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMin < groupEnd) {
      currentGroup.push(sorted[i]);
      groupEnd = Math.max(groupEnd, sorted[i].endMin);
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
      groupEnd = sorted[i].endMin;
    }
  }
  groups.push(currentGroup);

  const isCancelled = (it: any) =>
    it?.type === "session" && String(it?.session?.status ?? "").toLowerCase() === "cancelado";

  return groups.flatMap((group) => {
    const ordered = [...group].sort((a, b) => {
      const ca = isCancelled(a) ? 1 : 0;
      const cb = isCancelled(b) ? 1 : 0;
      if (ca !== cb) return ca - cb;
      return a.startMin - b.startMin || a.endMin - b.endMin;
    });
    return ordered.map((item, idx) => ({ ...item, index: idx, total: ordered.length }));
  });
}

function getItemStyle(
  startMin: number,
  endMin: number,
  firstHour: number,
  index: number,
  total: number,
): React.CSSProperties {
  const offsetMin = startMin - firstHour * 60;
  const durationMin = endMin - startMin;
  return {
    position: "absolute" as const,
    top: `${(offsetMin / 60) * HOUR_HEIGHT}px`,
    height: `${Math.max((durationMin / 60) * HOUR_HEIGHT, 20)}px`,
    left: `${(index / total) * 100}%`,
    width: `${(1 / total) * 100}%`,
    zIndex: 10,
  };
}

// Statuses que NÃO podem ser arrastados
const NON_DRAGGABLE_STATUSES = ["realizado", "Realizado", "cancelado", "Cancelado"];

// ── Modal de confirmação de reagendamento ───────────────────────────────────
interface RescheduleConfirmation {
  sessionId: string;
  session: Session;
  newDate: Date;
  newHour: number;
}

interface ConfirmRescheduleModalProps {
  confirmation: RescheduleConfirmation | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmRescheduleModal({ confirmation, onConfirm, onCancel }: ConfirmRescheduleModalProps) {
  if (!confirmation) return null;

  const { session, newDate, newHour } = confirmation;

  const oldDate = new Date(session.start_time);
  const oldFormatted = format(oldDate, "EEEE, dd/MM", { locale: ptBR });
  const oldTime = format(oldDate, "HH:mm");

  const newFormatted = format(newDate, "EEEE, dd/MM", { locale: ptBR });
  const newTime = `${String(newHour).padStart(2, "0")}:00`;

  const patientName = session.paciente?.full_name ?? "Paciente";
  const serviceName = session.servico?.name ?? "";

  return (
    <Dialog
      open={!!confirmation}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">📅 Reagendar sessão</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            Confirme o novo horário para esta sessão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Paciente + Serviço */}
          <div
            className="rounded-lg p-3 border-l-4"
            style={{
              backgroundColor: `${session.servico?.color}15`,
              borderLeftColor: session.servico?.color ?? "#10B981",
            }}
          >
            <p className="font-semibold text-sm">{patientName}</p>
            {serviceName && <p className="text-xs text-muted-foreground mt-0.5">{serviceName}</p>}
          </div>

          {/* De → Para */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
            {/* Origem */}
            <div className="rounded-md bg-muted/50 p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">De</p>
              <p className="font-semibold capitalize">{oldFormatted}</p>
              <p className="text-primary font-bold text-base">{oldTime}</p>
            </div>

            {/* Seta */}
            <div className="text-muted-foreground text-lg font-light">→</div>

            {/* Destino */}
            <div className="rounded-md bg-primary/10 border border-primary/20 p-3 text-center">
              <p className="text-[10px] text-primary uppercase tracking-wide mb-1 font-medium">Para</p>
              <p className="font-semibold capitalize">{newFormatted}</p>
              <p className="text-primary font-bold text-base">{newTime}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button onClick={onConfirm} className="flex-1 sm:flex-none">
            Confirmar reagendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// ───────────────────────────────────────────────────────────────────────────

export function AgendaDesktopGrid({
  weekDays,
  hours,
  sessions,
  reservedSlotOccurrences = [],
  onSlotClick,
  onSessionClick,
  onSessionReschedule,
  onReservedSlotClick,
  getCreditBalance,
}: AgendaDesktopGridProps) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [pendingReschedule, setPendingReschedule] = useState<RescheduleConfirmation | null>(null);
  const firstHour = hours[0] ?? 0;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const getSessionsForDay = (date: Date) => sessions.filter((s) => isSameDay(s.start_time, date));

  const getReservationsForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return reservedSlotOccurrences.filter((occ) => occ.date === dateStr);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const session = event.active.data.current?.session as Session;
    if (!session) return;

    // Bloquear drag de sessões realizadas ou canceladas
    if (NON_DRAGGABLE_STATUSES.includes(session.status)) return;

    setActiveSession(session);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSession(null);

    if (!over || !onSessionReschedule) return;

    const sessionId = active.id as string;
    const { date, hour } = over.data.current as { date: Date; hour: number };
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) return;

    // Não mover sessões realizadas ou canceladas
    if (NON_DRAGGABLE_STATUSES.includes(session.status)) return;

    // Verificar se é o mesmo slot
    const isSameSlot = isSameDay(session.start_time, date) && new Date(session.start_time).getHours() === hour;

    if (isSameSlot) return;

    // Em vez de mover direto, abrir modal de confirmação
    setPendingReschedule({ sessionId, session, newDate: date, newHour: hour });
  };

  const handleConfirmReschedule = () => {
    if (!pendingReschedule || !onSessionReschedule) return;
    const { sessionId, newDate, newHour } = pendingReschedule;
    onSessionReschedule(sessionId, newDate, newHour);
    setPendingReschedule(null);
  };

  const handleCancelReschedule = () => {
    setPendingReschedule(null);
  };

  const totalHeight = hours.length * HOUR_HEIGHT;

  return (
    <>
      <Card className="shadow-card overflow-hidden hidden md:block">
        <CardContent className="p-0">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="overflow-auto max-h-[calc(100vh-150px)] scrollbar-thin">
              <div className="min-w-[800px]">
                {/* ── Header sólido e sticky ── */}
                <div
                  className="grid sticky top-0 z-20 border-b bg-white dark:bg-gray-950 shadow-sm"
                  style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)` }}
                >
                  <div className="p-3 border-r bg-white dark:bg-gray-950" />
                  {weekDays.map((day, index) => {
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div
                        key={index}
                        className={cn(
                          "px-2 py-1.5 text-center border-r last:border-r-0 flex items-center justify-center gap-1.5",
                          isToday ? "bg-primary/10 dark:bg-primary/20" : "bg-white dark:bg-gray-950",
                        )}
                      >
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          {format(day, "EEE", { locale: ptBR })}
                        </p>
                        <p className={cn("text-sm font-semibold", isToday ? "text-primary" : "text-foreground")}>
                          {format(day, "d")}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* ── Body da grade ── */}
                <div className="grid" style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)` }}>
                  {/* Coluna de horas */}
                  <div className="border-r bg-muted/20" style={{ height: `${totalHeight}px` }}>
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="text-xs text-muted-foreground text-right pr-3 flex items-start justify-end pt-1"
                        style={{ height: `${HOUR_HEIGHT}px` }}
                      >
                        {String(hour).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>

                  {/* Colunas dos dias */}
                  {weekDays.map((day, dayIndex) => {
                    const isToday = isSameDay(day, new Date());
                    const daySessions = getSessionsForDay(day);
                    const dayReservations = getReservationsForDay(day);

                    const sessionItems = daySessions.map((s) => {
                      const start = new Date(s.start_time);
                      const end = new Date(s.end_time);
                      return {
                        type: "session" as const,
                        session: s,
                        startMin: start.getHours() * 60 + start.getMinutes(),
                        endMin: end.getHours() * 60 + end.getMinutes(),
                      };
                    });

                    const reservationItems = dayReservations.map((occ) => {
                      const [h, m] = occ.time.split(":").map(Number);
                      return {
                        type: "reservation" as const,
                        occ,
                        startMin: h * 60 + (m || 0),
                        endMin: h * 60 + (m || 0) + occ.reservation.duracao_minutos,
                      };
                    });

                    const allItems = [...sessionItems, ...reservationItems];
                    const positioned = computeOverlapPositions(allItems);

                    return (
                      <div
                        key={dayIndex}
                        className="relative border-r last:border-r-0"
                        style={{ height: `${totalHeight}px` }}
                      >
                        {hours.map((hour) => (
                          <DroppableSlot
                            key={hour}
                            id={`${day.toISOString()}-${hour}`}
                            date={day}
                            hour={hour}
                            isToday={isToday}
                            onSlotClick={() => onSlotClick(day, hour)}
                          />
                        ))}

                        {positioned.map((item) => {
                          const style = getItemStyle(item.startMin, item.endMin, firstHour, item.index, item.total);

                          if (item.type === "session") {
                            const s = item.session;
                            const patientId = s.paciente?.id;
                            const hasCredits =
                              patientId && getCreditBalance ? getCreditBalance(patientId) > 0 : undefined;
                            const sessionTime = format(new Date(s.start_time), "HH:mm");
                            return (
                              <DraggableSession
                                key={s.id}
                                session={s}
                                onClick={onSessionClick}
                                hasCredits={hasCredits}
                                displayTime={sessionTime}
                                positionStyle={style}
                              />
                            );
                          } else {
                            const occ = item.occ;
                            return (
                              <ReservedSlotCard
                                key={`reserved-${occ.reservation.id}-${occ.date}-${occ.time}`}
                                reservation={occ.reservation}
                                time={occ.time}
                                onClick={() => onReservedSlotClick?.(occ.reservation)}
                                positionStyle={style}
                              />
                            );
                          }
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeSession && (
                <div
                  className="p-2 rounded-md text-xs cursor-grabbing shadow-lg opacity-90"
                  style={{
                    backgroundColor: `${activeSession.servico?.color}30`,
                    borderLeft: `3px solid ${activeSession.servico?.color}`,
                    width: "150px",
                  }}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <p className="font-medium truncate">{activeSession.paciente?.full_name?.split(" ")?.[0] ?? ""}</p>
                  </div>
                  <p className="text-muted-foreground truncate text-[10px]">{activeSession.servico?.name}</p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </CardContent>
      </Card>

      {/* Modal de confirmação — fora do Card para renderizar no topo */}
      <ConfirmRescheduleModal
        confirmation={pendingReschedule}
        onConfirm={handleConfirmReschedule}
        onCancel={handleCancelReschedule}
      />
    </>
  );
}
