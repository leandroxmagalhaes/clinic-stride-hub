ALTER TABLE public.automation_flows DROP CONSTRAINT automation_flows_trigger_type_check;
ALTER TABLE public.automation_flows ADD CONSTRAINT automation_flows_trigger_type_check
  CHECK (trigger_type = ANY (ARRAY[
    'appointment_created','24h_before','post_consultation','birthday','inactive_30_days',
    'portal_link_enviado','lembrete_portal_expiracao'
  ]));