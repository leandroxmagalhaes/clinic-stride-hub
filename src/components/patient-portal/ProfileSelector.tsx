import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInYears } from "date-fns";

interface PatientProfile {
  paciente_id: string;
  relacao: string;
  is_primary: boolean;
  full_name: string;
  birth_date: string | null;
  unreadCount: number;
}

interface ProfileSelectorProps {
  contaId: string;
  onSelect: (pacienteId: string) => void;
}

const RELATION_LABELS: Record<string, string> = {
  responsavel: "Responsável",
  proprio: "Próprio",
  cuidador: "Cuidador",
  outro: "Outro",
};

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAge(birthDate: string | null): string {
  if (!birthDate) return "";
  const years = differenceInYears(new Date(), new Date(birthDate));
  if (years < 1) {
    const months = Math.floor((new Date().getTime() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
    return `${months} meses`;
  }
  return `${years} anos`;
}

export function ProfileSelector({ contaId, onSelect }: ProfileSelectorProps) {
  const [profiles, setProfiles] = useState<PatientProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfiles();
  }, [contaId]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      // Get linked patients
      const { data: links } = await (supabase as any)
        .from("portal_conta_pacientes")
        .select("paciente_id, relacao, is_primary")
        .eq("conta_id", contaId);

      if (!links || links.length === 0) {
        setProfiles([]);
        setLoading(false);
        return;
      }

      const patientIds = links.map((l: any) => l.paciente_id);

      // Get patient details
      const { data: patients } = await supabase
        .from("pacientes")
        .select("id, full_name, birth_date")
        .in("id", patientIds);

      // Get unread notifications per patient
      const { data: unread } = await (supabase as any)
        .from("portal_notificacoes")
        .select("paciente_id")
        .in("paciente_id", patientIds)
        .eq("lida", false);

      const unreadMap: Record<string, number> = {};
      (unread || []).forEach((n: any) => {
        unreadMap[n.paciente_id] = (unreadMap[n.paciente_id] || 0) + 1;
      });

      const result: PatientProfile[] = links.map((link: any) => {
        const patient = (patients || []).find((p: any) => p.id === link.paciente_id);
        return {
          paciente_id: link.paciente_id,
          relacao: link.relacao || "responsavel",
          is_primary: link.is_primary,
          full_name: patient?.full_name || "Paciente",
          birth_date: patient?.birth_date || null,
          unreadCount: unreadMap[link.paciente_id] || 0,
        };
      });

      // Primary first, then alphabetical
      result.sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return a.full_name.localeCompare(b.full_name);
      });

      setProfiles(result);
    } catch (err) {
      console.error("Error loading profiles:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-md w-full space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl bg-[#1e40af] flex items-center justify-center text-white font-bold text-lg">
          P
        </div>
        <div>
          <p className="font-bold text-foreground">Physione</p>
          <p className="text-[10px] text-muted-foreground">Portal do Paciente</p>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-6">Quem está a aceder?</h2>

      <div className={`grid gap-4 w-full max-w-md ${profiles.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {profiles.map((profile, i) => (
          <Card
            key={profile.paciente_id}
            className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 relative"
            onClick={() => onSelect(profile.paciente_id)}
          >
            <CardContent className="flex flex-col items-center py-6 px-3 text-center">
              {/* Unread badge */}
              {profile.unreadCount > 0 && (
                <div className="absolute top-2 right-2">
                  <Badge variant="destructive" className="text-[10px] h-5 min-w-5 flex items-center justify-center">
                    {profile.unreadCount}
                  </Badge>
                </div>
              )}

              {/* Avatar */}
              <div className={`h-16 w-16 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white text-xl font-bold mb-3`}>
                {getInitials(profile.full_name)}
              </div>

              {/* Name */}
              <p className="font-semibold text-sm leading-tight mb-1">{profile.full_name}</p>

              {/* Age */}
              {profile.birth_date && (
                <p className="text-xs text-muted-foreground">{getAge(profile.birth_date)}</p>
              )}

              {/* Relation */}
              <Badge variant="outline" className="mt-2 text-[10px]">
                {RELATION_LABELS[profile.relacao] || profile.relacao}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
