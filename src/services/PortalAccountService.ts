import { supabase } from "@/integrations/supabase/client";

/**
 * Camada única de resolução da conta do Portal do Utente.
 *
 * Usa a função SQL `portal_resolve_account(uuid)` que filtra ligações órfãs
 * (paciente_id que já não existe), e ordena para colocar primeiro:
 *  - contas com onboarding completo
 *  - associações marcadas como primárias
 *  - registos mais recentes
 */

export type PortalAccountStatus =
  | "ok"               // conta válida, onboarding completo, pronto para o portal
  | "needs_onboarding" // conta válida mas onboarding ainda em curso
  | "no_valid_patient" // conta existe mas nenhum utente válido associado
  | "no_account";      // não existe conta de portal para este utilizador

export interface PortalAccountResolution {
  status: PortalAccountStatus;
  contaId: string | null;
  primaryPacienteId: string | null;
  pacienteIds: string[];
  onboardingCompleto: boolean;
  pacienteNome: string | null;
}

interface ResolveRow {
  conta_id: string;
  paciente_id: string;
  onboarding_completo: boolean;
  is_primary: boolean;
  paciente_nome: string | null;
}

export class PortalAccountService {
  /**
   * Resolve a melhor conta válida para o utilizador autenticado.
   * Nunca lança — devolve sempre um objeto com `status` claro.
   */
  static async resolveForUser(userId: string): Promise<PortalAccountResolution> {
    try {
      const { data, error } = await (supabase as any).rpc("portal_resolve_account", {
        p_user_id: userId,
      });

      if (error) {
        console.error("portal_resolve_account error:", error);
      }

      const rows: ResolveRow[] = Array.isArray(data) ? data : [];

      if (rows.length === 0) {
        // Sem associações válidas — verificar se existe ao menos a conta
        const { data: contaSolta } = await (supabase as any)
          .from("portal_contas")
          .select("id, onboarding_completo")
          .eq("auth_user_id", userId)
          .maybeSingle();

        if (!contaSolta) {
          return {
            status: "no_account",
            contaId: null,
            primaryPacienteId: null,
            pacienteIds: [],
            onboardingCompleto: false,
            pacienteNome: null,
          };
        }

        return {
          status: "no_valid_patient",
          contaId: contaSolta.id,
          primaryPacienteId: null,
          pacienteIds: [],
          onboardingCompleto: !!contaSolta.onboarding_completo,
          pacienteNome: null,
        };
      }

      // A função SQL já agrupou por melhor conta primeiro. Pegar a contaId
      // do primeiro registo e devolver TODOS os pacientes ligados a essa conta.
      const primary = rows[0];
      const sameAccountRows = rows.filter((r) => r.conta_id === primary.conta_id);
      const pacienteIds = sameAccountRows.map((r) => r.paciente_id);

      return {
        status: primary.onboarding_completo ? "ok" : "needs_onboarding",
        contaId: primary.conta_id,
        primaryPacienteId: primary.paciente_id,
        pacienteIds,
        onboardingCompleto: !!primary.onboarding_completo,
        pacienteNome: primary.paciente_nome,
      };
    } catch (err) {
      console.error("PortalAccountService.resolveForUser failed:", err);
      return {
        status: "no_account",
        contaId: null,
        primaryPacienteId: null,
        pacienteIds: [],
        onboardingCompleto: false,
        pacienteNome: null,
      };
    }
  }

  /**
   * Cria/atualiza uma conta do portal de forma idempotente para o
   * `auth_user_id` indicado e garante a associação ao `paciente_id`.
   * Usado nos fluxos de signup por email e OAuth Google.
   */
  static async ensureAccountAndLink(params: {
    authUserId: string;
    pacienteId: string;
    email: string | null;
    provider: "email" | "google";
  }): Promise<string | null> {
    const { authUserId, pacienteId, email, provider } = params;

    try {
      // 1) Procurar conta existente para este auth_user_id
      const { data: existing } = await (supabase as any)
        .from("portal_contas")
        .select("id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      let contaId: string | null = existing?.id ?? null;

      if (!contaId) {
        // 2) Não existe — criar (idempotência protegida pela query acima)
        const { data: created, error } = await (supabase as any)
          .from("portal_contas")
          .insert({
            auth_user_id: authUserId,
            paciente_id: pacienteId,
            email,
            provider,
          })
          .select("id")
          .single();

        if (error) {
          console.error("Failed to create portal_contas:", error);
          return null;
        }
        contaId = created?.id ?? null;
      }

      if (!contaId) return null;

      // 3) Garantir associação conta↔paciente (índice único protege duplicados)
      const { data: existingLink } = await (supabase as any)
        .from("portal_conta_pacientes")
        .select("id")
        .eq("conta_id", contaId)
        .eq("paciente_id", pacienteId)
        .maybeSingle();

      if (!existingLink) {
        await (supabase as any).from("portal_conta_pacientes").insert({
          conta_id: contaId,
          paciente_id: pacienteId,
          relacao: "responsavel",
          is_primary: true,
        });
      }

      return contaId;
    } catch (err) {
      console.error("ensureAccountAndLink failed:", err);
      return null;
    }
  }
}
