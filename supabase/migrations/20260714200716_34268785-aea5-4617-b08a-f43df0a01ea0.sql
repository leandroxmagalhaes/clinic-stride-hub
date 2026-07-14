ALTER TABLE public.sessoes
ADD COLUMN metodo_pagamento_previsto TEXT
CHECK (metodo_pagamento_previsto IS NULL OR metodo_pagamento_previsto IN ('numerario', 'mbway_transferencia'));