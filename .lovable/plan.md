## Recuperação do Questionário do Tomás Marques — Passo (a)

### Objetivo
Re-associar o questionário `9c63cb7e-ef0d-4b29-86ab-ca8bcf1a0026` ao Tomás Marques real (`b922fa2d-55c7-49d8-ad20-99d071ee59c1`), preservando 100% dos dados clínicos já preenchidos pela mãe.

### Estado atual confirmado por SELECT

| Campo | Valor atual | Após UPDATE |
|---|---|---|
| `id` | `9c63cb7e-ef0d-4b29-86ab-ca8bcf1a0026` | inalterado |
| `paciente_id` | `a2916d80-2cb0-43c6-8440-151e5b4c4a6e` (fantasma) | `b922fa2d-55c7-49d8-ad20-99d071ee59c1` (Tomás real) |
| `template_id` | `f6833e55…` (baby_complete) | inalterado |
| `perfil_tipo` | `template_baby_complete` | inalterado |
| `respostas` | secções `parto` + `desenvolvimento` preenchidas | inalterado |
| `dados_pessoais`, `perfil_saude`, `expectativas` | — | inalterados |
| `completo` | `false` (rascunho) | inalterado |
| `created_at` | 2026-04-27 23:41:59 | inalterado |
| `updated_at` | 2026-04-27 23:42:08 | `now()` |

Confirmado também que o Tomás real **não tem** ainda nenhum questionário próprio, portanto o UPDATE não colide com nada.

### Execução — UPDATE único e seletivo

```sql
UPDATE public.portal_questionario
SET paciente_id = 'b922fa2d-55c7-49d8-ad20-99d071ee59c1',
    updated_at  = now()
WHERE id = '9c63cb7e-ef0d-4b29-86ab-ca8bcf1a0026'
  AND paciente_id = 'a2916d80-2cb0-43c6-8440-151e5b4c4a6e';
```

Filtro duplo (`id` + `paciente_id` antigo) garante que só toca neste registo. Sem `DELETE`, sem `TRUNCATE`, sem `ALTER`, sem alterações a `auth.*`, sem alterações a outros pacientes nem ao paciente fantasma.

### O que NÃO vai ser feito neste passo

- **(b) Convite portal:** não é gerado pelo agente. Vais gerá-lo manualmente pela ficha do Tomás real depois de validar (a). O Smart Invite Binding já está no código e fará a associação quando a mãe abrir o link com `sheilaclaudine@hotmail.com`.
- **(c) Paciente fantasma `a2916d80`:** confirmado que **NÃO existe** na tabela `pacientes` (já é órfão puro — só vivia através do questionário e da conta portal). Logo não há `is_active` para marcar — fica como está. A vulnerabilidade que permitiu criar convite/conta para um `paciente_id` inexistente fica anotada para corrigir num prompt seguinte.
- Não toco no registo duplicado "Tomas Guedes Marques" (`b96124f8…`) — é outro paciente, fora deste âmbito.

### Validação pós-execução (vou reportar ponto a ponto)

- [ ] `SELECT` ao questionário mostra `paciente_id = b922fa2d…` e todos os outros campos intactos.
- [ ] Tomás real (`b922fa2d…`) passa a ter o questionário associado na Anamnese.
- [ ] `respostas.parto` e `respostas.desenvolvimento` continuam visíveis.
- [ ] Paciente fantasma `a2916d80…` deixa de ter qualquer questionário associado.
- [ ] Outros pacientes (Bernardo, Luiza, Tomas Guedes Marques) não foram tocados — query de verificação.

### Ficheiros tocados

- Nenhum ficheiro de código.
- Apenas 1 UPDATE seletivo em `public.portal_questionario` (1 linha afetada).
