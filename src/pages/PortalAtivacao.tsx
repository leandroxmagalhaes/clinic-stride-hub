import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ShieldCheck, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import PortalErrorScreen from "@/components/portal/PortalErrorScreen";
import { toast } from "sonner";

type Stage = "loading" | "error" | "form" | "creating" | "success";

interface InviteData {
  paciente_id: string;
  enviado_para_email: string | null;
  expira_em: string;
  template_id: string | null;
  paciente_nome?: string;
}

export default function PortalAtivacao() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loadInvite = useCallback(async () => {
    if (!token) {
      setErrorMessage("Link inválido.");
      setStage("error");
      return;
    }

    // Forçar logout de qualquer sessão guardada (profissional, admin, outro paciente)
    // antes de processar o link de activação. Evita conflitos de sessão.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.signOut();
      }
    } catch {
      /* ignore */
    }

    const { data: rows, error } = await (supabase as any)
      .rpc("get_portal_invite_by_token", { p_token: token });
    const data = Array.isArray(rows) ? rows[0] : rows;

    if (error || !data) {
      setErrorMessage("not_found");
      setStage("error");
      return;
    }

    if (data.tipo !== "magic_link") {
      setErrorMessage("Este link usa o sistema antigo. Será redirecionado.");
      setTimeout(() => navigate(`/portal/verificacao/${token}`), 1500);
      return;
    }

    if (data.utilizado) {
      setErrorMessage("used");
      setStage("error");
      return;
    }

    if (new Date(data.expira_em) < new Date()) {
      setErrorMessage("expired");
      setStage("error");
      return;
    }

    // Fetch patient name
    const { data: patient } = await (supabase as any)
      .from("pacientes")
      .select("full_name")
      .eq("id", data.paciente_id)
      .maybeSingle();

    setInvite({
      paciente_id: data.paciente_id,
      enviado_para_email: data.enviado_para_email,
      expira_em: data.expira_em,
      template_id: data.template_id,
      paciente_nome: patient?.full_name,
    });
    setStage("form");
  }, [token, navigate]);

  useEffect(() => {
    loadInvite();
  }, [loadInvite]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A password deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As passwords não coincidem.");
      return;
    }

    setStage("creating");
    try {
      const { data, error } = await supabase.functions.invoke("activate-portal-magic-link", {
        body: { token, password },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Set session manually using returned tokens
      if (data?.access_token && data?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
      }

      setStage("success");
      toast.success("Conta ativada com sucesso!");
      setTimeout(() => {
        navigate("/portal/onboarding");
      }, 1200);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao ativar conta");
      setStage("form");
    }
  };

  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (stage === "error") {
    return <PortalErrorScreen reason={errorMessage} onLogin={() => navigate("/portal/login")} />;
  }

  if (stage === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Conta criada!</CardTitle>
            <CardDescription>A redirecionar para o portal...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Ative o seu acesso ao Portal</CardTitle>
          <CardDescription>
            {invite?.paciente_nome ? `Olá, ${invite.paciente_nome.split(" ")[0]}! ` : ""}
            Defina uma password para começar a usar o Portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={invite?.enviado_para_email || ""} disabled className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="pwd">Nova password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="pwd"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  disabled={stage === "creating"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirm">Confirmar password</Label>
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={stage === "creating"}
                className="mt-1.5"
              />
            </div>
            <Button type="submit" className="w-full" disabled={stage === "creating"}>
              {stage === "creating" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A criar conta...
                </>
              ) : (
                "Criar conta e entrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
