import { useState, useEffect, useCallback } from "react";
import { 
  ReservedSlotService, 
  ReservedSlot, 
  CreateReservedSlotData,
  UpdateReservedSlotData 
} from "@/services/ReservedSlotService";
import { format, addDays, endOfWeek } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface ReservedSlotOccurrence {
  date: string;
  time: string;
  reservation: ReservedSlot;
}

export function useReservedSlots() {
  const [reservedSlots, setReservedSlots] = useState<ReservedSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all reserved slots
  const fetchReservedSlots = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ReservedSlotService.fetchActive();
      setReservedSlots(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar reservas";
      setError(message);
      toast({ title: "Erro", description: message, variant: "destructive" });
      console.error("Error fetching reserved slots:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    fetchReservedSlots();
  }, [fetchReservedSlots]);

  // Create new reserved slot
  const createReservedSlot = useCallback(async (data: CreateReservedSlotData) => {
    try {
      const newSlot = await ReservedSlotService.create(data);
      setReservedSlots(prev => [newSlot, ...prev]);
      toast({ title: "Sucesso", description: "Horário reservado com sucesso!" });
      return newSlot;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar reserva";
      toast({ title: "Erro", description: message, variant: "destructive" });
      throw err;
    }
  }, []);

  // Update reserved slot
  const updateReservedSlot = useCallback(async (id: string, data: UpdateReservedSlotData) => {
    try {
      const updated = await ReservedSlotService.update(id, data);
      setReservedSlots(prev => prev.map(s => s.id === id ? updated : s));
      toast({ title: "Sucesso", description: "Reserva atualizada!" });
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar reserva";
      toast({ title: "Erro", description: message, variant: "destructive" });
      throw err;
    }
  }, []);

  // Cancel reserved slot
  const cancelReservedSlot = useCallback(async (id: string) => {
    try {
      await ReservedSlotService.cancel(id);
      setReservedSlots(prev => prev.filter(s => s.id !== id));
      toast({ title: "Sucesso", description: "Reserva cancelada!" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao cancelar reserva";
      toast({ title: "Erro", description: message, variant: "destructive" });
      throw err;
    }
  }, []);

  // Get occurrences for a specific week
  const getOccurrencesForWeek = useCallback((weekStart: Date): ReservedSlotOccurrence[] => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const occurrences: ReservedSlotOccurrence[] = [];

    for (const reservation of reservedSlots) {
      if (reservation.status !== 'ativo') continue;

      const reservationStart = new Date(reservation.data_inicio);
      const reservationEnd = reservation.data_fim ? new Date(reservation.data_fim) : null;

      // Check each day in the week
      for (let i = 0; i < 7; i++) {
        const currentDate = addDays(weekStart, i);
        
        // Skip if before reservation start
        if (currentDate < reservationStart) continue;
        // Skip if after reservation end
        if (reservationEnd && currentDate > reservationEnd) continue;

        const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay();
        const dateStr = format(currentDate, "yyyy-MM-dd");

        if (reservation.tipo === 'fixo' && reservation.dias_semana?.includes(dayOfWeek)) {
          occurrences.push({
            date: dateStr,
            time: reservation.horario_inicio,
            reservation,
          });
        } else if (reservation.tipo === 'personalizado' && reservation.horarios_personalizados) {
          for (const entry of reservation.horarios_personalizados) {
            if (entry.dia === dayOfWeek) {
              occurrences.push({
                date: dateStr,
                time: entry.hora,
                reservation,
              });
            }
          }
        }
      }
    }

    return occurrences;
  }, [reservedSlots]);

  // Get occurrences for a specific date
  const getOccurrencesForDate = useCallback((date: Date): ReservedSlotOccurrence[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    const occurrences: ReservedSlotOccurrence[] = [];

    for (const reservation of reservedSlots) {
      if (reservation.status !== 'ativo') continue;

      const reservationStart = new Date(reservation.data_inicio);
      const reservationEnd = reservation.data_fim ? new Date(reservation.data_fim) : null;

      // Skip if outside reservation period
      if (date < reservationStart) continue;
      if (reservationEnd && date > reservationEnd) continue;

      if (reservation.tipo === 'fixo' && reservation.dias_semana?.includes(dayOfWeek)) {
        occurrences.push({
          date: dateStr,
          time: reservation.horario_inicio,
          reservation,
        });
      } else if (reservation.tipo === 'personalizado' && reservation.horarios_personalizados) {
        for (const entry of reservation.horarios_personalizados) {
          if (entry.dia === dayOfWeek) {
            occurrences.push({
              date: dateStr,
              time: entry.hora,
              reservation,
            });
          }
        }
      }
    }

    return occurrences;
  }, [reservedSlots]);

  // Check if a specific slot is reserved
  const isSlotReserved = useCallback((date: Date, hour: number): ReservedSlot | null => {
    const occurrences = getOccurrencesForDate(date);
    const hourStr = `${String(hour).padStart(2, '0')}:00:00`;
    
    for (const occ of occurrences) {
      // Compare just the hour part
      const occHour = parseInt(occ.time.split(':')[0], 10);
      if (occHour === hour) {
        return occ.reservation;
      }
    }
    
    return null;
  }, [getOccurrencesForDate]);

  return {
    reservedSlots,
    isLoading,
    error,
    fetchReservedSlots,
    createReservedSlot,
    updateReservedSlot,
    cancelReservedSlot,
    getOccurrencesForWeek,
    getOccurrencesForDate,
    isSlotReserved,
  };
}
