import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, CalendarDays } from "lucide-react";
import { GeneratedDate, PackageSchedulingService } from "@/services/PackageSchedulingService";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PackageSchedulePreviewProps {
  dates: GeneratedDate[];
}

export function PackageSchedulePreview({ dates }: PackageSchedulePreviewProps) {
  if (dates.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarDays className="h-4 w-4 text-primary" />
        <span>Pré-visualização ({dates.length} sessões)</span>
      </div>
      <ScrollArea className="h-[160px] rounded-md border p-3">
        <div className="space-y-1.5">
          {dates.map((d, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50"
            >
              <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="font-medium w-5 text-muted-foreground">{i + 1}.</span>
              <span>
                {format(d.date, "EEE, dd/MM/yyyy", { locale: ptBR })}
              </span>
              <span className="text-muted-foreground ml-auto">
                {String(d.hour).padStart(2, "0")}:{String(d.minute).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
