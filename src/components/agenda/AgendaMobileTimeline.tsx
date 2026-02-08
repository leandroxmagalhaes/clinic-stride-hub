import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock, Plus, User, Calendar, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { ReservedSlot } from "@/services/ReservedSlotService";

interface Session {
  id: string;
  start_time: Date;
  end_time: Date;
  status: string;
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
  getCreditBalance?: (patientId: string) => number;
}

export function AgendaMobileTimeline({ 
  currentDate, 
  hours, 
  sessions,
  reservedSlotOccurrences = [],
  onSlotClick,
  onSessionClick,
  getCreditBalance,
}: AgendaMobileTimelineProps) {
  const getSessionsForHour = (hour: number) => {
    return sessions.filter(
      (s) => isSameDay(s.start_time, currentDate) && s.start_time.getHours() === hour
    );
  };

  const getReservationsForHour = (hour: number) => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    return reservedSlotOccurrences.filter(occ => {
      const occHour = parseInt(occ.time.split(':')[0], 10);
      return occ.date === dateStr && occHour === hour;
    });
  };

  const isToday = isSameDay(currentDate, new Date());
  const currentHour = new Date().getHours();

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
      <CardContent className="p-0">
        <div className="divide-y">
          {hours.map((hour) => {
            const hourSessions = getSessionsForHour(hour);
            const hourReservations = getReservationsForHour(hour);
            const isPastHour = isToday && hour < currentHour;
            const isCurrentHour = isToday && hour === currentHour;
            const hasContent = hourSessions.length > 0 || hourReservations.length > 0;
            
            return (
              <div 
                key={hour}
                className={cn(
                  "relative",
                  isPastHour && "opacity-50"
                )}
              >
                {/* Current time indicator */}
                {isCurrentHour && (
                  <div className="absolute left-0 right-0 top-0 h-0.5 bg-primary z-10" />
                )}
                
                {hasContent ? (
                  <div className="space-y-1 p-2">
                    {/* Reserved slots */}
                    {hourReservations.map((occ) => (
                      <div
                        key={`reserved-${occ.reservation.id}-${occ.time}`}
                        className="w-full text-left p-3 min-h-[60px] flex items-start gap-4"
                      >
                        {/* Time column */}
                        <div className="flex-shrink-0 w-14 text-center">
                          <p className={cn(
                            "text-sm font-medium text-muted-foreground",
                            isCurrentHour && "text-primary font-semibold"
                          )}>
                            {occ.time.substring(0, 5)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {occ.reservation.duracao_minutos}min
                          </p>
                        </div>
                        
                        {/* Reserved slot card */}
                        <div 
                          className="flex-1 p-3 rounded-lg border-l-4 border-dashed"
                          style={{ 
                            backgroundColor: `${occ.reservation.cor}20`,
                            borderLeftColor: occ.reservation.cor,
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="font-medium text-sm">
                              {occ.reservation.patient?.full_name || "Paciente"}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {occ.reservation.titulo || "Horário Reservado"}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {/* Sessions */}
                    {hourSessions.map((session) => {
                      const patientId = session.paciente?.id;
                      const hasCredits = patientId && getCreditBalance 
                        ? getCreditBalance(patientId) > 0 
                        : undefined;
                      const isPendingPayment = session.payment_status === 'pending' || hasCredits === false;
                      
                      return (
                        <button
                          key={session.id}
                          onClick={() => onSessionClick(session)}
                          className="w-full text-left p-3 hover:bg-muted/50 transition-colors min-h-[60px] flex items-start gap-4 active:bg-muted rounded-lg"
                        >
                          {/* Time column - show actual session time */}
                          <div className="flex-shrink-0 w-14 text-center">
                            <p className={cn(
                              "text-sm font-semibold",
                              isCurrentHour && "text-primary"
                            )}>
                              {format(new Date(session.start_time), "HH:mm")}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {session.servico?.duration_minutes}min
                            </p>
                          </div>
                          
                          {/* Session card */}
                          <div 
                            className={cn(
                              "flex-1 p-3 rounded-lg relative",
                              isPendingPayment && "ring-2 ring-warning/50",
                              hasCredits === true && "ring-1 ring-success/30"
                            )}
                            style={{ 
                              backgroundColor: `${session.servico?.color}15`,
                              borderLeft: `4px solid ${session.servico?.color}`,
                            }}
                          >
                            {/* Credit indicator */}
                            {hasCredits !== undefined && (
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
                            
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <p className="font-medium text-sm">
                                  {session.paciente?.full_name}
                                </p>
                              </div>
                              <StatusBadge status={session.status as any} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {session.servico?.name} • {session.profissional?.full_name}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  // Empty slot - show add button
                  <button
                    onClick={() => onSlotClick(currentDate, hour)}
                    className="w-full p-4 hover:bg-muted/30 transition-colors min-h-[72px] flex items-center gap-4 active:bg-muted/50 group"
                  >
                    {/* Time column */}
                    <div className="flex-shrink-0 w-14 text-center">
                      <p className={cn(
                        "text-sm font-medium text-muted-foreground",
                        isCurrentHour && "text-primary font-semibold"
                      )}>
                        {String(hour).padStart(2, '0')}:00
                      </p>
                    </div>
                    
                    {/* Empty slot indicator */}
                    <div className="flex-1 border-2 border-dashed border-muted-foreground/20 rounded-lg p-3 flex items-center justify-center gap-2 group-hover:border-primary/40 group-hover:bg-primary/5 transition-colors">
                      <Plus className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60" />
                      <span className="text-xs text-muted-foreground/50 group-hover:text-primary/60">
                        Agendar
                      </span>
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
