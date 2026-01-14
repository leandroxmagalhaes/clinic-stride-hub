// DataContext - Centralized state management with localStorage persistence
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Patient } from "@/services/PatientService";
import { Session } from "@/services/SessionService";
import { mockPacientes, mockSessoes, mockProfissionais, mockServicos } from "@/lib/mock-data";

const STORAGE_KEYS = {
  PATIENTS: "physione_patients",
  SESSIONS: "physione_sessions",
};

interface DataContextType {
  // Patients
  patients: Patient[];
  addPatient: (patient: Patient) => void;
  updatePatient: (id: string, data: Partial<Patient>) => void;
  
  // Sessions
  sessions: Session[];
  addSession: (session: Session) => void;
  updateSession: (id: string, data: Partial<Session>) => void;
  
  // Static data (from mocks, read-only for now)
  professionals: typeof mockProfissionais;
  services: typeof mockServicos;
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

// Load initial data from localStorage or use mock data
function loadInitialPatients(): Patient[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PATIENTS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Error loading patients from localStorage:", e);
  }
  return mockPacientes as Patient[];
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

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const [patients, setPatients] = useState<Patient[]>(loadInitialPatients);
  const [sessions, setSessions] = useState<Session[]>(loadInitialSessions);

  // Persist patients to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
    } catch (e) {
      console.error("Error saving patients to localStorage:", e);
    }
  }, [patients]);

  // Persist sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, serializeSessions(sessions));
    } catch (e) {
      console.error("Error saving sessions to localStorage:", e);
    }
  }, [sessions]);

  const addPatient = (patient: Patient) => {
    setPatients((prev) => [...prev, patient]);
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

  const value: DataContextType = {
    patients,
    addPatient,
    updatePatient,
    sessions,
    addSession,
    updateSession,
    professionals: mockProfissionais,
    services: mockServicos,
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
