import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { Clock, Plus, User, Calendar, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { ReservedSlot } from "@/services/ReservedSlotService";
import { HOUR_HEIGHT } from "./DroppableSlot";

interface Session {
  id: string;
  start_time: Date;
  end_time: Date;
  status: string;
  confirmacao_estado?: string;
  payment_status?: string;
  paciente?: { full_name: string; id?: string };
  profissional?: { full_name: string };
  servico?: { name: string; color: string; duration_minutes: number };
}

interface ReservedSlotOccurrence {
  date: string;
  time: string;
  reservation: ReservedSlot;
}

interface AgendaMobileTimelineProps {
  currentDate: Date;
  hours: number[];
  sessions: Session[];
  reservedSlotOccurrences?: ReservedSlotOccurrence[];
  onSlotClick: (date: Date, hour: number) => void;
  onSessionClick: (session: Session) => void;
  onReservedSlotClick?: (reservation: ReservedSlot) => void;
  getCreditBalance?: (patientId: string) => number;
}

export function AgendaMobileTimeline({ 
  currentDate, 
  hours, 
  sessions,
  reservedSlotOccurrences = [],
  onSlotClick,
  onSessionClick,
  onReservedSlotClick,
  getCreditBalance,
}: AgendaMobileTimelineProps) {
  const isToday = isSameDay(currentDate, new Date());
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();
  const firstHour = hours[0] ?? 0;
  const totalHeight = hours.length * HOUR_HEIGHT;

  const daySessions = sessions.filter(s => isSameDay(s.start_time, currentDate));
  const dateStr = format(currentDate, "yyyy-MM-dd");
  const dayReservations = reservedSlotOccurrences.filter(occ => occ.date === dateStr);

  // Current time indicator position
  const currentTimeTop = isToday && currentHour >= firstHour
    ? ((currentHour - firstHour) * 60 + currentMinute) / 60 * HOUR_HEIGHT
    : null;

  return (
    <Card className="shadow-card md:hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-primary" />
          <span className={cn(isToday && "text-primary")}>
            {format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto">
        <div className="relative" style={{ height: `${totalHeight}px` }}>
          {/* Hour lines background */}
          {hours.map((hour, i) => {
            const isPastHour = isToday && hour < currentHour;
            return (
              <div
                key={hour}
                className={cn(
                  "absolute left-0 right-0 border-b flex",
                  isPastHour && "opacity-50"
                )}
                style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                onClick={() => onSlotClick(currentDate, hour)}
              >
                <div className="flex-shrink-0 w-14 text-center pt-1">
                  <p className={cn(
                    "text-xs font-medium text-muted-foreground",
                    isToday && hour === currentHour && "text-primary font-semibold"
                  )}>
                    {String(hour).padStart(2, '0')}:00
                  </p>
                </div>
                <div className="flex-1 border-l" />
              </div>
            );
          })}

          {/* Current time indicator */}
          {currentTimeTop != null && (
            <div 
              className="absolute left-14 right-0 h-0.5 bg-primary z-20 pointer-events-none"
              style={{ top: `${currentTimeTop}px` }}
            >
              <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-primary" />
            </div>
          )}

          {/* Sessions positioned absolutely */}
          {daySessions.map(session => {
            const start = new Date(session.start_time);
            const end = new Date(session.end_time);
            const startMin = start.getHours() * 60 + start.getMinutes();
            const durationMin = (end.getTime() - start.getTime()) / 60000;
            const offsetMin = startMin - firstHour * 60;
            const top = (offsetMin / 60) * HOUR_HEIGHT;
            const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 28);

            const patientId = session.paciente?.id;
            const hasCredits = patientId && getCreditBalance 
              ? getCreditBalance(patientId) > 0 
              : undefined;
            const isPendingPayment = session.payment_status === 'pending' || hasCredits === false;

            return (
              <button
                key={session.id}
                onClick={() => onSessionClick(session)}
                className="absolute left-16 right-2 text-left rounded-lg overflow-hidden hover:opacity-90 transition-all z-10"
                style={{ top: `${top}px`, height: `${height}px` }}
              >
                <div 
                  className={cn(
                    "h-full p-2 relative",
                    isPendingPayment && "ring-2 ring-warning/50",
                    hasCredits === true && "ring-1 ring-success/30"
                  )}
                  style={{ 
                    backgroundColor: `${session.servico?.color}15`,
                    borderLeft: `4px solid ${session.servico?.color}`,
                  }}
                >
                  {hasCredits !== undefined && height > 35 && (
                    <div className="absolute -top-1 -right-1">
                      {hasCredits ? (
                        <div className="bg-success text-success-foreground rounded-full p-0.5">
                          <CheckCircle2 className="h-3 w-3" />
                        </div>
                      ) : (
                        <div className="bg-warning text-warning-foreground rounded-full p-0.5">
                          <AlertTriangle className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {height < 35 ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-muted-foreground">{format(start, "HH:mm")}</span>
                      <span className="font-medium truncate">{session.paciente?.full_name?.split(' ')?.[0] ?? ''}</span>
                      <StatusBadge status={(session.confirmacao_estado === "confirmado" && session.status === "agendado" ? "confirmado" : session.status) as any} className="scale-75" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <p className="font-medium text-sm truncate">
                            {session.paciente?.full_name}
                          </p>
                        </div>
                        <StatusBadge status={(session.confirmacao_estado === "confirmado" && session.status === "agendado" ? "confirmado" : session.status) as any} className="flex-shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {format(start, "HH:mm")} • {session.servico?.name} • {session.profissional?.full_name?.split(' ')?.[0] ?? ''}
                      </p>
                    </>
                  )}
                </div>
              </button>
            );
          })}

          {/* Reserved slots positioned absolutely */}
          {dayReservations.map(occ => {
            const [h, m] = occ.time.split(':').map(Number);
            const startMin = h * 60 + (m || 0);
            const durationMin = occ.reservation.duracao_minutos;
            const offsetMin = startMin - firstHour * 60;
            const top = (offsetMin / 60) * HOUR_HEIGHT;
            const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 28);

            return (
              <div
                key={`reserved-${occ.reservation.id}-${occ.time}`}
                className="absolute left-16 right-2 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity z-10"
                style={{ 
                  top: `${top}px`, 
                  height: `${height}px`,
                  backgroundColor: `${occ.reservation.cor}20`,
                  borderLeft: `4px dashed ${occ.reservation.cor}`,
                }}
                onClick={() => onReservedSlotClick?.(occ.reservation)}
              >
                <div className="p-2 h-full">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <p className="font-medium text-sm truncate">
                      {occ.reservation.patient?.full_name || "Paciente"}
                    </p>
                  </div>
                  {height > 35 && (
                    <p className="text-xs text-muted-foreground truncate">
                      {occ.time.substring(0, 5)} • {occ.reservation.titulo || "Horário Reservado"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
