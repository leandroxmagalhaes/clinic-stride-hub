-- =============================================
-- PHYSIONE - ENTERPRISE GRADE DATABASE SCHEMA
-- Multi-tenant ready with financial fields
-- =============================================

-- CLINICS TABLE (Multi-tenant foundation)
CREATE TABLE public.clinics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- PROFILES TABLE (User profiles linked to auth)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'fisioterapeuta' CHECK (role IN ('admin', 'fisioterapeuta', 'recepcionista')),
  avatar_url TEXT,
  specialty TEXT,
  crefito TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- PACIENTES TABLE (DDD naming: Paciente not User)
CREATE TABLE public.pacientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  cpf TEXT,
  birth_date DATE,
  gender TEXT CHECK (gender IN ('M', 'F', 'O')),
  phone TEXT,
  email TEXT,
  address TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  health_insurance TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SERVICOS TABLE (Service types)
CREATE TABLE public.servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#10B981',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SESSOES TABLE (Agendamentos/Appointments - DDD: Sessao)
-- Includes financial fields for future module
CREATE TABLE public.sessoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  servico_id UUID REFERENCES public.servicos(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'confirmado', 'em_atendimento', 'finalizado', 'cancelado', 'faltou')),
  notes TEXT,
  -- Financial fields (ready for future module)
  price DECIMAL(10,2),
  payment_status TEXT DEFAULT 'pendente' CHECK (payment_status IN ('pendente', 'pago', 'parcial', 'cancelado')),
  payment_method TEXT CHECK (payment_method IN ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'convenio', 'boleto')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- PRONTUARIOS TABLE (Patient Medical Records)
CREATE TABLE public.prontuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  anamnese TEXT,
  diagnostico TEXT,
  objetivos TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- EVOLUCOES_CLINICAS TABLE (Clinical Evolution Records)
CREATE TABLE public.evolucoes_clinicas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  prontuario_id UUID NOT NULL REFERENCES public.prontuarios(id) ON DELETE CASCADE,
  sessao_id UUID REFERENCES public.sessoes(id) ON DELETE SET NULL,
  profissional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  escala_dor INTEGER CHECK (escala_dor >= 0 AND escala_dor <= 10),
  anexos_urls TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prontuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolucoes_clinicas ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- Clinics: Users can only see their own clinic
CREATE POLICY "Users can view own clinic" ON public.clinics
  FOR SELECT USING (
    id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Profiles: Users can see profiles from their clinic
CREATE POLICY "Users can view profiles from own clinic" ON public.profiles
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Pacientes: Only see patients from own clinic
CREATE POLICY "Users can view patients from own clinic" ON public.pacientes
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert patients in own clinic" ON public.pacientes
  FOR INSERT WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update patients in own clinic" ON public.pacientes
  FOR UPDATE USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Servicos: Only see services from own clinic
CREATE POLICY "Users can view services from own clinic" ON public.servicos
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage services in own clinic" ON public.servicos
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Sessoes: Only see appointments from own clinic
CREATE POLICY "Users can view sessions from own clinic" ON public.sessoes
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert sessions in own clinic" ON public.sessoes
  FOR INSERT WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update sessions in own clinic" ON public.sessoes
  FOR UPDATE USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete sessions in own clinic" ON public.sessoes
  FOR DELETE USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Prontuarios: Only see medical records from own clinic
CREATE POLICY "Users can view prontuarios from own clinic" ON public.prontuarios
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage prontuarios in own clinic" ON public.prontuarios
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Evolucoes: Only see clinical evolutions from own clinic
CREATE POLICY "Users can view evolucoes from own clinic" ON public.evolucoes_clinicas
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage evolucoes in own clinic" ON public.evolucoes_clinicas
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pacientes_updated_at BEFORE UPDATE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_servicos_updated_at BEFORE UPDATE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessoes_updated_at BEFORE UPDATE ON public.sessoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prontuarios_updated_at BEFORE UPDATE ON public.prontuarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_profiles_clinic_id ON public.profiles(clinic_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_pacientes_clinic_id ON public.pacientes(clinic_id);
CREATE INDEX idx_sessoes_clinic_id ON public.sessoes(clinic_id);
CREATE INDEX idx_sessoes_start_time ON public.sessoes(start_time);
CREATE INDEX idx_sessoes_profissional_id ON public.sessoes(profissional_id);
CREATE INDEX idx_prontuarios_paciente_id ON public.prontuarios(paciente_id);
CREATE INDEX idx_evolucoes_prontuario_id ON public.evolucoes_clinicas(prontuario_id);