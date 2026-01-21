// DataContext - Centralized state management with Supabase integration
// Patients and Services are fetched from the database; other entities use localStorage for demo purposes.
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Patient } from "@/services/PatientService";
import { Session } from "@/services/SessionService";
import { Professional } from "@/services/ProfessionalService";
import { Evolution } from "@/services/EvolutionService";
import { mockSessoes, mockProfissionais, mockEvolucoes, mockCreditBalances } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEYS = {
  SESSIONS: "physione_sessions",
  PROFESSIONALS: "physione_professionals",
  EVOLUTIONS: "physione_evolutions",
  CREDIT_BALANCES: "physione_credit_balances",
};

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
  addSession: (session: Session) => void;
  updateSession: (id: string, data: Partial<Session>) => void;
  
  // Professionals
  professionals: Professional[];
  addProfessional: (professional: Professional) => void;
  updateProfessional: (id: string, data: Partial<Professional>) => void;
  
  // Evolutions
  evolutions: Evolution[];
  addEvolution: (evolution: Evolution) => void;
  
  // Credit Balances (demo mode using localStorage)
  creditBalances: Record<string, number>;
  getCreditBalance: (patientId: string) => number;
  addCredits: (patientId: string, amount: number) => void;
  useCredit: (patientId: string, sessionId: string) => { success: boolean; error?: string };
  refundCredit: (patientId: string) => void;
  wasCreditUsedForSession: (sessionId: string) => boolean;
  
  // Services (from Supabase)
  services: Service[];
  servicesLoading: boolean;
  addService: (data: Partial<Service>) => Promise<void>;
  updateService: (id: string, data: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  refreshServices: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Serialize sessions (convert Date objects to strings)
function serializeSessions(sessions: Session[]): string {
  return JSON.stringify(
    sessions.map((s) => ({
      ...s,
      start_time: s.start_time instanceof Date ? s.start_time.toISOString() : s.start_time,
      end_time: s.end_time instanceof Date ? s.end_time.toISOString() : s.end_time,
    }))
  );
}

// Deserialize sessions (convert strings back to Date objects)
function deserializeSessions(json: string): Session[] {
  const parsed = JSON.parse(json);
  return parsed.map((s: any) => ({
    ...s,
    start_time: new Date(s.start_time),
    end_time: new Date(s.end_time),
  }));
}

function loadInitialSessions(): Session[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (stored) {
      return deserializeSessions(stored);
    }
  } catch (e) {
    console.error("Error loading sessions from localStorage:", e);
  }
  return mockSessoes as unknown as Session[];
}

function loadInitialProfessionals(): Professional[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PROFESSIONALS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Error loading professionals from localStorage:", e);
  }
  return mockProfissionais as Professional[];
}

function loadInitialEvolutions(): Evolution[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.EVOLUTIONS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Error loading evolutions from localStorage:", e);
  }
  return mockEvolucoes as Evolution[];
}

function loadInitialCreditBalances(): Record<string, number> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CREDIT_BALANCES);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Error loading credit balances from localStorage:", e);
  }
  return { ...mockCreditBalances };
}

interface DataProviderProps {
  children: ReactNode;
}

// Clear all localStorage data
function clearAllStoredData() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}

export function DataProvider({ children }: DataProviderProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>(loadInitialSessions);
  const [professionals, setProfessionals] = useState<Professional[]>(loadInitialProfessionals);
  const [evolutions, setEvolutions] = useState<Evolution[]>(loadInitialEvolutions);
  const [creditBalances, setCreditBalances] = useState<Record<string, number>>(loadInitialCreditBalances);
  
  // Services state (from Supabase)
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
      .single();

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

  // Load data on mount
  useEffect(() => {
    fetchPatients();
    fetchServices();
  }, []);

  // Clear localStorage on logout for security
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearAllStoredData();
        // Reset state after logout
        setPatients([]);
        setServices([]);
        setSessions(mockSessoes as unknown as Session[]);
        setProfessionals(mockProfissionais as Professional[]);
        setEvolutions(mockEvolucoes as Evolution[]);
        setCreditBalances({ ...mockCreditBalances });
        setCreditUsageMap({});
      } else if (event === 'SIGNED_IN') {
        // Refresh data when user signs in
        fetchPatients();
        fetchServices();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Persist sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, serializeSessions(sessions));
    } catch (e) {
      console.error("Error saving sessions to localStorage:", e);
    }
  }, [sessions]);

  // Persist professionals to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFESSIONALS, JSON.stringify(professionals));
    } catch (e) {
      console.error("Error saving professionals to localStorage:", e);
    }
  }, [professionals]);

  // Persist evolutions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EVOLUTIONS, JSON.stringify(evolutions));
    } catch (e) {
      console.error("Error saving evolutions to localStorage:", e);
    }
  }, [evolutions]);

  // Persist credit balances to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CREDIT_BALANCES, JSON.stringify(creditBalances));
    } catch (e) {
      console.error("Error saving credit balances to localStorage:", e);
    }
  }, [creditBalances]);

  const addPatient = (patient: Patient) => {
    setPatients((prev) => [...prev, patient]);
    // Initialize credit balance for new patient
    setCreditBalances((prev) => ({ ...prev, [patient.id]: 0 }));
  };

  const updatePatient = (id: string, data: Partial<Patient>) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data } : p))
    );
  };

  const addSession = (session: Session) => {
    setSessions((prev) => [...prev, session]);
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

  // Credit balance functions (Ledger model simulation in localStorage)
  const getCreditBalance = (patientId: string): number => {
    return creditBalances[patientId] ?? 0;
  };

  const addCredits = (patientId: string, amount: number): void => {
    if (amount <= 0) return;
    setCreditBalances((prev) => ({
      ...prev,
      [patientId]: (prev[patientId] ?? 0) + amount,
    }));
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

    // Deduct credit and mark session as processed
    setCreditBalances((prev) => ({
      ...prev,
      [patientId]: prev[patientId] - 1,
    }));
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
    addSession,
    updateSession,
    professionals,
    addProfessional,
    updateProfessional,
    evolutions,
    addEvolution,
    creditBalances,
    getCreditBalance,
    addCredits,
    useCredit,
    refundCredit,
    wasCreditUsedForSession,
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
