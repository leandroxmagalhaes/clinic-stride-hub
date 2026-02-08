import { Lock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ReservedSlot } from "@/services/ReservedSlotService";

interface ReservedSlotCardProps {
  reservation: ReservedSlot;
  time: string;
  onClick?: () => void;
  compact?: boolean;
}

export function ReservedSlotCard({ 
  reservation, 
  time, 
  onClick, 
  compact = false 
}: ReservedSlotCardProps) {
  const patientName = reservation.patient?.full_name || "Paciente";
  const firstName = patientName.split(' ')[0];
  const displayTime = time.substring(0, 5); // "HH:MM"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={onClick}
            className={cn(
              "rounded-md text-xs cursor-pointer transition-all hover:opacity-90",
              "border-l-3 border-dashed",
              compact ? "p-1" : "p-2"
            )}
            style={{
              backgroundColor: `${reservation.cor}30`,
              borderLeftColor: reservation.cor,
              borderLeftWidth: '3px',
              borderLeftStyle: 'dashed',
            }}
          >
            <div className="flex items-center gap-1">
              <Lock 
                className={cn(
                  "flex-shrink-0 text-muted-foreground",
                  compact ? "h-3 w-3" : "h-3.5 w-3.5"
                )} 
              />
              {!compact && (
                <span className="text-[10px] text-muted-foreground">
                  {displayTime}
                </span>
              )}
            </div>
            <p className={cn(
              "font-medium truncate mt-0.5",
              compact ? "text-[10px]" : "text-xs"
            )}>
              {firstName}
            </p>
            {!compact && reservation.titulo && (
              <p className="text-muted-foreground truncate text-[10px]">
                {reservation.titulo}
              </p>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" style={{ color: reservation.cor }} />
              <span className="font-medium">Horário Reservado</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-3 w-3 text-muted-foreground" />
              <span>{patientName}</span>
            </div>
            {reservation.titulo && (
              <p className="text-xs text-muted-foreground">{reservation.titulo}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {displayTime} • {reservation.duracao_minutos}min
            </p>
            {reservation.tipo === 'fixo' && reservation.dias_semana && (
              <p className="text-xs text-muted-foreground">
                Recorrente: {reservation.dias_semana.map(d => 
                  ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][d]
                ).join(', ')}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
