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
import { StatusBadge } from "@/components/ui/status-badge";
import { GripVertical } from "lucide-react";
import { ReservedSlot } from "@/services/ReservedSlotService";

interface Session {
  id: string;
  start_time: Date;
  end_time: Date;
  status: string;
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
interface PositionedItem {
  startMinutes: number;
  endMinutes: number;
  index: number;
  total: number;
}

function computeOverlapPositions<T extends { startMin: number; endMin: number }>(items: T[]): (T & { index: number; total: number })[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  
  // Group overlapping items
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

  return groups.flatMap(group => 
    group.map((item, idx) => ({ ...item, index: idx, total: group.length }))
  );
}

function getItemStyle(startMin: number, endMin: number, firstHour: number, index: number, total: number): React.CSSProperties {
  const offsetMin = startMin - firstHour * 60;
  const durationMin = endMin - startMin;
  return {
    position: 'absolute' as const,
    top: `${(offsetMin / 60) * HOUR_HEIGHT}px`,
    height: `${Math.max((durationMin / 60) * HOUR_HEIGHT, 20)}px`,
    left: `${(index / total) * 100}%`,
    width: `${(1 / total) * 100}%`,
    zIndex: 10,
  };
}

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
  const firstHour = hours[0] ?? 0;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const getSessionsForDay = (date: Date) => {
    return sessions.filter(s => isSameDay(s.start_time, date));
  };

  const getReservationsForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return reservedSlotOccurrences.filter(occ => occ.date === dateStr);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const session = event.active.data.current?.session as Session;
    if (session) setActiveSession(session);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSession(null);
    if (!over || !onSessionReschedule) return;

    const sessionId = active.id as string;
    const { date, hour } = over.data.current as { date: Date; hour: number };
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      const isSameSlot = isSameDay(session.start_time, date) && session.start_time.getHours() === hour;
      if (!isSameSlot) onSessionReschedule(sessionId, date, hour);
    }
  };

  const totalHeight = hours.length * HOUR_HEIGHT;

  return (
    <Card className="shadow-card overflow-hidden hidden md:block">
      <CardContent className="p-0">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[800px]">
              {/* Header */}
              <div 
                className="grid border-b bg-muted/30" 
                style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)` }}
              >
                <div className="p-3 border-r" />
                {weekDays.map((day, index) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div key={index} className={cn("p-3 text-center border-r last:border-r-0", isToday && "bg-primary/5")}>
                      <p className="text-xs text-muted-foreground uppercase">
                        {format(day, "EEE", { locale: ptBR })}
                      </p>
                      <p className={cn("text-lg font-semibold mt-1", isToday && "text-primary")}>
                        {format(day, "d")}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Time Grid Body */}
              <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
                <div 
                  className="grid"
                  style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)` }}
                >
                  {/* Hour labels column */}
                  <div className="border-r bg-muted/20" style={{ height: `${totalHeight}px` }}>
                    {hours.map(hour => (
                      <div 
                        key={hour} 
                        className="text-xs text-muted-foreground text-right pr-3 flex items-start justify-end pt-1"
                        style={{ height: `${HOUR_HEIGHT}px` }}
                      >
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDays.map((day, dayIndex) => {
                    const isToday = isSameDay(day, new Date());
                    const daySessions = getSessionsForDay(day);
                    const dayReservations = getReservationsForDay(day);

                    // Build items for overlap calculation
                    const sessionItems = daySessions.map(s => {
                      const start = new Date(s.start_time);
                      const end = new Date(s.end_time);
                      return {
                        type: 'session' as const,
                        session: s,
                        startMin: start.getHours() * 60 + start.getMinutes(),
                        endMin: end.getHours() * 60 + end.getMinutes(),
                      };
                    });

                    const reservationItems = dayReservations.map(occ => {
                      const [h, m] = occ.time.split(':').map(Number);
                      return {
                        type: 'reservation' as const,
                        occ,
                        startMin: h * 60 + (m || 0),
                        endMin: h * 60 + (m || 0) + occ.reservation.duracao_minutos,
                      };
                    });

                    const allItems = [...sessionItems, ...reservationItems];
                    const positioned = computeOverlapPositions(allItems);

                    return (
                      <div key={dayIndex} className="relative border-r last:border-r-0" style={{ height: `${totalHeight}px` }}>
                        {/* Background: drop zones per hour */}
                        {hours.map(hour => (
                          <DroppableSlot
                            key={hour}
                            id={`${day.toISOString()}-${hour}`}
                            date={day}
                            hour={hour}
                            isToday={isToday}
                            onSlotClick={() => onSlotClick(day, hour)}
                          />
                        ))}

                        {/* Foreground: absolutely positioned sessions & reservations */}
                        {positioned.map(item => {
                          const style = getItemStyle(item.startMin, item.endMin, firstHour, item.index, item.total);

                          if (item.type === 'session') {
                            const s = item.session;
                            const patientId = s.paciente?.id;
                            const hasCredits = patientId && getCreditBalance ? getCreditBalance(patientId) > 0 : undefined;
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
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeSession && (
              <div
                className="p-2 rounded-md text-xs cursor-grabbing shadow-lg opacity-90"
                style={{
                  backgroundColor: `${activeSession.servico?.color}30`,
                  borderLeft: `3px solid ${activeSession.servico?.color}`,
                  width: '150px',
                }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                  <p className="font-medium truncate">
                    {activeSession.paciente?.full_name.split(' ')[0]}
                  </p>
                </div>
                <p className="text-muted-foreground truncate text-[10px]">
                  {activeSession.servico?.name}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
}
