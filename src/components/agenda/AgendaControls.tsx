import { format, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays, Calendar, Filter } from "lucide-react";

// Full range of available hours for filter
const ALL_HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 to 23:00

interface AgendaControlsProps {
  currentDate: Date;
  viewMode: 'week' | 'day';
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (mode: 'week' | 'day') => void;
  hourFilter: { start: number; end: number };
  onHourFilterChange: (filter: { start: number; end: number }) => void;
}

export function AgendaControls({
  currentDate,
  viewMode,
  onPrevious,
  onNext,
  onToday,
  onViewModeChange,
  hourFilter,
  onHourFilterChange,
}: AgendaControlsProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  const handleStartHourChange = (value: string) => {
    const newStart = parseInt(value, 10);
    onHourFilterChange({
      start: newStart,
      end: Math.max(newStart + 1, hourFilter.end),
    });
  };

  const handleEndHourChange = (value: string) => {
    const newEnd = parseInt(value, 10);
    onHourFilterChange({
      start: Math.min(hourFilter.start, newEnd - 1),
      end: newEnd,
    });
  };

  return (
    <Card className="shadow-card">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          {/* Row 1: Navigation + View Mode */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Navigation */}
            <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={onPrevious} className="h-9 w-9">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={onNext} className="h-9 w-9">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={onToday} 
                  className="text-primary text-sm px-2 sm:px-3"
                >
                  Hoje
                </Button>
              </div>
              
              {/* Date display - Mobile: compact, Desktop: full */}
              <h2 className="font-display font-semibold text-sm sm:text-lg ml-1 sm:ml-2">
                {/* Mobile: Always show day */}
                <span className="md:hidden">
                  {format(currentDate, "d MMM", { locale: ptBR })}
                </span>
                {/* Desktop: Show range or full date */}
                <span className="hidden md:inline">
                  {viewMode === 'week' 
                    ? `${format(weekStart, "d MMM", { locale: ptBR })} - ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: ptBR })}`
                    : format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })
                  }
                </span>
              </h2>
            </div>
            
            {/* View Mode Toggle - Hidden on mobile since we force day view */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant={viewMode === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onViewModeChange('week')}
                className="gap-1.5"
              >
                <CalendarDays className="h-4 w-4" />
                Semana
              </Button>
              <Button
                variant={viewMode === 'day' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onViewModeChange('day')}
                className="gap-1.5"
              >
                <Calendar className="h-4 w-4" />
                Dia
              </Button>
            </div>
          </div>

          {/* Row 2: Hour Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Visualizar das</span>
              <span className="sm:hidden">Das</span>
            </div>
            <Select value={String(hourFilter.start)} onValueChange={handleStartHourChange}>
              <SelectTrigger className="w-[80px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_HOURS.filter(h => h < hourFilter.end).map((hour) => (
                  <SelectItem key={hour} value={String(hour)} className="text-xs">
                    {String(hour).padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">às</span>
            <Select value={String(hourFilter.end)} onValueChange={handleEndHourChange}>
              <SelectTrigger className="w-[80px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_HOURS.filter(h => h > hourFilter.start).map((hour) => (
                  <SelectItem key={hour} value={String(hour)} className="text-xs">
                    {String(hour).padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
