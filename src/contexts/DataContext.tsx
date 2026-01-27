// DataContext - Centralized state management with 100% Supabase integration
// All data is fetched from the database - no localStorage or mock data
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Patient } from "@/services/PatientService";
import { Session } from "@/services/SessionService";
import { Professional } from "@/services/ProfessionalService";
import { Evolution } from "@/services/EvolutionService";
import { supabase } from "@/integrations/supabase/client";

// Service type from Supabase
export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  consumes_credit: boolean;
  color: string | null;
  is_active: boolean | null;
  clinic_id: string;
  created_at: string;
  updated_at: string;
}

interface DataContextType {
  // Patients
  patients: Patient[];
  patientsLoading: boolean;
  addPatient: (patient: Patient) => void;
  updatePatient: (id: string, data: Partial<Patient>) => void;
  refreshPatients: () => Promise<void>;
  
  // Sessions
  sessions: Session[];
  sessionsLoading: boolean;
  addSession: (session: Session) => void;
  updateSession: (id: string, data: Partial<Session>) => void;
  refreshSessions: () => Promise<void>;
  
  // Professionals
  professionals: Professional[];
  professionalsLoading: boolean;
  addProfessional: (professional: Professional) => void;
  updateProfessional: (id: string, data: Partial<Professional>) => void;
  refreshProfessionals: () => Promise<void>;
  
  // Evolutions
  evolutions: Evolution[];
  evolutionsLoading: boolean;
  addEvolution: (evolution: Evolution) => void;
  refreshEvolutions: () => Promise<void>;
  
  // Credit Balances (from database view)
  creditBalances: Record<string, number>;
  getCreditBalance: (patientId: string) => number;
  addCredits: (patientId: string, amount: number) => Promise<void>;
  useCredit: (patientId: string, sessionId: string) => { success: boolean; error?: string };
  refundCredit: (patientId: string) => void;
  wasCreditUsedForSession: (sessionId: string) => boolean;
  refreshCreditBalances: () => Promise<void>;
  
  // Services (from Supabase)
  services: Service[];
  servicesLoading: boolean;
  addService: (data: Partial<Service>) => Promise<void>;
  updateService: (id: string, data: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  refreshServices: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  // Core state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalsLoading, setProfessionalsLoading] = useState(true);
  
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [evolutionsLoading, setEvolutionsLoading] = useState(true);
  
  const [creditBalances, setCreditBalances] = useState<Record<string, number>>({});
  
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  
  // Track credit usage per session for idempotency (session_id -> boolean)
  const [creditUsageMap, setCreditUsageMap] = useState<Record<string, boolean>>({});

  // Fetch patients from Supabase
  const fetchPatients = async () => {
    setPatientsLoading(true);
    try {
      const { data, error } = await supabase
        .from("pacientes")
        .select("*")
        .order("full_name");

      if (error) {
        console.error("Error fetching patients:", error);
        return;
      }

      setPatients(data as Patient[]);
    } catch (err) {
      console.error("Exception fetching patients:", err);
    } finally {
      setPatientsLoading(false);
    }
  };

  // Fetch sessions from Supabase with relations
  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("sessoes")
        .select(`
          *,
          paciente:pacientes(id, full_name),
          profissional:profissionais(id, full_name),
          servico:servicos(id, name, color, duration_minutes, consumes_credit)
        `)
        .order("start_time", { ascending: false });

      if (error) {
        console.error("Error fetching sessions:", error);
        return;
      }

      // Transform data to match Session interface
      const transformedSessions: Session[] = (data || []).map((s: any) => ({
        id: s.id,
        clinic_id: s.clinic_id,
        paciente_id: s.paciente_id,
        profissional_id: s.profissional_id,
        servico_id: s.servico_id,
        start_time: new Date(s.start_time),
        end_time: new Date(s.end_time),
        status: s.status,
        price: s.price || 0,
        payment_status: s.payment_status || 'pendente',
        payment_method: s.payment_method,
        notes: s.notes,
        paciente: s.paciente,
        profissional: s.profissional,
        servico: s.servico,
      }));

      setSessions(transformedSessions);
    } catch (err) {
      console.error("Exception fetching sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Fetch professionals from Supabase
  const fetchProfessionals = async () => {
    setProfessionalsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profissionais")
        .select("*")
        .eq("is_active", true)
        .order("full_name");

      if (error) {
        console.error("Error fetching professionals:", error);
        return;
      }

      // Map database fields to Professional interface
      const transformed: Professional[] = (data || []).map((p: any) => ({
        id: p.id,
        clinic_id: p.clinic_id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        role: 'fisioterapeuta', // Default role
        specialty: p.specialty,
        crefito: p.council_number,
        avatar_url: p.avatar_url,
        is_active: p.is_active,
      }));

      setProfessionals(transformed);
    } catch (err) {
      console.error("Exception fetching professionals:", err);
    } finally {
      setProfessionalsLoading(false);
    }
  };

  // Fetch evolutions from Supabase
  const fetchEvolutions = async () => {
    setEvolutionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("evolucoes_clinicas")
        .select(`
          *,
          profissional:profissionais(id, full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching evolutions:", error);
        return;
      }

      // Map database fields to Evolution interface
      const transformed: Evolution[] = (data || []).map((e: any) => ({
        id: e.id,
        clinic_id: e.clinic_id,
        prontuario_id: e.prontuario_id,
        sessao_id: e.sessao_id,
        profissional_id: e.profissional_id,
        descricao: e.descricao,
        escala_dor: e.escala_dor,
        anexos_urls: e.anexos_urls,
        created_at: e.created_at,
        specialty_id: e.specialty_id,
        structured_data: e.structured_data,
        profissional: e.profissional,
      }));

      setEvolutions(transformed);
    } catch (err) {
      console.error("Exception fetching evolutions:", err);
    } finally {
      setEvolutionsLoading(false);
    }
  };

  // Fetch credit balances from the database view
  const fetchCreditBalances = async () => {
    try {
      const { data, error } = await supabase
        .from("saldo_creditos")
        .select("patient_id, saldo");

      if (error) {
        console.error("Error fetching credit balances:", error);
        return;
      }

      const balances: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        if (row.patient_id) {
          balances[row.patient_id] = row.saldo || 0;
        }
      });

      setCreditBalances(balances);
    } catch (err) {
      console.error("Exception fetching credit balances:", err);
    }
  };

  // Fetch services from Supabase
  const fetchServices = async () => {
    setServicesLoading(true);
    try {
      const { data, error } = await supabase
        .from("servicos")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error("Error fetching services:", error);
        return;
      }

      setServices(data as Service[]);
    } catch (err) {
      console.error("Exception fetching services:", err);
    } finally {
      setServicesLoading(false);
    }
  };

  // Add new service
  const addService = async (data: Partial<Service>): Promise<void> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("User not authenticated");

    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!profile?.clinic_id) throw new Error("User has no clinic");

    const { error } = await supabase.from("servicos").insert({
      name: data.name!,
      description: data.description || null,
      duration_minutes: data.duration_minutes || 60,
      price: data.price || 0,
      consumes_credit: data.consumes_credit ?? true,
      color: data.color || "#10B981",
      clinic_id: profile.clinic_id,
    });

    if (error) throw error;
    await fetchServices();
  };

  // Update service
  const updateService = async (id: string, data: Partial<Service>): Promise<void> => {
    const { error } = await supabase
      .from("servicos")
      .update({
        name: data.name,
        description: data.description,
        duration_minutes: data.duration_minutes,
        price: data.price,
        consumes_credit: data.consumes_credit,
        color: data.color,
      })
      .eq("id", id);

    if (error) throw error;
    await fetchServices();
  };

  // Delete service (soft delete - set inactive)
  const deleteService = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("servicos")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;
    await fetchServices();
  };

  // Load all data on mount
  useEffect(() => {
    fetchPatients();
    fetchServices();
    fetchSessions();
    fetchProfessionals();
    fetchEvolutions();
    fetchCreditBalances();
  }, []);

  // Refresh data on auth state change
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // Clear all state on logout
        setPatients([]);
        setServices([]);
        setSessions([]);
        setProfessionals([]);
        setEvolutions([]);
        setCreditBalances({});
        setCreditUsageMap({});
      } else if (event === 'SIGNED_IN') {
        // Refresh all data when user signs in
        fetchPatients();
        fetchServices();
        fetchSessions();
        fetchProfessionals();
        fetchEvolutions();
        fetchCreditBalances();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Local state handlers (optimistic updates)
  const addPatient = (patient: Patient) => {
    setPatients((prev) => [...prev, patient]);
    setCreditBalances((prev) => ({ ...prev, [patient.id]: 0 }));
  };

  const updatePatient = (id: string, data: Partial<Patient>) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data } : p))
    );
  };

  const addSession = (session: Session) => {
    setSessions((prev) => [session, ...prev]);
  };

  const updateSession = (id: string, data: Partial<Session>) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...data } : s))
    );
  };

  const addProfessional = (professional: Professional) => {
    setProfessionals((prev) => [...prev, professional]);
  };

  const updateProfessional = (id: string, data: Partial<Professional>) => {
    setProfessionals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data } : p))
    );
  };

  const addEvolution = (evolution: Evolution) => {
    setEvolutions((prev) => [evolution, ...prev]);
  };

  // Credit balance functions
  const getCreditBalance = (patientId: string): number => {
    return creditBalances[patientId] ?? 0;
  };

  const addCredits = async (patientId: string, amount: number): Promise<void> => {
    if (amount <= 0) return;
    
    // Get clinic_id
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("User not authenticated");

    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!profile?.clinic_id) throw new Error("User has no clinic");

    // Insert credit transaction
    const { error } = await supabase.from("transacoes_credito").insert({
      patient_id: patientId,
      clinic_id: profile.clinic_id,
      tipo: 'compra',
      quantidade: amount,
    });

    if (error) throw error;
    
    // Refresh balances
    await fetchCreditBalances();
  };

  // Idempotent credit usage - returns error if already used for this session
  const useCredit = (patientId: string, sessionId: string): { success: boolean; error?: string } => {
    // Check idempotency - credit already used for this session?
    if (creditUsageMap[sessionId]) {
      return { success: true }; // Already processed - idempotent success
    }

    const currentBalance = creditBalances[patientId] ?? 0;
    if (currentBalance <= 0) {
      return { success: false, error: "Saldo de créditos insuficiente" };
    }

    // Mark session as processed (actual DB deduction happens in session creation)
    setCreditUsageMap((prev) => ({ ...prev, [sessionId]: true }));

    return { success: true };
  };

  // Refund credit (add 1 back to balance)
  const refundCredit = (patientId: string): void => {
    setCreditBalances((prev) => ({
      ...prev,
      [patientId]: (prev[patientId] ?? 0) + 1,
    }));
  };

  // Check if credit was already used for a session
  const wasCreditUsedForSession = (sessionId: string): boolean => {
    return creditUsageMap[sessionId] ?? false;
  };

  const value: DataContextType = {
    patients,
    patientsLoading,
    addPatient,
    updatePatient,
    refreshPatients: fetchPatients,
    sessions,
    sessionsLoading,
    addSession,
    updateSession,
    refreshSessions: fetchSessions,
    professionals,
    professionalsLoading,
    addProfessional,
    updateProfessional,
    refreshProfessionals: fetchProfessionals,
    evolutions,
    evolutionsLoading,
    addEvolution,
    refreshEvolutions: fetchEvolutions,
    creditBalances,
    getCreditBalance,
    addCredits,
    useCredit,
    refundCredit,
    wasCreditUsedForSession,
    refreshCreditBalances: fetchCreditBalances,
    services,
    servicesLoading,
    addService,
    updateService,
    deleteService,
    refreshServices: fetchServices,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
