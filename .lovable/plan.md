

# Adicionar Especialidades: Fisioterapia Motora e Reabilitação Vestibular

## O que será feito

Inserir 2 novos templates de especialidade na tabela `specialty_templates` com formulários dinâmicos completos para evoluções clínicas.

---

## 1. Fisioterapia Motora

**Descrição**: Avaliação musculoesquelética com foco em ADM, força, funcionalidade e dor

### Secções do formulário:

| Secção | Campo | Tipo | Opções |
|--------|-------|------|--------|
| **Avaliação de ADM e Força** | Amplitude de Movimento | Select | Normal, Limitada Leve, Limitada Moderada, Limitada Grave |
| | Região Afetada | Multiselect | Ombro, Cotovelo, Punho, Quadril, Joelho, Tornozelo, Coluna Cervical, Coluna Lombar |
| | Força Muscular (0-5) | Range | min: 0, max: 5 |
| | Tônus Muscular | Select | Normal, Hipotonia, Hipertonia, Espasticidade |
| **Dor e Pontos Gatilho** | Escala de Dor (EVA) | Range | min: 0, max: 10 |
| | Localização da Dor | Tags | Cervical, Dorsal, Lombar, Sacral, MMSS, MMII |
| | Pontos de Tensão | Multiselect | Trapézio, Romboides, Paravertebrais, Piriforme, Quadrado Lombar, ITB |
| **Avaliação Funcional** | Marcha | Select | Normal, Claudicante, Com Auxílio, Não Deambula |
| | Equilíbrio | Select | Normal, Alterado Leve, Alterado Moderado, Alterado Grave |
| | AVDs | Multiselect | Independente, Auxílio Parcial, Dependente |

---

## 2. Reabilitação Vestibular

**Descrição**: Avaliação e tratamento de distúrbios do equilíbrio e tontura

### Secções do formulário:

| Secção | Campo | Tipo | Opções |
|--------|-------|------|--------|
| **Sintomas e Tontura** | Tipo de Tontura | Select | Rotatória (Vertigem), Flutuação, Desequilíbrio, Pré-síncope |
| | Intensidade (0-10) | Range | min: 0, max: 10 |
| | Sintomas Associados | Multiselect | Náuseas, Vômitos, Cefaleia, Zumbido, Hipoacusia, Fotofobia |
| | Gatilhos | Tags | Mudança Posição, Movimento Cabeça, Ambientes Visuais, Estresse |
| **Testes Clínicos** | Dix-Hallpike | Select | Negativo, Positivo D, Positivo E, Positivo Bilateral |
| | Head Impulse Test | Select | Normal, Sacada D, Sacada E |
| | Romberg | Select | Negativo, Positivo |
| | Fukuda | Select | Normal, Desvio D, Desvio E |
| | Nistagmo | Multiselect | Ausente, Espontâneo, Posicional, Evocado |
| **Avaliação Funcional** | Escala DHI (0-100) | Range | min: 0, max: 100 |
| | Risco de Quedas | Select | Baixo, Moderado, Alto |
| | Limitação AVDs | Tags | Conduzir, Ler, Caminhar, Trabalhar, Atividades Domésticas |

---

## Implementação Técnica

### Migration SQL necessária

```sql
INSERT INTO public.specialty_templates (clinic_id, name, description, schema) VALUES

-- Fisioterapia Motora
(NULL, 'Fisioterapia Motora', 
 'Avaliação musculoesquelética com foco em ADM, força, funcionalidade e dor',
 '[
   {
     "section": "Avaliação de ADM e Força",
     "fields": [
       {"key": "adm", "label": "Amplitude de Movimento", "type": "select", 
        "options": ["Normal", "Limitada Leve", "Limitada Moderada", "Limitada Grave"]},
       {"key": "regiao_afetada", "label": "Região Afetada", "type": "multiselect", 
        "options": ["Ombro", "Cotovelo", "Punho", "Quadril", "Joelho", "Tornozelo", "Coluna Cervical", "Coluna Lombar"]},
       {"key": "forca_muscular", "label": "Força Muscular (0-5)", "type": "range", "min": 0, "max": 5},
       {"key": "tonus", "label": "Tônus Muscular", "type": "select", 
        "options": ["Normal", "Hipotonia", "Hipertonia", "Espasticidade"]}
     ]
   },
   {
     "section": "Dor e Pontos Gatilho",
     "fields": [
       {"key": "eva", "label": "Escala de Dor (EVA)", "type": "range", "min": 0, "max": 10},
       {"key": "localizacao_dor", "label": "Localização da Dor", "type": "tags", 
        "options": ["Cervical", "Dorsal", "Lombar", "Sacral", "MMSS", "MMII"]},
       {"key": "pontos_tensao", "label": "Pontos de Tensão", "type": "multiselect", 
        "options": ["Trapézio", "Romboides", "Paravertebrais", "Piriforme", "Quadrado Lombar", "ITB"]}
     ]
   },
   {
     "section": "Avaliação Funcional",
     "fields": [
       {"key": "marcha", "label": "Marcha", "type": "select", 
        "options": ["Normal", "Claudicante", "Com Auxílio", "Não Deambula"]},
       {"key": "equilibrio", "label": "Equilíbrio", "type": "select", 
        "options": ["Normal", "Alterado Leve", "Alterado Moderado", "Alterado Grave"]},
       {"key": "avds", "label": "AVDs", "type": "multiselect", 
        "options": ["Independente", "Auxílio Parcial", "Dependente"]}
     ]
   }
 ]'::jsonb),

-- Reabilitação Vestibular
(NULL, 'Reabilitação Vestibular', 
 'Avaliação e tratamento de distúrbios do equilíbrio e tontura',
 '[
   {
     "section": "Sintomas e Tontura",
     "fields": [
       {"key": "tipo_tontura", "label": "Tipo de Tontura", "type": "select", 
        "options": ["Rotatória (Vertigem)", "Flutuação", "Desequilíbrio", "Pré-síncope"]},
       {"key": "intensidade", "label": "Intensidade (0-10)", "type": "range", "min": 0, "max": 10},
       {"key": "sintomas_associados", "label": "Sintomas Associados", "type": "multiselect", 
        "options": ["Náuseas", "Vômitos", "Cefaleia", "Zumbido", "Hipoacusia", "Fotofobia"]},
       {"key": "gatilhos", "label": "Gatilhos", "type": "tags", 
        "options": ["Mudança Posição", "Movimento Cabeça", "Ambientes Visuais", "Estresse"]}
     ]
   },
   {
     "section": "Testes Clínicos",
     "fields": [
       {"key": "dix_hallpike", "label": "Dix-Hallpike", "type": "select", 
        "options": ["Negativo", "Positivo D", "Positivo E", "Positivo Bilateral"]},
       {"key": "head_impulse", "label": "Head Impulse Test", "type": "select", 
        "options": ["Normal", "Sacada D", "Sacada E"]},
       {"key": "romberg", "label": "Romberg", "type": "select", 
        "options": ["Negativo", "Positivo"]},
       {"key": "fukuda", "label": "Fukuda", "type": "select", 
        "options": ["Normal", "Desvio D", "Desvio E"]},
       {"key": "nistagmo", "label": "Nistagmo", "type": "multiselect", 
        "options": ["Ausente", "Espontâneo", "Posicional", "Evocado"]}
     ]
   },
   {
     "section": "Avaliação Funcional",
     "fields": [
       {"key": "dhi", "label": "Escala DHI (0-100)", "type": "range", "min": 0, "max": 100},
       {"key": "risco_quedas", "label": "Risco de Quedas", "type": "select", 
        "options": ["Baixo", "Moderado", "Alto"]},
       {"key": "limitacao_avds", "label": "Limitação AVDs", "type": "tags", 
        "options": ["Conduzir", "Ler", "Caminhar", "Trabalhar", "Atividades Domésticas"]}
     ]
   }
 ]'::jsonb);
```

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| **Nova migration SQL** | INSERT das 2 novas especialidades |

**Nenhuma alteração de código necessária** - o sistema já carrega dinamicamente os templates da tabela `specialty_templates`.

---

## Resultado Esperado

Após a implementação, o dropdown de especialidades mostrará:

1. Sem especialidade definida
2. Fisioterapia Motora *(novo)*
3. Fisioterapia Respiratória
4. Neurofuncional Pediátrica
5. Pilates
6. Reabilitação Vestibular *(novo)*

Os formulários dinâmicos serão renderizados automaticamente nas evoluções clínicas.

