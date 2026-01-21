-- Step 1: Create specialty_templates table for dynamic form schemas
CREATE TABLE public.specialty_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  schema JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.specialty_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view templates from own clinic OR global templates (clinic_id IS NULL)
CREATE POLICY "Users can view specialty templates"
ON public.specialty_templates
FOR SELECT
USING (
  clinic_id IS NULL 
  OR clinic_id = get_user_clinic_id(auth.uid())
);

CREATE POLICY "Users can manage specialty templates in own clinic"
ON public.specialty_templates
FOR ALL
USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_specialty_templates_updated_at
BEFORE UPDATE ON public.specialty_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Step 2: Add columns to evolucoes_clinicas for structured data
ALTER TABLE public.evolucoes_clinicas 
  ADD COLUMN specialty_id UUID REFERENCES public.specialty_templates(id),
  ADD COLUMN structured_data JSONB;

-- Step 3: Seed the "Neurofuncional Pediátrica" template as a GLOBAL template (clinic_id = NULL)
INSERT INTO public.specialty_templates (clinic_id, name, description, schema) VALUES
(NULL, 'Neurofuncional Pediátrica', 'Avaliação especializada para bebés e crianças com condições neurológicas', 
'[
  {
    "section": "Avaliação Craniana",
    "fields": [
      { "key": "assimetria", "label": "Tipo de Assimetria", "type": "select", "options": ["Nenhuma", "Plagiocefalia", "Braquicefalia", "Escafocefalia"] },
      { "key": "lado_achatamento", "label": "Lado do Achatamento", "type": "select", "options": ["Direito", "Esquerdo", "Bilateral"] },
      { "key": "severidade", "label": "Severidade (0-10)", "type": "range", "min": 0, "max": 10 }
    ]
  },
  {
    "section": "Pescoço e Torcicolo",
    "fields": [
      { "key": "torcicolo", "label": "Torcicolo Congénito", "type": "tags", "options": ["Ausente", "Postural", "Muscular", "Ósseo"] },
      { "key": "rotacao_passiva", "label": "Rotação Cervical Passiva", "type": "select", "options": ["Livre", "Limitada D", "Limitada E"] }
    ]
  },
  {
    "section": "Desenvolvimento Motor",
    "fields": [
      { "key": "marcos_motores", "label": "Marcos Atuais", "type": "multiselect", "options": ["Controlo Cervical", "Rolar", "Sentar s/ apoio", "Gatinhar", "Marcha"] },
      { "key": "comportamento", "label": "Comportamento", "type": "tags", "options": ["Calmo", "Choroso", "Dormiu"] }
    ]
  }
]'::jsonb),

-- Add a "Geral" template as fallback (maintains current behavior)
(NULL, 'Geral', 'Evolução clínica genérica sem campos estruturados', '[]'::jsonb),

-- Add Pilates template for future use
(NULL, 'Pilates', 'Avaliação para sessões de Pilates Clínico',
'[
  {
    "section": "Avaliação Postural",
    "fields": [
      { "key": "postura_global", "label": "Postura Global", "type": "select", "options": ["Adequada", "Cifose Acentuada", "Lordose Acentuada", "Escoliose"] },
      { "key": "flexibilidade", "label": "Flexibilidade", "type": "range", "min": 0, "max": 10 },
      { "key": "forca_core", "label": "Força do Core", "type": "range", "min": 0, "max": 10 }
    ]
  },
  {
    "section": "Objetivos da Sessão",
    "fields": [
      { "key": "foco", "label": "Foco Principal", "type": "tags", "options": ["Fortalecimento", "Alongamento", "Mobilidade", "Equilíbrio", "Respiração"] },
      { "key": "equipamentos", "label": "Equipamentos Utilizados", "type": "multiselect", "options": ["Reformer", "Cadillac", "Chair", "Barrel", "Mat"] }
    ]
  }
]'::jsonb);