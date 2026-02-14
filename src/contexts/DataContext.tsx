// DataContext - Centralized state management with 100% Supabase integration
// All data is fetched from the database - no localStorage or mock data
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { Patient } from "@/services/PatientService";
import { Session } from "@/services/SessionService";
import { Professional } from "@/services/ProfessionalService";
import { Evolution } from "@/services/EvolutionService";
import { AuditService } from "@/services/AuditService";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
  // Global loading state
  isLoading: boolean;
  
  // Patients
  patients: Patient[];
  patientsLoading: boolean;
  addPatient: (patient: Patient) => void;
  updatePatient: (id: string, data: Partial<Patient>) => void;
  deletePatient: (patientId: string, reason?: string) => Promise<void>;
  refreshPatients: () => Promise<void>;
  
  // Sessions
  sessions: Session[];
  sessionsLoading: boolean;
  addSession: (session: Session) => Promise<void>;
  updateSession: (id: string, data: Partial<Session>) => Promise<void>;
  deleteSession: (sessionId: string, reason?: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  
  // Professionals
  professionals: Professional[];
  professionalsLoading: boolean;
  addProfessional: (professional: Professional) => void;
  updateProfessional: (id: string, data: Partial<Professional>) => void;
  deleteProfessional: (professionalId: string, reason?: string) => Promise<void>;
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
  useCredit: (patientId: string, sessionId: string) => Promise<{ success: boolean; error?: string; alreadyDeducted?: boolean }>;
  refundCredit: (patientId: string, sessionId: string) => Promise<{ success: boolean; error?: string }>;
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

  // Refs for tab-switch stability
  const cachedUserId = useRef<string | null>(null);
  const hasInitiallyLoaded = useRef(false);

  // Fetch patients from Supabase
  const fetchPatients = async (silent = false) => {
    if (!silent) setPatientsLoading(true);
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
  const fetchSessions = async (silent = false) => {
    if (!silent) setSessionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("sessoes")
        .select(`
          *,
          paciente:pacientes(id, full_name),
          profissional:profiles!sessoes_profissional_id_fkey(id, full_name),
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

  // Fetch professionals from profiles table (sessoes FK points here)
  const fetchProfessionals = async (silent = false) => {
    if (!silent) setProfessionalsLoading(true);
    try {
      // Must fetch from profiles table because sessoes.profissional_id references profiles.id
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          phone,
          role,
          specialty,
          crefito,
          avatar_url,
          is_active,
          clinic_id
        `)
        .eq("is_active", true)
        .in("role", ['fisioterapeuta', 'admin', 'professional'])
        .order("full_name");

      if (error) {
        console.error("Error fetching professionals:", error);
        return;
      }

      // Map to Professional interface - IDs now match profiles table
      const transformed: Professional[] = (data || []).map((p: any) => ({
        id: p.id,
        clinic_id: p.clinic_id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        role: p.role,
        specialty: p.specialty,
        crefito: p.crefito,
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
  const fetchEvolutions = async (silent = false) => {
    if (!silent) setEvolutionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("evolucoes_clinicas")
        .select(`
          *,
          profissional:profiles!evolucoes_clinicas_profissional_id_fkey(id, full_name)
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
  const fetchServices = async (silent = false) => {
    if (!silent) setServicesLoading(true);
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

  // Delete service (soft delete - set inactive) with audit
  const deleteService = async (id: string, reason?: string): Promise<void> => {
    const service = services.find(s => s.id === id);
    
    const { error } = await supabase
      .from("servicos")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;

    // Log audit
    if (service) {
      await AuditService.log({
        action: 'delete',
        entityType: 'service',
        entityId: id,
        entityName: service.name,
        details: {
          reason,
          previousData: {
            name: service.name,
            price: service.price,
            duration_minutes: service.duration_minutes,
          }
        }
      });
    }

    await fetchServices();
  };

  // Delete patient (soft delete - set inactive)
  const deletePatient = async (patientId: string, reason?: string): Promise<void> => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) throw new Error("Paciente não encontrado");

    // Soft delete
    const { error } = await supabase
      .from("pacientes")
      .update({ is_active: false })
      .eq("id", patientId);

    if (error) throw error;

    // Log audit
    await AuditService.log({
      action: 'delete',
      entityType: 'patient',
      entityId: patientId,
      entityName: patient.full_name,
      details: {
        reason,
        previousData: {
          email: patient.email,
          phone: patient.phone,
          cpf: patient.cpf,
        }
      }
    });

    await fetchPatients();
  };

  // Delete session (hard delete for non-finalized)
  const deleteSession = async (sessionId: string, reason?: string): Promise<void> => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Sessão não encontrada");

    // Cannot delete finalized sessions
    if (session.status === 'realizado') {
      throw new Error("Sessões finalizadas não podem ser apagadas");
    }

    // Delete session
    const { error } = await supabase
      .from("sessoes")
      .delete()
      .eq("id", sessionId);

    if (error) throw error;

    // Log audit
    await AuditService.log({
      action: 'delete',
      entityType: 'session',
      entityId: sessionId,
      entityName: `${session.paciente?.full_name || 'Paciente'} - ${format(new Date(session.start_time), 'dd/MM HH:mm')}`,
      details: {
        reason,
        patient: session.paciente?.full_name,
        professional: session.profissional?.full_name,
        service: session.servico?.name,
        date: session.start_time.toString(),
        status: session.status,
      }
    });

    await fetchSessions();
  };

  // Delete professional (soft delete - set inactive)
  const deleteProfessional = async (professionalId: string, reason?: string): Promise<void> => {
    const professional = professionals.find(p => p.id === professionalId);
    if (!professional) throw new Error("Profissional não encontrado");

    // Soft delete
    const { error } = await supabase
      .from("profissionais")
      .update({ is_active: false })
      .eq("id", professionalId);

    if (error) throw error;

    // Log audit
    await AuditService.log({
      action: 'delete',
      entityType: 'professional',
      entityId: professionalId,
      entityName: professional.full_name,
      details: {
        reason,
        previousData: {
          email: professional.email,
          phone: professional.phone,
          specialty: professional.specialty,
        }
      }
    });

    await fetchProfessionals();
  };

  // Fetch credit usage map from backend (which sessions already had credits deducted)
  const fetchCreditUsageMap = async () => {
    try {
      const { data, error } = await supabase
        .from("transacoes_credito")
        .select("session_id")
        .eq("tipo", "uso")
        .not("session_id", "is", null);

      if (error) {
        console.error("Error fetching credit usage map:", error);
        return;
      }

      const map: Record<string, boolean> = {};
      (data || []).forEach((row: { session_id: string | null }) => {
        if (row.session_id) {
          map[row.session_id] = true;
        }
      });

      setCreditUsageMap(map);
    } catch (err) {
      console.error("Exception fetching credit usage map:", err);
    }
  };

  // Load all data on mount
  useEffect(() => {
    const initLoad = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      cachedUserId.current = user?.id ?? null;
      
      await Promise.all([
        fetchPatients(),
        fetchServices(),
        fetchSessions(),
        fetchProfessionals(),
        fetchEvolutions(),
        fetchCreditBalances(),
        fetchCreditUsageMap(),
      ]);
      hasInitiallyLoaded.current = true;
    };
    initLoad();
  }, []);

  // Refresh data on auth state change - stabilized to prevent tab-switch freezes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        cachedUserId.current = null;
        hasInitiallyLoaded.current = false;
        // Clear all state on logout
        setPatients([]);
        setServices([]);
        setSessions([]);
        setProfessionals([]);
        setEvolutions([]);
        setCreditBalances({});
        setCreditUsageMap({});
      } else if (event === 'SIGNED_IN') {
        const { data: { user } } = await supabase.auth.getUser();
        // If same user (token refresh on tab switch), do silent fetches
        if (user?.id === cachedUserId.current && hasInitiallyLoaded.current) {
          // Silent refresh - no loading spinners
          fetchPatients(true);
          fetchServices(true);
          fetchSessions(true);
          fetchProfessionals(true);
          fetchEvolutions(true);
          fetchCreditBalances();
          fetchCreditUsageMap();
          return;
        }
        // New user signed in
        cachedUserId.current = user?.id ?? null;
        hasInitiallyLoaded.current = true;
        fetchPatients();
        fetchServices();
        fetchSessions();
        fetchProfessionals();
        fetchEvolutions();
        fetchCreditBalances();
        fetchCreditUsageMap();
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

  // Add session - persists to Supabase database
  const addSession = async (session: Session): Promise<void> => {
    // Get clinic_id from authenticated user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("User not authenticated");

    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!profile?.clinic_id) throw new Error("User has no clinic");

    // Insert into database
    const { data, error } = await supabase.from("sessoes").insert({
      clinic_id: profile.clinic_id,
      paciente_id: session.paciente_id,
      profissional_id: session.profissional_id,
      servico_id: session.servico_id,
      start_time: session.start_time instanceof Date 
        ? session.start_time.toISOString() 
        : session.start_time,
      end_time: session.end_time instanceof Date 
        ? session.end_time.toISOString() 
        : session.end_time,
      status: session.status,
      notes: session.notes,
      price: session.price,
      payment_status: session.payment_status,
    }).select(`
      *,
      paciente:pacientes(id, full_name),
      profissional:profiles!sessoes_profissional_id_fkey(id, full_name),
      servico:servicos(id, name, color, duration_minutes, consumes_credit)
    `).single();

    if (error) throw error;

    // Transform and add to local state with real database ID
    const newSession: Session = {
      id: data.id,
      clinic_id: data.clinic_id,
      paciente_id: data.paciente_id,
      profissional_id: data.profissional_id,
      servico_id: data.servico_id,
      start_time: new Date(data.start_time),
      end_time: new Date(data.end_time),
      status: data.status,
      price: data.price || 0,
      payment_status: data.payment_status || 'pendente',
      payment_method: data.payment_method,
      notes: data.notes,
      paciente: data.paciente,
      profissional: data.profissional,
      servico: data.servico,
    };

    setSessions((prev) => [newSession, ...prev]);
  };

  // Update session - persists to Supabase database
  const updateSession = async (id: string, data: Partial<Session>): Promise<void> => {
    // Prepare update data
    const updateData: Record<string, unknown> = {};
    
    if (data.start_time !== undefined) {
      updateData.start_time = data.start_time instanceof Date 
        ? data.start_time.toISOString() 
        : data.start_time;
    }
    if (data.end_time !== undefined) {
      updateData.end_time = data.end_time instanceof Date 
        ? data.end_time.toISOString() 
        : data.end_time;
    }
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.payment_status !== undefined) updateData.payment_status = data.payment_status;
    if (data.payment_method !== undefined) updateData.payment_method = data.payment_method;
    if (data.price !== undefined) updateData.price = data.price;

    // Update in database
    const { error } = await supabase
      .from("sessoes")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    // Update local state
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

  // Idempotent credit usage - persists to transacoes_credito table
  const useCredit = async (
    patientId: string,
    sessionId: string
  ): Promise<{ success: boolean; error?: string; alreadyDeducted?: boolean }> => {
    try {
      // Check idempotency - credit already used for this session?
      const { data: existing } = await supabase
        .from("transacoes_credito")
        .select("id")
        .eq("session_id", sessionId)
        .eq("tipo", "uso")
        .maybeSingle();

      if (existing) {
        return { success: true, alreadyDeducted: true };
      }

      // Check current balance
      const currentBalance = creditBalances[patientId] ?? 0;
      if (currentBalance <= 0) {
        return { success: false, error: "Saldo de créditos insuficiente" };
      }

      // Get clinic_id
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("user_id", userData?.user?.id)
        .maybeSingle();

      if (!profile?.clinic_id) {
        return { success: false, error: "Clínica não encontrada" };
      }

      // Insert usage transaction (quantidade is negative for usage)
      const { error } = await supabase.from("transacoes_credito").insert({
        patient_id: patientId,
        clinic_id: profile.clinic_id,
        tipo: "uso",
        quantidade: -1,
        session_id: sessionId,
        motivo: "Uso de crédito para sessão",
      });

      if (error) {
        // Handle idempotency constraint
        if (error.message.includes("idempotência") || error.code === "23505") {
          return { success: true, alreadyDeducted: true };
        }
        console.error("Error inserting credit usage:", error);
        return { success: false, error: "Erro ao descontar crédito" };
      }

      // Update local state
      setCreditUsageMap((prev) => ({ ...prev, [sessionId]: true }));
      await fetchCreditBalances();

      return { success: true };
    } catch (err) {
      console.error("Exception in useCredit:", err);
      return { success: false, error: "Erro inesperado ao descontar crédito" };
    }
  };

  // Refund credit - persists to transacoes_credito table
  const refundCredit = async (
    patientId: string,
    sessionId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Get clinic_id
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("user_id", userData?.user?.id)
        .maybeSingle();

      if (!profile?.clinic_id) {
        return { success: false, error: "Clínica não encontrada" };
      }

      // Insert refund transaction (quantidade is positive for refund)
      const { error } = await supabase.from("transacoes_credito").insert({
        patient_id: patientId,
        clinic_id: profile.clinic_id,
        tipo: "estorno",
        quantidade: 1,
        session_id: sessionId,
        motivo: "Estorno de crédito por cancelamento",
      });

      if (error) {
        console.error("Error inserting credit refund:", error);
        return { success: false, error: "Erro ao estornar crédito" };
      }

      // Update local state - remove from usage map
      setCreditUsageMap((prev) => {
        const updated = { ...prev };
        delete updated[sessionId];
        return updated;
      });
      await fetchCreditBalances();

      return { success: true };
    } catch (err) {
      console.error("Exception in refundCredit:", err);
      return { success: false, error: "Erro inesperado ao estornar crédito" };
    }
  };

  // Check if credit was already used for a session
  const wasCreditUsedForSession = (sessionId: string): boolean => {
    return creditUsageMap[sessionId] ?? false;
  };

  // Compute overall loading state
  const isLoading = patientsLoading || sessionsLoading || professionalsLoading || servicesLoading;

  const value: DataContextType = {
    isLoading,
    patients,
    patientsLoading,
    addPatient,
    updatePatient,
    deletePatient,
    refreshPatients: fetchPatients,
    sessions,
    sessionsLoading,
    addSession,
    updateSession,
    deleteSession,
    refreshSessions: fetchSessions,
    professionals,
    professionalsLoading,
    addProfessional,
    updateProfessional,
    deleteProfessional,
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
