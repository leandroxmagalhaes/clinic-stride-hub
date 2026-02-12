import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  SchedulingModality,
  SchedulingFrequency,
  PackageSchedulingService,
} from "@/services/PackageSchedulingService";
import { cn } from "@/lib/utils";
import { Repeat, Package, Layers, Calendar as CalendarIcon } from "lucide-react";

interface ModalityFieldsProps {
  modality: SchedulingModality;
  setModality: (v: SchedulingModality) => void;
  frequency: SchedulingFrequency;
  setFrequency: (v: SchedulingFrequency) => void;
  selectedDays: number[];
  setSelectedDays: (v: number[]) => void;
  flexible: boolean;
  setFlexible: (v: boolean) => void;
  totalSessions: number;
  setTotalSessions: (v: number) => void;
  customSessionCount: string;
  setCustomSessionCount: (v: string) => void;
}

const MODALITY_OPTIONS: { value: SchedulingModality; label: string; icon: React.ReactNode }[] = [
  { value: "avulso", label: "Avulso", icon: <CalendarIcon className="h-4 w-4" /> },
  { value: "recorrente", label: "Recorrente", icon: <Repeat className="h-4 w-4" /> },
  { value: "pacote_fixo", label: "Pacote Fixo", icon: <Package className="h-4 w-4" /> },
  { value: "pacote_personalizado", label: "Personalizado", icon: <Layers className="h-4 w-4" /> },
];

export function ModalityFields({
  modality,
  setModality,
  frequency,
  setFrequency,
  selectedDays,
  setSelectedDays,
  flexible,
  setFlexible,
  totalSessions,
  setTotalSessions,
  customSessionCount,
  setCustomSessionCount,
}: ModalityFieldsProps) {
  const isPackageMode = modality !== "avulso";
  const showSessionCount = modality === "pacote_fixo" || modality === "pacote_personalizado";
  const fixedCounts = PackageSchedulingService.getFixedSessionCounts();
  const dayOptions = PackageSchedulingService.getDayLabels();

  const toggleDay = (day: number) => {
    setSelectedDays(
      selectedDays.includes(day)
        ? selectedDays.filter((d) => d !== day)
        : [...selectedDays, day].sort((a, b) => a - b)
    );
  };

  return (
    <div className="space-y-4">
      {/* Modality selector */}
      <div className="space-y-2">
        <Label>Modalidade</Label>
        <div className="grid grid-cols-2 gap-2">
          {MODALITY_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={modality === opt.value ? "default" : "outline"}
              size="sm"
              className={cn(
                "justify-start gap-2 min-h-[40px] text-xs",
                modality === opt.value && "ring-2 ring-primary/30"
              )}
              onClick={() => setModality(opt.value)}
            >
              {opt.icon}
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Package/Recurring fields */}
      {isPackageMode && (
        <>
          {/* Frequency */}
          <div className="space-y-2">
            <Label>Frequência</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as SchedulingFrequency)}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semanal" className="min-h-[44px]">Semanal</SelectItem>
                <SelectItem value="quinzenal" className="min-h-[44px]">Quinzenal</SelectItem>
                <SelectItem value="mensal" className="min-h-[44px]">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Days of week */}
          <div className="space-y-2">
            <Label>Dias da semana</Label>
            <div className="flex flex-wrap gap-1.5">
              {dayOptions.map((day) => (
                <Button
                  key={day.value}
                  type="button"
                  variant={selectedDays.includes(day.value) ? "default" : "outline"}
                  size="sm"
                  className="min-h-[36px] min-w-[52px] text-xs"
                  onClick={() => toggleDay(day.value)}
                >
                  {day.label.slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>

          {/* Fixed vs Flexible */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">Dias flexíveis</p>
              <p className="text-xs text-muted-foreground">Permitir variar dias semana a semana</p>
            </div>
            <Switch checked={flexible} onCheckedChange={setFlexible} />
          </div>

          {/* Session count (for packages) */}
          {showSessionCount && (
            <div className="space-y-2">
              <Label>Quantidade de sessões</Label>
              <div className="flex gap-2">
                {fixedCounts.map((count) => (
                  <Button
                    key={count}
                    type="button"
                    variant={totalSessions === count ? "default" : "outline"}
                    size="sm"
                    className="min-h-[40px] flex-1"
                    onClick={() => {
                      setTotalSessions(count);
                      setCustomSessionCount("");
                    }}
                  >
                    {count}
                  </Button>
                ))}
                <Input
                  type="number"
                  min={1}
                  max={52}
                  placeholder="Outro"
                  value={customSessionCount}
                  onChange={(e) => {
                    setCustomSessionCount(e.target.value);
                    const val = parseInt(e.target.value, 10);
                    if (val > 0 && val <= 52) setTotalSessions(val);
                  }}
                  className="min-h-[40px] w-20"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
