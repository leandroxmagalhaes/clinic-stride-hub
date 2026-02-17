import { supabase } from "@/integrations/supabase/client";

interface AuthContext {
  userId: string;
  clinicId: string;
}

/**
 * Get userId and clinicId using getSession() (local read, no HTTP).
 * Throws if not authenticated or no clinic found.
 */
export async function getAuthContext(): Promise<AuthContext> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Utilizador não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!profile?.clinic_id) throw new Error("Clínica não encontrada");

  return { userId: session.user.id, clinicId: profile.clinic_id };
}

/**
 * Get only userId using getSession() (local read, no HTTP).
 * For services that only need the user ID (e.g. PatientDiaryService, UserRoleService).
 */
export async function getAuthUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Utilizador não autenticado");
  return session.user.id;
}

/**
 * Get userId and clinicId + email using getSession() (local read).
 * For AuditService which also needs the email.
 */
export async function getAuthContextWithEmail(): Promise<AuthContext & { email: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Utilizador não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, email")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!profile?.clinic_id) throw new Error("Clínica não encontrada");

  return {
    userId: session.user.id,
    clinicId: profile.clinic_id,
    email: profile.email || session.user.email || null,
  };
}
