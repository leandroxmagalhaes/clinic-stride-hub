import { addDays, addWeeks, getISODay, startOfWeek, isBefore, isEqual } from "date-fns";

export type SchedulingModality = "avulso" | "recorrente" | "pacote_fixo" | "pacote_personalizado";
export type SchedulingFrequency = "semanal" | "quinzenal" | "mensal";

export interface PackageConfig {
  modality: SchedulingModality;
  frequency?: SchedulingFrequency;
  fixedDays: number[]; // ISO day of week: 1=Mon, 2=Tue, ..., 6=Sat, 7=Sun
  flexible: boolean;
  totalSessions: number;
  startDate: Date;
  hour: number;
  minute: number;
}

export interface GeneratedDate {
  date: Date;
  hour: number;
  minute: number;
  dayOfWeek: number;
}

const DAY_LABELS: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
  7: "Dom",
};

export class PackageSchedulingService {
  static getDayLabel(isoDay: number): string {
    return DAY_LABELS[isoDay] || "";
  }

  static getDayLabels(): { value: number; label: string }[] {
    return [
      { value: 1, label: "Segunda" },
      { value: 2, label: "Terça" },
      { value: 3, label: "Quarta" },
      { value: 4, label: "Quinta" },
      { value: 5, label: "Sexta" },
      { value: 6, label: "Sábado" },
    ];
  }

  static getFixedSessionCounts(): number[] {
    return [4, 8, 12];
  }

  /**
   * Generate dates for a package/recurring schedule.
   */
  static generateDates(config: PackageConfig): GeneratedDate[] {
    const { modality, frequency, fixedDays, totalSessions, startDate, hour, minute } = config;

    if (modality === "avulso") {
      return [{
        date: startDate,
        hour,
        minute,
        dayOfWeek: getISODay(startDate),
      }];
    }

    if (fixedDays.length === 0 || totalSessions <= 0) return [];

    const dates: GeneratedDate[] = [];
    const sortedDays = [...fixedDays].sort((a, b) => a - b);

    // Determine week increment based on frequency
    const weekIncrement = frequency === "quinzenal" ? 2 : frequency === "mensal" ? 4 : 1;

    let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 1 });
    const maxIterations = totalSessions * 10; // safety limit
    let iterations = 0;

    while (dates.length < totalSessions && iterations < maxIterations) {
      iterations++;

      for (const day of sortedDays) {
        if (dates.length >= totalSessions) break;

        const candidateDate = addDays(currentWeekStart, day - 1);

        // Skip dates before start date
        if (isBefore(candidateDate, startDate) && !isEqual(candidateDate, startDate)) {
          continue;
        }

        dates.push({
          date: candidateDate,
          hour,
          minute,
          dayOfWeek: day,
        });
      }

      currentWeekStart = addWeeks(currentWeekStart, weekIncrement);
    }

    return dates;
  }
}
