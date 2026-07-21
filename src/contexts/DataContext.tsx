// DataContext - Centralized state management with 100% Supabase integration
// v2 — Sistema de Packs + Credit compatibility layer
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from "react";
import { Patient } from "@/services/PatientService";
import { Session } from "@/services/SessionService";
import { Professional } from "@/services/ProfessionalService";
import { Evolution } from "@/services/EvolutionService";
import { AuditService } from "@/services/AuditService";
import { CreditService } from "@/services/CreditService";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

// ── Service type ──────────────────────────────────────────────────────────────
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

// ── Pack type ─────────────────────────────────────────────────────────────────
export type PackStatus = "ativo" | "concluido" | "expirado" | "cancelado";
export type PackPaymentStatus = "pendente" | "pago" | "parcial";

export interface Pack {
  id: string;
  clinic_id: string;
  paciente_id: string;
  numero_pack: number;
  total_sessoes: number;
  valor_total: number;
  payment_status: PackPaymentStatus;
  payment_method: string | null;
  paid_at: string | null;
  data_inicio: string; // YYYY-MM-DD
  data_validade: string; // YYYY-MM-DD
  status: PackStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // computed
  sessoes_usadas: number;
  sessoes_agendadas: number;
  sessoes_disponiveis: number;
  sessoes_restantes: number;
  alert_status: "activo" | "penultima_sessao" | "ultima_sessao" | "esgotado";
  // compat aliases (deprecated, kept to ease migration)
  quantidade_sessoes: number;
  is_active: boolean;
}

// ── Context type ──────────────────────────────────────────────────────────────
interface DataContextType {
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

  // Services
  services: Service[];
  servicesLoading: boolean;
  addService: (data: Partial<Service>) => Promise<void>;
  updateService: (id: string, data: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  refreshServices: () => Promise<void>;

  // Packs
  packs: Pack[];
  packsLoading: boolean;
  addPack: (data: Partial<Pack> & { paciente_id: string; valor_total: number }) => Promise<Pack>;
  updatePack: (id: string, data: Partial<Pack>) => Promise<void>;
  deletePack: (id: string) => Promise<void>;
  refreshPacks: () => Promise<void>;
  getActivePack: (pacienteId: string) => Pack | null;
  associateSessionToPack: (sessionId: string, packId: string | null) => Promise<void>;
  incrementPackUsage: (packId: string) => Promise<void>;
  decrementPackUsage: (packId: string) => Promise<void>;

  // Credit compatibility layer (delegates to CreditService)
  getCreditBalance: (patientId: string) => number;
  addCredits: (patientId: string, amount: number) => Promise<void>;
  refundCredit: (sessionId: string) => Promise<void>;
  useCredit: (patientId: string, sessionId: string) => Promise<void>;
  wasCreditUsedForSession: (sessionId: string) => boolean;
  refreshCreditBalances: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalsLoading, setProfessionalsLoading] = useState(true);
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [evolutionsLoading, setEvolutionsLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [rawPacks, setRawPacks] = useState<any[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [creditBalances, setCreditBalances] = useState<Map<string, number>>(new Map());

  const cachedUserId = useRef<string | null>(null);
  const hasInitiallyLoaded = useRef(false);

  // ── Helper: calcular alert_status ────────────────────────────────────────
  const computeAlertStatus = (total: number, usadas: number): Pack["alert_status"] => {
    const restantes = total - usadas;
    if (restantes <= 0) return "esgotado";
    if (restantes === 1) return "ultima_sessao";
    if (restantes === 2) return "penultima_sessao";
    return "activo";
  };

  // Enrich a raw pack row with computed fields (sessoes_usadas counted from sessions array)
  const enrichPack = (p: any, sessionList: Session[] = []): Pack => {
    const usadas = sessionList.filter(
      (s: any) =>
        s.pack_id === p.id &&
        !s.isento &&
        ["realizado", "finalizado", "falta_cobrada"].includes(s.status),
    ).length;
    const agendadas = sessionList.filter(
      (s: any) =>
        s.pack_id === p.id &&
        !s.isento &&
        ["agendado", "confirmado"].includes(s.status),
    ).length;
    const total = p.total_sessoes ?? 0;
    return {
      ...p,
      sessoes_usadas: usadas,
      sessoes_agendadas: agendadas,
      sessoes_disponiveis: Math.max(total - usadas - agendadas, 0),
      sessoes_restantes: Math.max(total - usadas, 0),
      alert_status: computeAlertStatus(total, usadas),
      quantidade_sessoes: total,
      is_active: p.status === "ativo",
    };
  };

  // ── Fetch patients ────────────────────────────────────────────────────────
  const fetchPatients = async (silent = false) => {
    if (!silent) setPatientsLoading(true);
    try {
      const { data, error } = await supabase.from("pacientes").select("*").order("full_name");
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

  // ── Fetch sessions ────────────────────────────────────────────────────────
  const fetchSessions = async (silent = false) => {
    if (!silent) setSessionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("sessoes")
        .select(
          `
          *,
          paciente:pacientes(id, full_name, birth_date),
          profissional:profiles!sessoes_profissional_id_fkey(id, full_name),
          servico:servicos(id, name, color, duration_minutes, consumes_credit)
        `,
        )
        .order("start_time", { ascending: false });
      if (error) {
        console.error("Error fetching sessions:", error);
        return;
      }
      const transformed: Session[] = (data || []).map((s: any) => ({
        id: s.id,
        clinic_id: s.clinic_id,
        paciente_id: s.paciente_id,
        profissional_id: s.profissional_id,
        servico_id: s.servico_id,
        start_time: new Date(s.start_time),
        end_time: new Date(s.end_time),
        status: s.status,
        confirmacao_estado: s.confirmacao_estado ?? null,
        price: s.price || 0,
        payment_status: s.payment_status || "pendente",
        payment_method: s.payment_method,
        notes: s.notes,
        pack_id: s.pack_id ?? null,
        numero_no_pack: s.numero_no_pack ?? null,
        isento: s.isento ?? false,
        sem_cobranca: s.sem_cobranca ?? false,
        motivo_sem_cobranca: s.motivo_sem_cobranca ?? null,
        paciente: s.paciente,
        profissional: s.profissional,
        servico: s.servico,
      } as any));
      setSessions(transformed);
    } catch (err) {
      console.error("Exception fetching sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  };

  // ── Fetch professionals ───────────────────────────────────────────────────
  const fetchProfessionals = async (silent = false) => {
    if (!silent) setProfessionalsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role, specialty, crefito, avatar_url, is_active, clinic_id")
        .eq("is_active", true)
        .in("role", ["fisioterapeuta", "admin", "professional"])
        .order("full_name");
      if (error) {
        console.error("Error fetching professionals:", error);
        return;
      }
      setProfessionals(
        (data || []).map((p: any) => ({
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
        })),
      );
    } catch (err) {
      console.error("Exception fetching professionals:", err);
    } finally {
      setProfessionalsLoading(false);
    }
  };

  // ── Fetch evolutions ──────────────────────────────────────────────────────
  const fetchEvolutions = async (silent = false) => {
    if (!silent) setEvolutionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("evolucoes_clinicas")
        .select(`*, profissional:profiles!evolucoes_clinicas_profissional_id_fkey(id, full_name)`)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching evolutions:", error);
        return;
      }
      setEvolutions(
        (data || []).map((e: any) => ({
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
        })),
      );
    } catch (err) {
      console.error("Exception fetching evolutions:", err);
    } finally {
      setEvolutionsLoading(false);
    }
  };

  // ── Fetch services ────────────────────────────────────────────────────────
  const fetchServices = async (silent = false) => {
    if (!silent) setServicesLoading(true);
    try {
      const { data, error } = await supabase.from("servicos").select("*").eq("is_active", true).order("name");
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

  // ── Fetch packs ───────────────────────────────────────────────────────────
  const fetchPacks = async (silent = false) => {
    if (!silent) setPacksLoading(true);
    try {
      const { data, error } = await supabase.from("packs").select("*").order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching packs:", error);
        return;
      }
      setPacks((data || []).map((p) => enrichPack(p)));
    } catch (err) {
      console.error("Exception fetching packs:", err);
    } finally {
      setPacksLoading(false);
    }
  };

  // ── Load all on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    const initLoad = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        cachedUserId.current = session?.user?.id ?? null;
        await Promise.all([
          fetchPatients(),
          fetchServices(),
          fetchSessions(),
          fetchProfessionals(),
          fetchEvolutions(),
          fetchPacks(),
        ]);
        hasInitiallyLoaded.current = true;
      } catch (err) {
        console.error("Error during initial data load:", err);
        setPatientsLoading(false);
        setSessionsLoading(false);
        setProfessionalsLoading(false);
        setServicesLoading(false);
        setEvolutionsLoading(false);
        setPacksLoading(false);
      }
    };
    initLoad();
  }, []);

  // ── Auth state changes ────────────────────────────────────────────────────
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        cachedUserId.current = null;
        hasInitiallyLoaded.current = false;
        setPatients([]);
        setServices([]);
        setSessions([]);
        setProfessionals([]);
        setEvolutions([]);
        setPacks([]);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const userId = session?.user?.id ?? null;
        setTimeout(() => {
          if (userId === cachedUserId.current && hasInitiallyLoaded.current) {
            fetchPatients(true);
            fetchServices(true);
            fetchSessions(true);
            fetchProfessionals(true);
            fetchEvolutions(true);
            fetchPacks(true);
          } else {
            cachedUserId.current = userId;
            hasInitiallyLoaded.current = true;
            fetchPatients();
            fetchServices();
            fetchSessions();
            fetchProfessionals();
            fetchEvolutions();
            fetchPacks();
          }
        }, 0);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Patient CRUD ──────────────────────────────────────────────────────────
  const addPatient = (patient: Patient) => setPatients((prev) => [...prev, patient]);
  const updatePatient = (id: string, data: Partial<Patient>) =>
    setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));

  const deletePatient = async (patientId: string, reason?: string): Promise<void> => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) throw new Error("Paciente não encontrado");
    const { error } = await supabase.from("pacientes").update({ is_active: false }).eq("id", patientId);
    if (error) throw error;
    await AuditService.log({
      action: "delete",
      entityType: "patient",
      entityId: patientId,
      entityName: patient.full_name,
      details: { reason, previousData: { email: patient.email, phone: patient.phone } },
    });
    await fetchPatients();
  };

  // ── Session CRUD ──────────────────────────────────────────────────────────
  const addSession = async (session: Session): Promise<void> => {
    const { getAuthContext } = await import("@/lib/auth-helpers");
    const { clinicId } = await getAuthContext();
    const insertPayload: Record<string, unknown> = {
      clinic_id: clinicId,
      paciente_id: session.paciente_id,
      profissional_id: session.profissional_id,
      servico_id: session.servico_id,
      start_time: session.start_time instanceof Date ? session.start_time.toISOString() : session.start_time,
      end_time: session.end_time instanceof Date ? session.end_time.toISOString() : session.end_time,
      status: session.status,
      notes: session.notes,
      price: session.price,
      payment_status: session.payment_status,
    };
    if (session.payment_method) insertPayload.payment_method = session.payment_method;
    const _packId = (session as any).pack_id ?? (session as any).package_id;
    if (_packId) insertPayload.pack_id = _packId;

    const { data, error } = await supabase
      .from("sessoes")
      .insert(insertPayload as any)
      .select(
        `
        *,
        paciente:pacientes(id, full_name, birth_date),
        profissional:profiles!sessoes_profissional_id_fkey(id, full_name),
        servico:servicos(id, name, color, duration_minutes, consumes_credit)
      `,
      )
      .single();
    if (error) throw error;

    const newSession: any = {
      id: data.id,
      clinic_id: data.clinic_id,
      paciente_id: data.paciente_id,
      profissional_id: data.profissional_id,
      servico_id: data.servico_id,
      start_time: new Date(data.start_time),
      end_time: new Date(data.end_time),
      status: data.status,
      price: data.price || 0,
      payment_status: data.payment_status || "pendente",
      payment_method: data.payment_method,
      notes: data.notes,
      pack_id: (data as any).pack_id ?? null,
      numero_no_pack: (data as any).numero_no_pack ?? null,
      sem_cobranca: (data as any).sem_cobranca ?? false,
      motivo_sem_cobranca: (data as any).motivo_sem_cobranca ?? null,
      paciente: data.paciente,
      profissional: data.profissional,
      servico: data.servico,
    };
    setSessions((prev) => [newSession, ...prev]);
    fetchPacks(true);
  };

  const updateSession = async (id: string, data: Partial<Session>): Promise<void> => {
    const updateData: Record<string, unknown> = {};
    if (data.start_time !== undefined)
      updateData.start_time = data.start_time instanceof Date ? data.start_time.toISOString() : data.start_time;
    if (data.end_time !== undefined)
      updateData.end_time = data.end_time instanceof Date ? data.end_time.toISOString() : data.end_time;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.payment_status !== undefined) updateData.payment_status = data.payment_status;
    if (data.payment_method !== undefined) updateData.payment_method = data.payment_method;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.profissional_id !== undefined) updateData.profissional_id = data.profissional_id;
    if (data.servico_id !== undefined) updateData.servico_id = data.servico_id;
    if ((data as any).paciente_id !== undefined) updateData.paciente_id = (data as any).paciente_id;
    const _newPackId = (data as any).pack_id ?? (data as any).package_id;
    if (_newPackId !== undefined) updateData.pack_id = _newPackId;
    if ((data as any).isento !== undefined) updateData.isento = (data as any).isento;
    const { error } = await supabase.from("sessoes").update(updateData as any).eq("id", id);
    if (error) throw error;
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    fetchPacks(true);
  };

  const deleteSession = async (sessionId: string, reason?: string): Promise<void> => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error("Sessão não encontrada");
    if (session.status === "realizado") throw new Error("Sessões finalizadas não podem ser apagadas");
    const { error } = await supabase.from("sessoes").delete().eq("id", sessionId);
    if (error) throw error;
    await AuditService.log({
      action: "delete",
      entityType: "session",
      entityId: sessionId,
      entityName: `${session.paciente?.full_name || "Paciente"} - ${format(new Date(session.start_time), "dd/MM HH:mm")}`,
      details: { reason, patient: session.paciente?.full_name, service: session.servico?.name, status: session.status },
    });
    await fetchSessions();
  };

  // ── Professional CRUD ─────────────────────────────────────────────────────
  const addProfessional = (p: Professional) => setProfessionals((prev) => [...prev, p]);
  const updateProfessional = (id: string, data: Partial<Professional>) =>
    setProfessionals((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  const deleteProfessional = async (professionalId: string, reason?: string): Promise<void> => {
    const professional = professionals.find((p) => p.id === professionalId);
    if (!professional) throw new Error("Profissional não encontrado");
    const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", professionalId);
    if (error) throw error;
    await AuditService.log({
      action: "delete",
      entityType: "professional",
      entityId: professionalId,
      entityName: professional.full_name,
      details: { reason },
    });
    await fetchProfessionals();
  };

  // ── Evolution CRUD ────────────────────────────────────────────────────────
  const addEvolution = (evolution: Evolution) => setEvolutions((prev) => [evolution, ...prev]);

  // ── Service CRUD ──────────────────────────────────────────────────────────
  const addService = async (data: Partial<Service>): Promise<void> => {
    const { getAuthContext } = await import("@/lib/auth-helpers");
    const { clinicId } = await getAuthContext();
    const { error } = await supabase.from("servicos").insert({
      name: data.name!,
      description: data.description || null,
      duration_minutes: data.duration_minutes || 60,
      price: data.price || 0,
      consumes_credit: data.consumes_credit ?? false,
      color: data.color || "#10B981",
      clinic_id: clinicId,
    });
    if (error) throw error;
    await fetchServices();
  };

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

  const deleteService = async (id: string): Promise<void> => {
    const service = services.find((s) => s.id === id);
    const { error } = await supabase.from("servicos").update({ is_active: false }).eq("id", id);
    if (error) throw error;
    if (service)
      await AuditService.log({
        action: "delete",
        entityType: "service",
        entityId: id,
        entityName: service.name,
        details: {},
      });
    await fetchServices();
  };

  // ── Pack CRUD ─────────────────────────────────────────────────────────────
  const addPack: DataContextType["addPack"] = async (data: any) => {
    const { getAuthContext } = await import("@/lib/auth-helpers");
    const { clinicId } = await getAuthContext();
    const totalSessoes = data.total_sessoes ?? data.quantidade_sessoes ?? 10;
    const payload: Record<string, unknown> = {
      clinic_id: clinicId,
      paciente_id: data.paciente_id,
      total_sessoes: totalSessoes,
      valor_total: data.valor_total,
      payment_status: data.payment_status ?? "pendente",
      payment_method: data.payment_method ?? null,
      paid_at: data.paid_at ?? null,
      notes: data.notes ?? null,
    };
    if (data.data_inicio) payload.data_inicio = data.data_inicio;
    if (data.data_validade) payload.data_validade = data.data_validade;

    const { data: created, error } = await (supabase as any)
      .from("packs")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    const enriched = enrichPack(created, sessions);
    setPacks((prev) => [enriched, ...prev]);
    return enriched;
  };

  const updatePack = async (id: string, data: Partial<Pack>): Promise<void> => {
    const updateData: Record<string, unknown> = {};
    if (data.data_inicio !== undefined) updateData.data_inicio = data.data_inicio;
    if (data.data_validade !== undefined) updateData.data_validade = data.data_validade;
    if (data.total_sessoes !== undefined) updateData.total_sessoes = data.total_sessoes;
    if ((data as any).quantidade_sessoes !== undefined && data.total_sessoes === undefined)
      updateData.total_sessoes = (data as any).quantidade_sessoes;
    if (data.valor_total !== undefined) updateData.valor_total = data.valor_total;
    if (data.payment_status !== undefined) updateData.payment_status = data.payment_status;
    if (data.payment_method !== undefined) updateData.payment_method = data.payment_method;
    if (data.paid_at !== undefined) updateData.paid_at = data.paid_at;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;
    const { error } = await (supabase as any).from("packs").update(updateData).eq("id", id);
    if (error) throw error;
    setPacks((prev) => prev.map((p) => (p.id === id ? enrichPack({ ...p, ...updateData }, sessions) : p)));
  };

  const deletePack = async (id: string): Promise<void> => {
    const { error } = await supabase.from("packs").delete().eq("id", id);
    if (error) throw error;
    setPacks((prev) => prev.filter((p) => p.id !== id));
    await fetchSessions();
  };

  const associateSessionToPack = async (sessionId: string, packId: string | null): Promise<void> => {
    const { error } = await (supabase as any).from("sessoes").update({ pack_id: packId }).eq("id", sessionId);
    if (error) throw error;
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? ({ ...s, pack_id: packId } as any) : s)));
    await fetchPacks(true);
  };

  // Pack usage is auto-recomputed by DB triggers; these are no-ops kept for compat
  const incrementPackUsage = async (_packId: string): Promise<void> => { await fetchPacks(true); };
  const decrementPackUsage = async (_packId: string): Promise<void> => { await fetchPacks(true); };

  const getActivePack = (pacienteId: string): Pack | null => {
    return packs.find((p) => p.paciente_id === pacienteId && p.is_active) ?? null;
  };

  // ── Credit compatibility layer ─────────────────────────────────────────────
  const fetchCreditBalances = async () => {
    try {
      const patientIds = patients.map((p) => p.id);
      if (patientIds.length === 0) return;
      const balances = await CreditService.getBalancesBatch(patientIds);
      setCreditBalances(balances);
    } catch (err) {
      console.error("Error fetching credit balances:", err);
    }
  };

  // Fetch balances when patients change
  useEffect(() => {
    if (patients.length > 0) {
      fetchCreditBalances();
    }
  }, [patients]);

  const getCreditBalance = useCallback(
    (patientId: string): number => {
      return creditBalances.get(patientId) ?? 0;
    },
    [creditBalances],
  );

  const addCreditsHandler = async (patientId: string, amount: number): Promise<void> => {
    const { getAuthContext } = await import("@/lib/auth-helpers");
    const { clinicId } = await getAuthContext();
    const result = await CreditService.purchaseCredits(clinicId, patientId, amount);
    if (!result.success) throw new Error(result.error);
    await fetchCreditBalances();
  };

  const refundCreditHandler = async (sessionId: string): Promise<void> => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const { getAuthContext } = await import("@/lib/auth-helpers");
    const { clinicId } = await getAuthContext();
    await CreditService.refundCredit(clinicId, session.paciente_id, sessionId);
    await fetchCreditBalances();
  };

  const useCreditHandler = async (patientId: string, sessionId: string): Promise<void> => {
    const { getAuthContext } = await import("@/lib/auth-helpers");
    const { clinicId } = await getAuthContext();
    await CreditService.useCredit(clinicId, patientId, sessionId);
    await fetchCreditBalances();
  };

  const wasCreditUsedForSession = useCallback(
    (sessionId: string): boolean => {
      // Check if the session has payment_status 'reservado' (credit reserved)
      const session = sessions.find((s) => s.id === sessionId);
      return session?.payment_status === "reservado" || session?.payment_status === "pago";
    },
    [sessions],
  );

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
    services,
    servicesLoading,
    addService,
    updateService,
    deleteService,
    refreshServices: fetchServices,
    packs,
    packsLoading,
    addPack,
    updatePack,
    deletePack,
    refreshPacks: fetchPacks,
    getActivePack,
    associateSessionToPack,
    incrementPackUsage,
    decrementPackUsage,
    getCreditBalance,
    addCredits: addCreditsHandler,
    refundCredit: refundCreditHandler,
    useCredit: useCreditHandler,
    wasCreditUsedForSession,
    refreshCreditBalances: fetchCreditBalances,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) throw new Error("useData must be used within a DataProvider");
  return context;
}
