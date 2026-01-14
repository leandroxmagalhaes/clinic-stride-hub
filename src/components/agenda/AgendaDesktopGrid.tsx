import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

interface Session {
  id: string;
  start_time: Date;
  end_time: Date;
  status: string;
  paciente?: { full_name: string };
  profissional?: { full_name: string };
  servico?: { name: string; color: string };
}

interface AgendaDesktopGridProps {
  weekDays: Date[];
  hours: number[];
  sessions: Session[];
  onSlotClick: (date: Date, hour: number) => void;
  onSessionClick: (session: Session) => void;
}

export function AgendaDesktopGrid({ 
  weekDays, 
  hours, 
  sessions,
  onSlotClick,
  onSessionClick,
}: AgendaDesktopGridProps) {
  const getSessionsForSlot = (date: Date, hour: number) => {
    return sessions.filter(
      (s) => isSameDay(s.start_time, date) && s.start_time.getHours() === hour
    );
  };

  return (
    <Card className="shadow-card overflow-hidden hidden md:block">
      <CardContent className="p-0">
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
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <div
                        key={dayIndex}
                        className={cn(
                          "min-h-[70px] p-1 border-r last:border-r-0 hover:bg-muted/30 cursor-pointer transition-colors group",
                          isToday && "bg-primary/[0.02]"
                        )}
                        onClick={() => slotSessions.length === 0 && onSlotClick(day, hour)}
                      >
                        {slotSessions.map((session) => (
                          <div
                            key={session.id}
                            className="p-2 rounded-md text-xs mb-1 cursor-grab hover:opacity-90 transition-all hover:shadow-md group/session"
                            style={{ 
                              backgroundColor: `${session.servico?.color}15`,
                              borderLeft: `3px solid ${session.servico?.color}`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSessionClick(session);
                            }}
                            draggable
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <div className="flex items-center gap-1">
                                <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover/session:opacity-100 transition-opacity cursor-grab" />
                                <p className="font-medium truncate">
                                  {session.paciente?.full_name.split(' ')[0]}
                                </p>
                              </div>
                              <StatusBadge status={session.status as any} className="scale-90" />
                            </div>
                            <p className="text-muted-foreground truncate text-[10px]">
                              {session.servico?.name} • {session.profissional?.full_name.split(' ')[0]}
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
