import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";

type Stage = "checking" | "ready" | "no-token" | "done";

/**
 * Página de redefinição de senha do Portal.
 *
 * Esta página processa a URL de recuperação de forma totalmente determinística:
 *  - Não depende de `onAuthStateChange` (evita corridas com AuthContext / DataContext).
 *  - Processa apenas UMA vez por carregamento (guard via ref).
 *  - Suporta os 3 formatos de retorno do Supabase:
 *      a) Hash:  #access_token=...&refresh_token=...&type=recovery
 *      b) Query: ?code=...                       (PKCE)
 *      c) Query: ?token_hash=...&type=recovery   (verifyOtp)
 *  - Aceita ainda uma sessão válida pré-existente apenas se a URL indicar recovery
 *    (evita que sessões antigas “mascarem” o reset).
 */
export default function PortalResetPassword() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("checking");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Guarda contra duplo processamento (StrictMode em dev faz mount duplo).
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const friendly = (raw?: string | null): string => {
      if (!raw) return "Este link já foi usado ou expirou. Peça um novo link e abra-o uma única vez no mesmo dispositivo.";
      const s = String(raw);
      if (/aborted|abort/i.test(s)) {
        return "O link parece ter sido aberto duas vezes (alguns clientes de email pré-visitam links). Peça um novo link e abra-o apenas uma vez.";
      }
      if (/expired|invalid|not.?found|otp_expired|access_denied/i.test(s)) {
        return "Este link já foi usado ou expirou. Peça um novo link e abra-o uma única vez.";
      }
      return s;
    };

    const fail = (msg?: string | null) => {
      setErrorMsg(friendly(msg));
      setStage("no-token");
    };

    const ok = () => setStage("ready");

    const cleanUrl = () => {
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch {
        /* noop */
      }
    };

    const run = async () => {
      try {
        const rawHash = window.location.hash?.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash || "";
        const hashParams = new URLSearchParams(rawHash);
        const queryParams = new URLSearchParams(window.location.search);

        // 0) Erros explícitos no link
        const explicitError =
          hashParams.get("error_description") ||
          hashParams.get("error_code") ||
          hashParams.get("error") ||
          queryParams.get("error_description") ||
          queryParams.get("error_code") ||
          queryParams.get("error");
        if (explicitError) {
          cleanUrl();
          fail(decodeURIComponent(explicitError));
          return;
        }

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const code = queryParams.get("code");
        const tokenHash = queryParams.get("token_hash") || hashParams.get("token_hash");
        const type = queryParams.get("type") || hashParams.get("type");

        const urlIndicatesRecovery =
          !!(accessToken && refreshToken) ||
          !!code ||
          (!!tokenHash && type === "recovery") ||
          type === "recovery";

        // 1) Implicit flow (hash)
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          cleanUrl();
          if (error) return fail(error.message);
          return ok();
        }

        // 2) PKCE flow (?code=)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          cleanUrl();
          if (error) return fail(error.message);
          return ok();
        }

        // 3) OTP token_hash (?token_hash=&type=recovery)
        if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });
          cleanUrl();
          if (error) return fail(error.message);
          return ok();
        }

        // 4) Já existe sessão e URL indica recovery — aceitar
        const { data: { session } } = await supabase.auth.getSession();
        if (session && urlIndicatesRecovery) {
          return ok();
        }

        // 5) Nada utilizável
        fail(null);
      } catch (e: any) {
        fail(e?.message || null);
      }
    };

    run();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error("Erro ao redefinir a senha", { description: error.message });
      return;
    }
    setStage("done");
    toast.success("Senha redefinida com sucesso!");
    // Termina a sessão temporária para o utilizador entrar com a nova senha.
    try {
      await supabase.auth.signOut();
    } catch {
      /* noop */
    }
    setTimeout(() => navigate("/portal/login", { replace: true }), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-background to-blue-100/30 p-4">
      <Card className="w-full max-w-[420px]">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-[#1e40af] flex items-center justify-center text-white font-bold text-xl">
              P
            </div>
          </div>
          <CardTitle className="text-2xl">Redefinir senha</CardTitle>
          <CardDescription>Portal do Paciente · Respira & Desenvolve</CardDescription>
        </CardHeader>

        <CardContent>
          {stage === "checking" && (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">A validar o link…</p>
            </div>
          )}

          {stage === "no-token" && (
            <div className="text-center space-y-4 py-4">
              <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <p className="text-xs text-muted-foreground">
                Dica: peça um novo link e abra-o apenas uma vez, no mesmo dispositivo onde vai definir a nova senha.
              </p>
              <Button onClick={() => navigate("/portal/login")} className="w-full">
                Voltar ao login
              </Button>
            </div>
          )}

          {stage === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex gap-2">
                <KeyRound className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Defina uma nova senha. Mínimo 8 caracteres.</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Redefinir senha
              </Button>
            </form>
          )}

          {stage === "done" && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Senha redefinida! A redirecionar para o login…
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
