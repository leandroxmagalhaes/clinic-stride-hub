-- Garante que a coluna payment_method existe na tabela sessoes.
-- O frontend e o Copiloto gravam o método de pagamento (numerario, mbway,
-- multibanco, transferencia, cartao). Sem esta coluna, o método era ignorado.
ALTER TABLE public.sessoes
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL;
