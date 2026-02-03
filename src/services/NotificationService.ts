import { supabase } from "@/integrations/supabase/client";
import { EngagementService } from "./EngagementService";

export type NotificationType = 
  | 'birthday' 
  | 'report_expired' 
  | 'report_expiring' 
  | 'sessions_today'
  | 'inactive_patient';

export type NotificationPriority = 'high' | 'medium' | 'low';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  link?: string;
  createdAt: Date;
  count?: number;
}

export class NotificationService {
  /**
   * Get all notifications aggregated from multiple sources
   */
  static async getNotifications(): Promise<AppNotification[]> {
    const notifications: AppNotification[] = [];

    const [birthdays, reports, sessions, inactive] = await Promise.all([
      this.getBirthdayNotifications(),
      this.getReportAlerts(),
      this.getTodaySessions(),
      this.getInactivePatientNotifications()
    ]);

    notifications.push(...birthdays, ...reports, ...sessions, ...inactive);

    // Sort by priority (high first) then by date
    return notifications.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  /**
   * Get birthday notifications for today
   */
  static async getBirthdayNotifications(): Promise<AppNotification[]> {
    try {
      const birthdayPatients = await EngagementService.getBirthdayPatients();
      const today = new Date().getDate();
      
      const todayBirthdays = birthdayPatients.filter(p => p.day === today);
      
      if (todayBirthdays.length === 0) return [];

      return [{
        id: 'birthdays-today',
        type: 'birthday',
        title: 'Aniversários Hoje',
        message: todayBirthdays.length === 1 
          ? `${todayBirthdays[0].full_name} faz anos hoje!`
          : `${todayBirthdays.length} pacientes fazem anos hoje`,
        priority: 'high',
        link: '/engajamento',
        createdAt: new Date(),
        count: todayBirthdays.length
      }];
    } catch (error) {
      console.error('Error fetching birthday notifications:', error);
      return [];
    }
  }

  /**
   * Get report deadline alerts (expired and expiring soon)
   */
  static async getReportAlerts(): Promise<AppNotification[]> {
    try {
      const today = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(today.getDate() + 7);

      const { data: reports, error } = await supabase
        .from('relatorios_clinicos')
        .select('id, titulo, data_validade, status')
        .not('data_validade', 'is', null)
        .in('status', ['rascunho', 'finalizado', 'enviado']);

      if (error) {
        console.error('Error fetching reports:', error);
        return [];
      }

      const notifications: AppNotification[] = [];

      const expired = (reports || []).filter(r => 
        r.data_validade && new Date(r.data_validade) < today
      );

      const expiringSoon = (reports || []).filter(r => {
        if (!r.data_validade) return false;
        const expDate = new Date(r.data_validade);
        return expDate >= today && expDate <= sevenDaysFromNow;
      });

      if (expired.length > 0) {
        notifications.push({
          id: 'reports-expired',
          type: 'report_expired',
          title: 'Relatórios Vencidos',
          message: expired.length === 1
            ? `1 relatório com prazo vencido`
            : `${expired.length} relatórios com prazo vencido`,
          priority: 'high',
          link: '/prontuarios',
          createdAt: new Date(),
          count: expired.length
        });
      }

      if (expiringSoon.length > 0) {
        notifications.push({
          id: 'reports-expiring',
          type: 'report_expiring',
          title: 'Relatórios a Vencer',
          message: expiringSoon.length === 1
            ? `1 relatório vence em breve`
            : `${expiringSoon.length} relatórios vencem em 7 dias`,
          priority: 'medium',
          link: '/prontuarios',
          createdAt: new Date(),
          count: expiringSoon.length
        });
      }

      return notifications;
    } catch (error) {
      console.error('Error fetching report alerts:', error);
      return [];
    }
  }

  /**
   * Get today's sessions summary
   */
  static async getTodaySessions(): Promise<AppNotification[]> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const { data: sessions, error } = await supabase
        .from('sessoes')
        .select('id, status')
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .not('status', 'in', '("cancelado","faltou")');

      if (error) {
        console.error('Error fetching sessions:', error);
        return [];
      }

      if (!sessions || sessions.length === 0) return [];

      const confirmed = sessions.filter(s => s.status === 'confirmado').length;
      const pending = sessions.filter(s => s.status === 'agendado').length;

      return [{
        id: 'sessions-today',
        type: 'sessions_today',
        title: 'Agenda de Hoje',
        message: `${sessions.length} sessões • ${confirmed} confirmadas, ${pending} pendentes`,
        priority: 'low',
        link: '/agenda',
        createdAt: new Date(),
        count: sessions.length
      }];
    } catch (error) {
      console.error('Error fetching today sessions:', error);
      return [];
    }
  }

  /**
   * Get inactive patient notifications (churn risk)
   */
  static async getInactivePatientNotifications(): Promise<AppNotification[]> {
    try {
      const churnRisk = await EngagementService.getChurnRiskPatients();
      
      if (churnRisk.length === 0) return [];

      // Only show if there are 3+ inactive patients to avoid noise
      if (churnRisk.length < 3) return [];

      return [{
        id: 'inactive-patients',
        type: 'inactive_patient',
        title: 'Pacientes Inativos',
        message: `${churnRisk.length} pacientes sem sessões há 30+ dias`,
        priority: 'medium',
        link: '/engajamento',
        createdAt: new Date(),
        count: churnRisk.length
      }];
    } catch (error) {
      console.error('Error fetching inactive patients:', error);
      return [];
    }
  }

  /**
   * Get count of high priority notifications (for badge)
   */
  static getHighPriorityCount(notifications: AppNotification[]): number {
    return notifications.filter(n => n.priority === 'high').length;
  }
}
