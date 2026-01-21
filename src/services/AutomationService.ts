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
   * Get mock metrics (for demo purposes)
   */
  static getMetrics(flows: AutomationFlow[]): {
    activeFlows: number;
    messagesSent: number;
    successRate: number;
  } {
    const activeFlows = flows.filter(f => f.is_active).length;
    // Mock data for messages sent and success rate
    const messagesSent = activeFlows * 127; // Simulated
    const successRate = 94.5; // Simulated

    return {
      activeFlows,
      messagesSent,
      successRate,
    };
  }
}
