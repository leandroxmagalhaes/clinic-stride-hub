import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

export default function PortalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  const checkPortalAccount = async (userId: string) => {
    // Get portal account — now we store conta_id, not paciente_id
    const { data: conta } = await (supabase as any)
      .from("portal_contas")
      .select("id, onboarding_completo")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!conta) {
      toast.error("Conta não associada", {
        description: "Esta conta não está associada a nenhum paciente. Contacte a clínica.",
      });
      await supabase.auth.signOut();
      return;
    }

    // Check linked patients via portal_conta_pacientes
    const { data: links } = await (supabase as any)
      .from("portal_conta_pacientes")
      .select("paciente_id")
      .eq("conta_id", conta.id);

    // Store first paciente_id for onboarding compatibility
    if (links && links.length > 0) {
      localStorage.setItem("portal_paciente_id", links[0].paciente_id);
    }

    if (!conta.onboarding_completo) {
      navigate("/portal/onboarding");
    } else {
      navigate("/patient-portal");
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha todos os campos");
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setIsLoading(false);
      toast.error("Erro ao fazer login", {
        description: error.message === "Invalid login credentials"
          ? "Email ou senha incorretos"
          : error.message,
      });
      return;
    }
    await checkPortalAccount(data.user.id);
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/portal/login` },
    });
    if (error) {
      setIsLoading(false);
      toast.error("Erro ao iniciar login com Google");
    }
  };

  // Handle OAuth redirect
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        await checkPortalAccount(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast.error("Insira o seu email");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/portal/login`,
    });
    setIsLoading(false);
    if (error) {
      toast.error("Erro ao enviar email de recuperação");
    } else {
      setResetSent(true);
      toast.success("Email enviado! Verifique a sua caixa de entrada.");
    }
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
          <CardTitle className="text-2xl">Portal do Paciente</CardTitle>
          <CardDescription>Respira & Desenvolve</CardDescription>
        </CardHeader>

        {showReset ? (
          <CardContent className="space-y-4">
            {resetSent ? (
              <div className="text-center space-y-3">
                <Mail className="h-10 w-10 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Email de recuperação enviado para <strong>{resetEmail}</strong>
                </p>
                <Button variant="ghost" onClick={() => { setShowReset(false); setResetSent(false); }}>
                  Voltar ao login
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Insira o email associado à sua conta para receber um link de recuperação.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleResetPassword} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar link de recuperação
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setShowReset(false)}>
                  Voltar ao login
                </Button>
              </>
            )}
          </CardContent>
        ) : (
          <>
            <form onSubmit={handleEmailLogin}>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Entrar com Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">ou</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setShowReset(true)}
                >
                  Esqueci a password
                </button>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </CardFooter>
            </form>
          </>
        )}

        <div className="px-6 pb-6 text-center">
          <Link
            to="/login"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            É profissional? Aceda aqui ao Physione →
          </Link>
        </div>
      </Card>
    </div>
  );
}
