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

export default function PortalResetPassword() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase password recovery: when the user clicks the email link,
    // the SDK fires PASSWORD_RECOVERY with a temporary session attached.
    // We listen for it, and also check if a session is already present.
    let resolved = false;

    const finish = (ok: boolean) => {
      if (resolved) return;
      resolved = true;
      setStage(ok ? "ready" : "no-token");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        finish(true);
      }
    });

    // Fallback: check session immediately (link may already have been processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish(true);
    });

    // Hard timeout — if no recovery event arrives in 4s assume invalid/expired link
    const timeout = setTimeout(() => finish(false), 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
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
                O link de recuperação é inválido ou expirou. Peça um novo link na página de login.
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
