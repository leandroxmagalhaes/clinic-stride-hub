## Sistema de Templates de Questionário (4 perfis)

### Resumo
Substitui o questionário hardcoded actual no `PortalOnboarding` por um sistema de templates configuráveis. A Camila escolhe o template ao gerar o link do portal, e o paciente preenche apenas o questionário escolhido.

### Garantia de proteção de dados
- ✅ Tabela `portal_questionario` actual **mantida intacta** (todos os 85+ campos JSONB existentes preservados)
- ✅ **Nenhum** `DROP`, `TRUNCATE`, `DELETE`, `ALTER COLUMN`
- ✅ Nova tabela `portal_questionario_templates` é separada
- ✅ Adiciona apenas 1 coluna nova opcional em `portal_convites` (`template_id`, nullable)
- ✅ Convites antigos sem `template_id` continuam a funcionar (fallback = detecção automática por idade actual)

---

### Step 1 — Migração de schema (apenas ADIÇÃO)

**Nova tabela `portal_questionario_templates`:**
```sql
CREATE TABLE public.portal_questionario_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  identifier text NOT NULL,           -- 'template_baby_complete', 'template_child', etc.
  name text NOT NULL,                  -- "Boas-Vindas Bebé (0-2 anos)"
  description text,
  estimated_minutes text,              -- "20-30 min"
  schema jsonb NOT NULL,               -- secções + campos
  is_active boolean DEFAULT true,
  is_system boolean DEFAULT false,     -- protege os 4 templates iniciais de eliminação
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, identifier)
);
ALTER TABLE public.portal_questionario_templates ENABLE ROW LEVEL SECURITY;
-- Policies: SELECT público (templates visíveis a todos); UPDATE/DELETE apenas para profissionais da clínica
```

**Coluna nova em `portal_convites` (opcional, nullable):**
```sql
ALTER TABLE public.portal_convites ADD COLUMN template_id uuid REFERENCES public.portal_questionario_templates(id);
```

**Coluna nova em `portal_questionario` (opcional, nullable) para rastrear qual template foi usado:**
```sql
ALTER TABLE public.portal_questionario ADD COLUMN template_id uuid REFERENCES public.portal_questionario_templates(id);
ALTER TABLE public.portal_questionario ADD COLUMN respostas jsonb DEFAULT '{}'::jsonb;
```
> **Importante:** colunas existentes `dados_pessoais`, `perfil_saude`, `expectativas`, `perfil_tipo`, `completo` **mantidas como estão**. A coluna nova `respostas` é usada apenas para questionários novos baseados em template (formato `{ section_id: { field_key: value } }`). Os dados antigos continuam a ser lidos pelo código actual.

### Step 2 — Inserir os 4 templates iniciais (`is_system = true`)
Inserir via tool de inserção:
- `template_baby_complete` — 15 secções, ~85 campos (estrutura já documentada)
- `template_child` — 8 secções, ~40 campos
- `template_adult` — 7 secções, ~45 campos
- `template_elderly` — 8 secções, ~55 campos

Schema JSONB de cada template segue formato:
```json
{
  "sections": [
    {
      "id": "identification",
      "title": "Identificação",
      "fields": [
        { "key": "full_name", "label": "Nome completo", "type": "text", "required": true },
        { "key": "birth_date", "label": "Data de nascimento", "type": "date", "required": true },
        { "key": "gender", "label": "Sexo", "type": "select", "options": ["Masculino","Feminino","Outro"], "required": true },
        ...
      ]
    },
    ...
  ]
}
```
Tipos de campo suportados: `text`, `textarea`, `date`, `select`, `multiselect`, `slider` (0-10), `checkbox`.

### Step 3 — `PatientPortalTab.tsx` — selector de template ao gerar convite
- Carregar templates activos ao abrir a aba.
- Adicionar dropdown "Questionário a enviar" antes do botão "Gerar convite" (default: detecção automática por idade actual do paciente).
- `handleGenerateInvite` envia `template_id` no body para a edge function.
- Edge function `generate-portal-invite` grava `template_id` na nova coluna de `portal_convites`.

### Step 4 — Renderer dinâmico no portal do paciente
- Criar `src/components/patient-portal/DynamicQuestionnaireRenderer.tsx`:
  - Recebe `schema` JSONB + `respostas` actuais.
  - Renderiza secções e campos dinamicamente conforme tipo (`text`, `select`, `slider`, etc.).
  - Validação de campos `required`.
- `PortalOnboarding.tsx`:
  - Ao carregar, lê `template_id` do convite (`portal_convites`).
  - Se `template_id` existir → renderiza `<DynamicQuestionnaireRenderer />` com o schema do template.
  - Se `template_id` não existir (convites antigos) → mantém o fluxo actual com `BabyProfile/ChildProfile/AdultProfile/ElderlyProfile` (compatibilidade total).
  - Ao guardar, escreve em `portal_questionario.respostas` + `template_id`.

### Step 5 — Visualização para a profissional
- `PatientPortalTab.tsx` (secção "Ver questionário preenchido"):
  - Se `template_id` existir → renderizar `respostas` segundo schema do template (label + valor por secção).
  - Caso contrário → manter visualização actual (`dados_pessoais`, `perfil_saude`, `expectativas`).

---

### Ficheiros alterados / criados

| Ação | Ficheiro |
|------|----------|
| Migração SQL | nova tabela `portal_questionario_templates` + 3 colunas novas (todas nullable) |
| Insert dados | 4 templates iniciais via insert tool |
| Modificado | `src/components/patients/PatientPortalTab.tsx` (dropdown + visualização) |
| Modificado | `supabase/functions/generate-portal-invite/index.ts` (recebe `template_id`) |
| Modificado | `src/pages/PortalOnboarding.tsx` (renderer dinâmico com fallback) |
| Criado | `src/components/patient-portal/DynamicQuestionnaireRenderer.tsx` |
| Criado | `src/services/QuestionnaireTemplateService.ts` |

### O que NÃO muda
- ❌ Nenhum `DROP`, `TRUNCATE`, `DELETE`
- ❌ Nenhuma alteração a colunas existentes
- ❌ Nenhum questionário já preenchido é apagado ou modificado
- ✅ Convites antigos sem `template_id` continuam a usar o fluxo actual (fallback)
- ✅ Dados antigos continuam visíveis e editáveis no formato actual
