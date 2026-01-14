// Mock data for development - simulates data that would come from Supabase
import { addDays, setHours, setMinutes, startOfWeek, format } from "date-fns";

// Demo clinic ID
export const DEMO_CLINIC_ID = "demo-clinic-001";

// Profissionais (Professionals)
export const mockProfissionais = [
  {
    id: "prof-001",
    clinic_id: DEMO_CLINIC_ID,
    full_name: "Dr. Pedro Santos",
    email: "pedro.santos@physione.com",
    phone: "(11) 99999-1111",
    role: "fisioterapeuta",
    specialty: "Fisioterapia Ortopédica",
    crefito: "CREFITO-3/12345-F",
    avatar_url: null,
    is_active: true,
  },
  {
    id: "prof-002",
    clinic_id: DEMO_CLINIC_ID,
    full_name: "Dra. Ana Oliveira",
    email: "ana.oliveira@physione.com",
    phone: "(11) 99999-2222",
    role: "fisioterapeuta",
    specialty: "Pilates Clínico",
    crefito: "CREFITO-3/54321-F",
    avatar_url: null,
    is_active: true,
  },
];

// Pacientes (Patients)
export const mockPacientes = [
  {
    id: "pac-001",
    clinic_id: DEMO_CLINIC_ID,
    full_name: "Maria Silva",
    cpf: "123.456.789-00",
    birth_date: "1985-03-15",
    gender: "F",
    phone: "(11) 98888-1111",
    email: "maria.silva@email.com",
    address: "Rua das Flores, 123 - São Paulo, SP",
    emergency_contact: "João Silva",
    emergency_phone: "(11) 97777-1111",
    health_insurance: "Unimed",
    notes: "Paciente com histórico de lesão no joelho",
    is_active: true,
  },
  {
    id: "pac-002",
    clinic_id: DEMO_CLINIC_ID,
    full_name: "Carlos Mendes",
    cpf: "987.654.321-00",
    birth_date: "1990-07-22",
    gender: "M",
    phone: "(11) 98888-2222",
    email: "carlos.mendes@email.com",
    address: "Av. Brasil, 456 - São Paulo, SP",
    emergency_contact: "Ana Mendes",
    emergency_phone: "(11) 97777-2222",
    health_insurance: null,
    notes: null,
    is_active: true,
  },
  {
    id: "pac-003",
    clinic_id: DEMO_CLINIC_ID,
    full_name: "Juliana Costa",
    cpf: "456.789.123-00",
    birth_date: "1978-11-30",
    gender: "F",
    phone: "(11) 98888-3333",
    email: "juliana.costa@email.com",
    address: "Rua Augusta, 789 - São Paulo, SP",
    emergency_contact: "Roberto Costa",
    emergency_phone: "(11) 97777-3333",
    health_insurance: "Bradesco Saúde",
    notes: "Pratica Pilates há 2 anos",
    is_active: true,
  },
  {
    id: "pac-004",
    clinic_id: DEMO_CLINIC_ID,
    full_name: "Roberto Almeida",
    cpf: "321.654.987-00",
    birth_date: "1965-05-10",
    gender: "M",
    phone: "(11) 98888-4444",
    email: "roberto.almeida@email.com",
    address: "Rua Oscar Freire, 321 - São Paulo, SP",
    emergency_contact: "Sandra Almeida",
    emergency_phone: "(11) 97777-4444",
    health_insurance: "SulAmérica",
    notes: "Paciente pós-operatório de coluna",
    is_active: true,
  },
  {
    id: "pac-005",
    clinic_id: DEMO_CLINIC_ID,
    full_name: "Fernanda Lima",
    cpf: "654.321.987-00",
    birth_date: "1995-09-08",
    gender: "F",
    phone: "(11) 98888-5555",
    email: "fernanda.lima@email.com",
    address: "Alameda Santos, 654 - São Paulo, SP",
    emergency_contact: "Paulo Lima",
    emergency_phone: "(11) 97777-5555",
    health_insurance: null,
    notes: "Atleta amadora - corrida",
    is_active: true,
  },
];

// Serviços (Services)
export const mockServicos = [
  {
    id: "serv-001",
    clinic_id: DEMO_CLINIC_ID,
    name: "Fisioterapia",
    description: "Sessão de fisioterapia convencional",
    duration_minutes: 60,
    price: 150.00,
    color: "#0EA5E9",
    is_active: true,
  },
  {
    id: "serv-002",
    clinic_id: DEMO_CLINIC_ID,
    name: "Pilates",
    description: "Aula de Pilates solo ou aparelhos",
    duration_minutes: 60,
    price: 120.00,
    color: "#10B981",
    is_active: true,
  },
  {
    id: "serv-003",
    clinic_id: DEMO_CLINIC_ID,
    name: "RPG",
    description: "Reeducação Postural Global",
    duration_minutes: 90,
    price: 200.00,
    color: "#8B5CF6",
    is_active: true,
  },
];

// Helper to generate sessions for the current week
function generateWeekSessions() {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  
  const sessions = [
    // Monday
    {
      id: "sess-001",
      paciente_id: "pac-001",
      profissional_id: "prof-001",
      servico_id: "serv-001",
      start_time: setMinutes(setHours(addDays(weekStart, 0), 9), 0),
      status: "finalizado",
    },
    {
      id: "sess-002",
      paciente_id: "pac-002",
      profissional_id: "prof-002",
      servico_id: "serv-002",
      start_time: setMinutes(setHours(addDays(weekStart, 0), 10), 0),
      status: "finalizado",
    },
    // Tuesday
    {
      id: "sess-003",
      paciente_id: "pac-003",
      profissional_id: "prof-001",
      servico_id: "serv-003",
      start_time: setMinutes(setHours(addDays(weekStart, 1), 14), 0),
      status: "confirmado",
    },
    // Wednesday
    {
      id: "sess-004",
      paciente_id: "pac-004",
      profissional_id: "prof-002",
      servico_id: "serv-001",
      start_time: setMinutes(setHours(addDays(weekStart, 2), 11), 0),
      status: "agendado",
    },
    {
      id: "sess-005",
      paciente_id: "pac-005",
      profissional_id: "prof-001",
      servico_id: "serv-002",
      start_time: setMinutes(setHours(addDays(weekStart, 2), 16), 0),
      status: "agendado",
    },
    // Thursday
    {
      id: "sess-006",
      paciente_id: "pac-001",
      profissional_id: "prof-002",
      servico_id: "serv-002",
      start_time: setMinutes(setHours(addDays(weekStart, 3), 9), 0),
      status: "agendado",
    },
    {
      id: "sess-007",
      paciente_id: "pac-002",
      profissional_id: "prof-001",
      servico_id: "serv-001",
      start_time: setMinutes(setHours(addDays(weekStart, 3), 15), 0),
      status: "agendado",
    },
    // Friday
    {
      id: "sess-008",
      paciente_id: "pac-003",
      profissional_id: "prof-001",
      servico_id: "serv-001",
      start_time: setMinutes(setHours(addDays(weekStart, 4), 10), 0),
      status: "agendado",
    },
    {
      id: "sess-009",
      paciente_id: "pac-004",
      profissional_id: "prof-002",
      servico_id: "serv-003",
      start_time: setMinutes(setHours(addDays(weekStart, 4), 14), 0),
      status: "confirmado",
    },
    {
      id: "sess-010",
      paciente_id: "pac-005",
      profissional_id: "prof-001",
      servico_id: "serv-002",
      start_time: setMinutes(setHours(addDays(weekStart, 4), 17), 0),
      status: "agendado",
    },
  ];

  return sessions.map((session) => {
    const servico = mockServicos.find((s) => s.id === session.servico_id);
    const paciente = mockPacientes.find((p) => p.id === session.paciente_id);
    const profissional = mockProfissionais.find((p) => p.id === session.profissional_id);

    return {
      ...session,
      clinic_id: DEMO_CLINIC_ID,
      end_time: new Date(session.start_time.getTime() + (servico?.duration_minutes || 60) * 60000),
      price: servico?.price || 0,
      payment_status: session.status === "finalizado" ? "pago" : "pendente",
      payment_method: session.status === "finalizado" ? "pix" : null,
      notes: null,
      // Joined data
      paciente,
      profissional,
      servico,
    };
  });
}

export const mockSessoes = generateWeekSessions();

// Prontuários (Medical Records)
export const mockProntuarios = [
  {
    id: "pront-001",
    clinic_id: DEMO_CLINIC_ID,
    paciente_id: "pac-001",
    anamnese: "Paciente relata dor no joelho direito há 3 meses após queda. Dor ao subir escadas e agachar.",
    diagnostico: "Condromalácia patelar grau II",
    objetivos: "Fortalecimento de quadríceps, melhora da propriocepção, redução da dor",
    observacoes: "Paciente motivada e assídua ao tratamento",
    paciente: mockPacientes[0],
  },
  {
    id: "pront-002",
    clinic_id: DEMO_CLINIC_ID,
    paciente_id: "pac-002",
    anamnese: "Dor lombar crônica há 2 anos. Trabalha sentado em escritório.",
    diagnostico: "Lombalgia mecânica",
    objetivos: "Correção postural, fortalecimento do core, alongamento de cadeia posterior",
    observacoes: null,
    paciente: mockPacientes[1],
  },
];

// Evoluções Clínicas (Clinical Evolutions)
export const mockEvolucoes = [
  {
    id: "evol-001",
    clinic_id: DEMO_CLINIC_ID,
    prontuario_id: "pront-001",
    sessao_id: "sess-001",
    profissional_id: "prof-001",
    descricao: "Paciente apresentou melhora na amplitude de movimento. Realizados exercícios de fortalecimento isométrico de quadríceps e alongamento de isquiotibiais. Aplicada crioterapia ao final da sessão.",
    escala_dor: 5,
    anexos_urls: null,
    created_at: new Date().toISOString(),
    profissional: mockProfissionais[0],
  },
  {
    id: "evol-002",
    clinic_id: DEMO_CLINIC_ID,
    prontuario_id: "pront-001",
    sessao_id: null,
    profissional_id: "prof-001",
    descricao: "Evolução positiva. Dor reduziu significativamente. Iniciado treino proprioceptivo em superfície instável.",
    escala_dor: 3,
    anexos_urls: null,
    created_at: addDays(new Date(), -7).toISOString(),
    profissional: mockProfissionais[0],
  },
];

// Dashboard stats
export const mockDashboardStats = {
  atendimentosHoje: 5,
  pacientesAtivos: mockPacientes.filter(p => p.is_active).length,
  sessoesSemana: mockSessoes.length,
  taxaComparecimento: 92,
};
