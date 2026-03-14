import { supabase } from "@/integrations/supabase/client";

export interface AutomationFlow {
  id: string;
  clinic_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  trigger_type: 'appointment_created' | '24h_before' | 'post_consultation' | 'birthday' | 'inactive_30_days';
  channel: 'whatsapp' | 'sms' | 'email';
  message_template: string;
  attachment_url: string | null;
  is_active: boolean;
  priority: number;
}

export type TriggerType = AutomationFlow['trigger_type'];

export const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'appointment_created', label: 'Ao criar agendamento' },
  { value: '24h_before', label: '24h antes do agendamento' },
  { value: 'post_consultation', label: 'Após finalizar atendimento (NPS)' },
  { value: 'birthday', label: 'Aniversariante do dia' },
  { value: 'inactive_30_days', label: 'Paciente inativo (30 dias)' },
];

export const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'E-mail' },
];

export const MESSAGE_VARIABLES = [
  { key: '{{patient_name}}', label: 'Nome Paciente' },
  { key: '{{date}}', label: 'Data' },
  { key: '{{time}}', label: 'Horário' },
  { key: '{{professional}}', label: 'Profissional' },
  { key: '{{service}}', label: 'Serviço' },
  { key: '{{clinic_name}}', label: 'Nome Clínica' },
];

export class AutomationService {
  /**
   * Get all automation flows for the clinic
   */
  static async getFlows(): Promise<AutomationFlow[]> {
    const { data, error } = await supabase
      .from('automation_flows')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching automation flows:', error);
      return [];
    }

    return (data || []) as AutomationFlow[];
  }

  /**
   * Create a new automation flow
   */
  static async createFlow(
    clinicId: string,
    data: Omit<AutomationFlow, 'id' | 'clinic_id' | 'created_at' | 'updated_at'>
  ): Promise<AutomationFlow | null> {
    const { data: flow, error } = await supabase
      .from('automation_flows')
      .insert({
        clinic_id: clinicId,
        name: data.name,
        trigger_type: data.trigger_type,
        channel: data.channel,
        message_template: data.message_template,
        attachment_url: data.attachment_url,
        is_active: data.is_active,
        priority: data.priority,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating automation flow:', error);
      return null;
    }

    return flow as AutomationFlow;
  }

  /**
   * Update an automation flow
   */
  static async updateFlow(
    id: string,
    data: Partial<Omit<AutomationFlow, 'id' | 'clinic_id' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> {
    const { error } = await supabase
      .from('automation_flows')
      .update(data)
      .eq('id', id);

    if (error) {
      console.error('Error updating automation flow:', error);
      return false;
    }

    return true;
  }

  /**
   * Toggle flow active status
   */
  static async toggleFlowStatus(id: string, isActive: boolean): Promise<boolean> {
    return this.updateFlow(id, { is_active: isActive });
  }

  /**
   * Delete an automation flow
   */
  static async deleteFlow(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('automation_flows')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting automation flow:', error);
      return false;
    }

    return true;
  }

  /**
   * Get trigger label by type
   */
  static getTriggerLabel(triggerType: TriggerType): string {
    return TRIGGER_OPTIONS.find(t => t.value === triggerType)?.label || triggerType;
  }

  /**
   * Get real metrics from automation_logs and automation_flows
   */
  static async getMetrics(clinicId?: string): Promise<{
    activeFlows: number;
    messagesSent: number;
    successRate: number;
  }> {
    try {
      // Count active flows
      const { count: activeCount } = await supabase
        .from('automation_flows')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Count total logs and sent logs
      let logsQuery = (supabase as any).from('automation_logs').select('*', { count: 'exact', head: true });
      let sentQuery = (supabase as any).from('automation_logs').select('*', { count: 'exact', head: true }).eq('status', 'sent');

      const [{ count: totalLogs }, { count: sentLogs }] = await Promise.all([logsQuery, sentQuery]);

      const messagesSent = totalLogs || 0;
      const successRate = messagesSent > 0 ? Math.round(((sentLogs || 0) / messagesSent) * 100) : 0;

      return {
        activeFlows: activeCount || 0,
        messagesSent,
        successRate: messagesSent === 0 ? 100 : successRate,
      };
    } catch (err) {
      console.error('Error fetching automation metrics:', err);
      return { activeFlows: 0, messagesSent: 0, successRate: 0 };
    }
  }

  /**
   * Legacy sync metrics for components that pass flows array
   */
  static getMetricsSync(flows: AutomationFlow[]): {
    activeFlows: number;
    messagesSent: number;
    successRate: number;
  } {
    return {
      activeFlows: flows.filter(f => f.is_active).length,
      messagesSent: 0,
      successRate: 0,
    };
  }
}
