import { useEffect, useState } from "react";
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
 * Handles password recovery links from Supabase.
 * Supports all return formats:
 *  - Hash with access_token + refresh_token + type=recovery (implicit flow)
 *  - Query string with code= (PKCE flow)
 *  - Query string with token_hash + type=recovery
 *  - Existing session (event PASSWORD_RECOVERY)
 *  - Error in hash/query (expired/invalid link)
 */
export default function PortalResetPassword() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("checking");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const finishOk = () => {
      if (cancelled) return;
      setStage("ready");
    };

    const finishFail = (msg?: string) => {
      if (cancelled) return;
      if (msg) setErrorMsg(msg);
      setStage("no-token");
    };

    // Listen for PASSWORD_RECOVERY event (Supabase fires this when it detects the link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") {
        finishOk();
      } else if (event === "SIGNED_IN" && session) {
        finishOk();
      }
    });

    const processLink = async () => {
      try {
        // 1) Read URL parts
        const rawHash = window.location.hash?.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash || "";
        const hashParams = new URLSearchParams(rawHash);
        const queryParams = new URLSearchParams(window.location.search);

        const hashError =
          hashParams.get("error_description") ||
          hashParams.get("error_code") ||
          hashParams.get("error");
        const queryError =
          queryParams.get("error_description") ||
          queryParams.get("error_code") ||
          queryParams.get("error");

        if (hashError || queryError) {
          finishFail(decodeURIComponent(hashError || queryError || ""));
          return;
        }

        // 2) Implicit flow — tokens in hash
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          // Clean hash from URL so refresh doesn't reuse tokens
          window.history.replaceState(null, "", window.location.pathname);
          if (error) {
            finishFail(error.message);
            return;
          }
          finishOk();
          return;
        }

        // 3) PKCE flow — code in query string
        const code = queryParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          window.history.replaceState(null, "", window.location.pathname);
          if (error) {
            finishFail(error.message);
            return;
          }
          finishOk();
          return;
        }

        // 4) OTP token_hash flow
        const tokenHash = queryParams.get("token_hash") || hashParams.get("token_hash");
        const type = queryParams.get("type") || hashParams.get("type");
        if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });
          window.history.replaceState(null, "", window.location.pathname);
          if (error) {
            finishFail(error.message);
            return;
          }
          finishOk();
          return;
        }

        // 5) Maybe a session is already there (link processed by SDK before mount)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          finishOk();
          return;
        }

        // 6) Last resort — wait briefly for PASSWORD_RECOVERY event from listener
        setTimeout(() => {
          if (cancelled) return;
          if (stage === "checking") finishFail("Link inválido ou expirado.");
        }, 3500);
      } catch (e: any) {
        finishFail(e?.message || "Não foi possível validar o link.");
      }
    };

    processLink();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Sign out so the user logs in fresh with the new password
    await supabase.auth.signOut();
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
              <p className="text-sm text-muted-foreground">
                {errorMsg
                  ? `O link de recuperação é inválido ou expirou. (${errorMsg})`
                  : "O link de recuperação é inválido ou expirou. Peça um novo link na página de login."}
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
