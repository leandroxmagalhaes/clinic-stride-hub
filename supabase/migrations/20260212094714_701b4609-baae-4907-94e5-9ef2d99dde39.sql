ALTER TABLE sessoes DROP CONSTRAINT IF EXISTS sessoes_payment_status_check;
ALTER TABLE sessoes ADD CONSTRAINT sessoes_payment_status_check 
  CHECK (payment_status = ANY (ARRAY['pendente','pago','parcial','cancelado','reservado']));