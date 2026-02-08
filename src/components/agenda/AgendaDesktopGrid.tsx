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
import { DroppableSlot } from "./DroppableSlot";
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
  getCreditBalance?: (patientId: string) => number;
}

export function AgendaDesktopGrid({ 
  weekDays, 
  hours, 
  sessions,
  reservedSlotOccurrences = [],
  onSlotClick,
  onSessionClick,
  onSessionReschedule,
  getCreditBalance,
}: AgendaDesktopGridProps) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    })
  );

  const getSessionsForSlot = (date: Date, hour: number) => {
    return sessions.filter(
      (s) => isSameDay(s.start_time, date) && s.start_time.getHours() === hour
    );
  };

  const getReservationsForSlot = (date: Date, hour: number) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return reservedSlotOccurrences.filter(occ => {
      const occHour = parseInt(occ.time.split(':')[0], 10);
      return occ.date === dateStr && occHour === hour;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const session = active.data.current?.session as Session;
    if (session) {
      setActiveSession(session);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSession(null);

    if (!over || !onSessionReschedule) return;

    const sessionId = active.id as string;
    const { date, hour } = over.data.current as { date: Date; hour: number };

    // Only reschedule if dropped on a different slot
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      const currentHour = session.start_time.getHours();
      const isSameSlot = isSameDay(session.start_time, date) && currentHour === hour;
      
      if (!isSameSlot) {
        onSessionReschedule(sessionId, date, hour);
      }
    }
  };

  return (
    <Card className="shadow-card overflow-hidden hidden md:block">
      <CardContent className="p-0">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
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
                    <div
                      key={index}
                      className={cn(
                        "p-3 text-center border-r last:border-r-0",
                        isToday && "bg-primary/5"
                      )}
                    >
                      <p className="text-xs text-muted-foreground uppercase">
                        {format(day, "EEE", { locale: ptBR })}
                      </p>
                      <p className={cn(
                        "text-lg font-semibold mt-1",
                        isToday && "text-primary"
                      )}>
                        {format(day, "d")}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Time Grid */}
              <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
                {hours.map((hour) => (
                  <div 
                    key={hour} 
                    className="grid border-b last:border-b-0"
                    style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)` }}
                  >
                    <div className="p-2 text-xs text-muted-foreground text-right pr-3 border-r bg-muted/20">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                    {weekDays.map((day, dayIndex) => {
                      const slotSessions = getSessionsForSlot(day, hour);
                      const slotReservations = getReservationsForSlot(day, hour);
                      const isToday = isSameDay(day, new Date());
                      const slotId = `${day.toISOString()}-${hour}`;
                      
                      return (
                        <DroppableSlot
                          key={dayIndex}
                          id={slotId}
                          date={day}
                          hour={hour}
                          isToday={isToday}
                          hasSession={slotSessions.length > 0 || slotReservations.length > 0}
                          onSlotClick={() => onSlotClick(day, hour)}
                        >
                          {/* Reserved slots first (background) */}
                          {slotReservations.map((occ) => (
                            <ReservedSlotCard
                              key={`reserved-${occ.reservation.id}-${occ.date}-${occ.time}`}
                              reservation={occ.reservation}
                              time={occ.time}
                              compact={slotSessions.length > 0}
                            />
                          ))}
                          {/* Regular sessions */}
                          {slotSessions.map((session) => {
                            const patientId = session.paciente?.id;
                            const hasCredits = patientId && getCreditBalance 
                              ? getCreditBalance(patientId) > 0 
                              : undefined;
                            // Format time with minutes
                            const sessionTime = format(new Date(session.start_time), "HH:mm");
                            return (
                              <DraggableSession
                                key={session.id}
                                session={session}
                                onClick={onSessionClick}
                                hasCredits={hasCredits}
                                displayTime={sessionTime}
                              />
                            );
                          })}
                        </DroppableSlot>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Drag Overlay - Shows while dragging */}
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
