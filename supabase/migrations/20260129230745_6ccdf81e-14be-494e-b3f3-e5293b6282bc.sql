-- Add idempotency trigger to prevent double credit usage for the same session
CREATE TRIGGER trigger_check_credit_usage_idempotency
  BEFORE INSERT ON public.transacoes_credito
  FOR EACH ROW
  EXECUTE FUNCTION public.check_credit_usage_idempotency_v2();