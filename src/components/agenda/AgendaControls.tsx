import { format, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays, Calendar, Filter, Check } from "lucide-react";
import { useState, useRef } from "react";

// Full range of available hours for filter
const ALL_HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 to 23:00

interface AgendaControlsProps {
  currentDate: Date;
  viewMode: "week" | "day";
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (mode: "week" | "day") => void;
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

  // Feedback visual de preferência guardada
  const [savedFeedback, setSavedFeedback] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSavedFeedback = () => {
    setSavedFeedback(true);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setSavedFeedback(false), 1800);
  };

  const handleStartHourChange = (value: string) => {
    const newStart = parseInt(value, 10);
    onHourFilterChange({
      start: newStart,
      end: Math.max(newStart + 1, hourFilter.end),
    });
    showSavedFeedback();
  };

  const handleEndHourChange = (value: string) => {
    const newEnd = parseInt(value, 10);
    onHourFilterChange({
      start: Math.min(hourFilter.start, newEnd - 1),
      end: newEnd,
    });
    showSavedFeedback();
  };

  const handleViewModeChange = (mode: "week" | "day") => {
    onViewModeChange(mode);
    showSavedFeedback();
  };

  return (
    <Card className="shadow-card">
      <CardContent className="p-1.5">

        <div className="flex flex-wrap items-center gap-3">
          {/* Left: Navigation */}
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={onPrevious} className="h-9 w-9">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={onNext} className="h-9 w-9">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={onToday} className="text-primary text-sm px-2 sm:px-3">
                Hoje
              </Button>
            </div>

            {/* Date display */}
            <h2 className="font-display font-semibold text-sm sm:text-lg ml-1 sm:ml-2">
              <span className="md:hidden">{format(currentDate, "d MMM", { locale: ptBR })}</span>
              <span className="hidden md:inline">
                {viewMode === "week"
                  ? `${format(weekStart, "d MMM", { locale: ptBR })} - ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: ptBR })}`
                  : format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })}
              </span>
            </h2>
          </div>

          {/* Center: Hour filter + feedback */}
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
                {ALL_HOURS.filter((h) => h < hourFilter.end).map((hour) => (
                  <SelectItem key={hour} value={String(hour)} className="text-xs">
                    {String(hour).padStart(2, "0")}:00
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
                {ALL_HOURS.filter((h) => h > hourFilter.start).map((hour) => (
                  <SelectItem key={hour} value={String(hour)} className="text-xs">
                    {String(hour).padStart(2, "0")}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Feedback subtil: preferência guardada */}
            <div
              className={`
                flex items-center gap-1 text-xs text-emerald-600 transition-all duration-300
                ${savedFeedback ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1 pointer-events-none"}
              `}
            >
              <Check className="h-3.5 w-3.5" />
              <span>Preferência guardada</span>
            </div>
          </div>

          {/* Right: View Mode Toggle */}
          <div className="hidden md:flex items-center gap-2 ml-auto">
            <Button
              variant={viewMode === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => handleViewModeChange("week")}
              className="gap-1.5"
            >
              <CalendarDays className="h-4 w-4" />
              Semana
            </Button>
            <Button
              variant={viewMode === "day" ? "default" : "outline"}
              size="sm"
              onClick={() => handleViewModeChange("day")}
              className="gap-1.5"
            >
              <Calendar className="h-4 w-4" />
              Dia
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
