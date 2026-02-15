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
 * Process a message template by replacing variables with actual data
 */
/**
 * Get the production base URL for patient portal links
 */
export function getPortalBaseUrl(): string {
  // Use window.location.origin to get the current domain (works for both preview and production)
  if (typeof window !== 'undefined') {
    return getPublicBaseUrl();
  }
  // Fallback for SSR or edge cases
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
  // Clean phone number - remove all non-digits
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Add country code if not present (assume Portugal +351 or Brazil +55)
  let formattedPhone = cleanPhone;
  if (cleanPhone.length === 9) {
    // Portuguese mobile number
    formattedPhone = `351${cleanPhone}`;
  } else if (cleanPhone.length === 11 || cleanPhone.length === 10) {
    // Brazilian number
    formattedPhone = `55${cleanPhone}`;
  }
  
  // Encode message for URL
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
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('clinic_id')
    .eq('user_id', userData.user.id)
    .single();

  return profile?.clinic_id || null;
}

export interface AutomationTriggerResult {
  shouldTrigger: boolean;
  flow?: AutomationFlow;
  processedMessage?: string;
  whatsappUrl?: string;
  patientPhone?: string;
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
}): Promise<AutomationTriggerResult> {
  // Get active flows for appointment_created trigger
  const flows = await getActiveFlowsByTrigger('appointment_created');
  
  if (flows.length === 0) {
    return { shouldTrigger: false };
  }

  // Use the highest priority flow
  const flow = flows[0];
  
  // Check if patient has a phone number
  if (!data.patientPhone) {
    return { shouldTrigger: false };
  }

  // Get clinic name
  const clinicId = await getCurrentClinicId();
  const clinicName = clinicId ? await getClinicName(clinicId) : 'Clínica';

  // Format time
  const time = `${String(data.hour).padStart(2, '0')}:00`;

  // Process the message template
  const processedMessage = processMessageTemplate(flow.message_template, {
    patientName: data.patientName,
    patientPhone: data.patientPhone,
    date: data.date,
    time,
    professionalName: data.professionalName,
    serviceName: data.serviceName,
    clinicName,
  });

  // Generate WhatsApp URL
  const whatsappUrl = generateWhatsAppUrl(data.patientPhone, processedMessage);

  return {
    shouldTrigger: true,
    flow,
    processedMessage,
    whatsappUrl,
    patientPhone: data.patientPhone,
  };
}
