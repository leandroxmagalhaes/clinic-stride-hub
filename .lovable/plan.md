

# Add new columns to sessoes table

## Migration
Add 7 new columns to `sessoes` for batch/pack scheduling metadata:

- `tipo_agendamento` (TEXT, NOT NULL, default 'avulso')
- `pack_grupo_id` (UUID, nullable)
- `valor_sessao` (NUMERIC(10,2), nullable)
- `valor_pack_total` (NUMERIC(10,2), nullable)
- `pagamento_estado` (TEXT, default 'pendente')
- `pagamento_metodo` (TEXT, nullable)
- `pagamento_data` (DATE, nullable)

No frontend changes. Only the database migration.

