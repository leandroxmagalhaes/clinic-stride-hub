import { supabase } from "@/integrations/supabase/client";
import { AuditService } from "@/services/AuditService";

/**
 * Permanently deletes a patient and all associated records.
 * Handles FK cascade manually to avoid constraint violations.
 */
export async function cascadeDeletePatient(patientId: string, patientName?: string) {
  // 1. Delete dependent records in parallel
  await Promise.all([
    supabase.from('session_briefings').delete().eq('patient_id', patientId),
    supabase.from('automation_logs').delete().eq('paciente_id', patientId),
    supabase.from('notifications').delete().eq('patient_id', patientId),
    supabase.from('patient_feedback').delete().eq('patient_id', patientId),
    supabase.from('patient_diary').delete().eq('patient_id', patientId),
    supabase.from('professional_patient_assignments').delete().eq('patient_id', patientId),
    supabase.from('credit_transactions').delete().eq('patient_id', patientId),
  ]);

  // 2. Evolutions
  await supabase.from('evolucoes').delete().eq('patient_id', patientId);

  // 3. Clinical evolutions via prontuarios
  const { data: prontuarios } = await supabase.from('prontuarios').select('id').eq('paciente_id', patientId);
  if (prontuarios && prontuarios.length > 0) {
    const prontuarioIds = prontuarios.map(p => p.id);
    await supabase.from('evolucoes_clinicas').delete().in('prontuario_id', prontuarioIds);
    await supabase.from('patient_documents').delete().eq('paciente_id', patientId);
    await supabase.from('prontuarios').delete().eq('paciente_id', patientId);
  }

  // 4. Sessions, packs, packages, reserved slots, reports, credits
  await Promise.all([
    supabase.from('sessoes').delete().eq('paciente_id', patientId),
    supabase.from('packs').delete().eq('paciente_id', patientId),
    supabase.from('scheduling_packages').delete().eq('paciente_id', patientId),
    supabase.from('horarios_reservados').delete().eq('patient_id', patientId),
    supabase.from('relatorios_clinicos').delete().eq('patient_id', patientId),
    supabase.from('transacoes_credito').delete().eq('patient_id', patientId),
  ]);

  // 5. Nullify lead and import_queue references
  await Promise.all([
    supabase.from('sales_leads').update({ converted_patient_id: null }).eq('converted_patient_id', patientId),
    supabase.from('import_queue').update({ suggested_patient_id: null }).eq('suggested_patient_id', patientId),
  ]);

  // 6. Audit log
  await AuditService.log({
    action: 'delete',
    entityType: 'patient',
    entityId: patientId,
    entityName: patientName || 'Desconhecido',
    details: { type: 'permanent_delete' },
  });

  // 7. Delete patient
  const { error } = await supabase.from('pacientes').delete().eq('id', patientId);
  if (error) throw error;
}
