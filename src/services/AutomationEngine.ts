import { supabase } from "@/integrations/supabase/client";
import { getPublicBaseUrl } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AutomationFlow } from "./AutomationService";

export interface MessageTemplateData {
  patientName: string;
  patientPhone?: string;
  date: Date;
  time: string;
  professionalName: string;
  serviceName?: string;
  clinicName: string;
}

/**
 * Get the production base URL for patient portal links
 */
export function getPortalBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return getPublicBaseUrl();
  }
  return 'https://clinic-stride-hub.lovable.app';
}

/**
 * Process a message template by replacing variables with actual data
 */
export function processMessageTemplate(template: string, data: MessageTemplateData): string {
  const formattedDate = format(data.date, "dd/MM/yyyy", { locale: ptBR });
  const portalLink = `${getPortalBaseUrl()}/patient-portal`;
  
  return template
    .replace(/\{\{patient_name\}\}/gi, data.patientName)
    .replace(/\{\{date\}\}/gi, formattedDate)
    .replace(/\{\{time\}\}/gi, data.time)
    .replace(/\{\{professional\}\}/gi, data.professionalName)
    .replace(/\{\{professional_name\}\}/gi, data.professionalName)
    .replace(/\{\{service\}\}/gi, data.serviceName || '')
    .replace(/\{\{clinic_name\}\}/gi, data.clinicName)
    .replace(/\{\{portal_link\}\}/gi, portalLink)
    .replace(/\[LINK\]/gi, portalLink);
}

/**
 * Generate WhatsApp Web URL for sending message
 */
export function generateWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  
  let formattedPhone = cleanPhone;
  if (cleanPhone.length === 9) {
    formattedPhone = `351${cleanPhone}`;
  } else if (cleanPhone.length === 11 || cleanPhone.length === 10) {
    formattedPhone = `55${cleanPhone}`;
  }
  
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

/**
 * Check for active automation flows matching a trigger type
 */
export async function getActiveFlowsByTrigger(
  triggerType: AutomationFlow['trigger_type']
): Promise<AutomationFlow[]> {
  const { data, error } = await supabase
    .from('automation_flows')
    .select('*')
    .eq('trigger_type', triggerType)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (error) {
    console.error('Error fetching automation flows:', error);
    return [];
  }

  return (data || []) as AutomationFlow[];
}

/**
 * Fetch clinic name by clinic_id
 */
export async function getClinicName(clinicId: string): Promise<string> {
  const { data, error } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', clinicId)
    .single();

  if (error) {
    console.error('Error fetching clinic name:', error);
    return 'Clínica';
  }

  return data?.name || 'Clínica';
}

/**
 * Fetch clinic_id for current user
 */
export async function getCurrentClinicId(): Promise<string | null> {
  const { getAuthContext } = await import("@/lib/auth-helpers");
  try {
    const { clinicId } = await getAuthContext();
    return clinicId;
  } catch {
    return null;
  }
}

export interface AutomationTriggerResult {
  shouldTrigger: boolean;
  flow?: AutomationFlow;
  processedMessage?: string;
  whatsappUrl?: string;
  patientPhone?: string;
}

/**
 * Invoke the send-automation-email edge function for a given flow
 */
async function invokeEmailForFlow(
  flow: AutomationFlow,
  pacienteId: string,
  clinicId: string,
  sessaoId?: string
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-automation-email', {
      body: {
        flowId: flow.id,
        pacienteId,
        sessaoId: sessaoId || null,
        triggerType: flow.trigger_type,
        clinicId,
      },
    });
    if (error) {
      console.error(`Automation email error for flow ${flow.name}:`, error);
    }
  } catch (err) {
    console.error(`Failed to invoke send-automation-email for flow ${flow.name}:`, err);
  }
}

/**
 * Process all active email flows for a given trigger type
 */
async function processEmailFlowsForTrigger(
  triggerType: AutomationFlow['trigger_type'],
  pacienteId: string,
  clinicId: string,
  sessaoId?: string
): Promise<void> {
  const flows = await getActiveFlowsByTrigger(triggerType);
  
  for (const flow of flows) {
    if (flow.channel === 'email') {
      await invokeEmailForFlow(flow, pacienteId, clinicId, sessaoId);
    }
  }
}

/**
 * Check and prepare automation trigger for appointment creation
 */
export async function checkAppointmentCreatedTrigger(data: {
  patientName: string;
  patientPhone?: string;
  professionalName: string;
  serviceName?: string;
  date: Date;
  hour: number;
  sessaoId?: string;
  pacienteId?: string;
  clinicId?: string;
}): Promise<AutomationTriggerResult> {
  // Process email flows in the background
  if (data.pacienteId && data.clinicId) {
    processEmailFlowsForTrigger('appointment_created', data.pacienteId, data.clinicId, data.sessaoId)
      .catch(err => console.error('Background email trigger error:', err));
  }

  // Keep existing WhatsApp flow logic
  const flows = await getActiveFlowsByTrigger('appointment_created');
  const whatsappFlow = flows.find(f => f.channel === 'whatsapp');
  
  if (!whatsappFlow || !data.patientPhone) {
    return { shouldTrigger: false };
  }

  const clinicId = data.clinicId || await getCurrentClinicId();
  const clinicName = clinicId ? await getClinicName(clinicId) : 'Clínica';

  const time = `${String(data.hour).padStart(2, '0')}:00`;

  const processedMessage = processMessageTemplate(whatsappFlow.message_template, {
    patientName: data.patientName,
    patientPhone: data.patientPhone,
    date: data.date,
    time,
    professionalName: data.professionalName,
    serviceName: data.serviceName,
    clinicName,
  });

  const whatsappUrl = generateWhatsAppUrl(data.patientPhone, processedMessage);

  return {
    shouldTrigger: true,
    flow: whatsappFlow,
    processedMessage,
    whatsappUrl,
    patientPhone: data.patientPhone,
  };
}

/**
 * Trigger: 24h before appointment
 */
export async function check24hBeforeTrigger(
  sessaoId: string,
  pacienteId: string,
  clinicId: string
): Promise<void> {
  await processEmailFlowsForTrigger('24h_before', pacienteId, clinicId, sessaoId);
}

/**
 * Trigger: Post consultation (session marked as realizado)
 */
export async function checkPostConsultationTrigger(
  sessaoId: string,
  pacienteId: string,
  clinicId: string
): Promise<void> {
  await processEmailFlowsForTrigger('post_consultation', pacienteId, clinicId, sessaoId);
}

/**
 * Trigger: Patient birthday
 */
export async function checkBirthdayTrigger(
  pacienteId: string,
  clinicId: string
): Promise<void> {
  await processEmailFlowsForTrigger('birthday', pacienteId, clinicId);
}

/**
 * Trigger: Patient inactive for 30 days
 */
export async function checkInactive30DaysTrigger(
  pacienteId: string,
  clinicId: string
): Promise<void> {
  await processEmailFlowsForTrigger('inactive_30_days', pacienteId, clinicId);
}
