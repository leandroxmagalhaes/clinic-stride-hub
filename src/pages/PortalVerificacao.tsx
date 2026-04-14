import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ShieldCheck, Lock, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

type Stage = "loading" | "error" | "verify" | "create-account";

interface InviteData {
  id: string;
  paciente_id: string;
  codigo: string;
  tentativas: number;
  max_tentativas: number;
  expira_em: string;
  enviado_para_email: string | null;
  enviado_para_telefone: string | null;
}

export default function PortalVerificacao() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [patientFirstName, setPatientFirstName] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Account creation
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const loadInvite = useCallback(async () => {
    if (!token) { setErrorMessage("Link inválido."); setStage("error"); return; }

    const { data, error } = await (supabase as any)
      .from("portal_convites")
      .select("*")
      .eq("link_token", token)
      .single();

    if (error || !data) {
      setErrorMessage("Convite inválido ou expirado.");
      setStage("error");
      return;
    }

    if (data.utilizado) {
      setErrorMessage("Este convite já foi utilizado. Faça login na sua conta.");
      setStage("error");
      return;
    }

    if (new Date(data.expira_em) < new Date()) {
      setErrorMessage("Este convite expirou. Contacte a clínica para um novo convite.");
      setStage("error");
      return;
    }

    if (data.tentativas >= data.max_tentativas) {
      setErrorMessage("Número máximo de tentativas excedido. Contacte a clínica.");
      setStage("error");
      return;
    }

    setInvite(data);

    // Get patient first name
    const { data: pat } = await supabase
      .from("pacientes")
      .select("full_name")
      .eq("id", data.paciente_id)
      .single();

    if (pat?.full_name) {
      const parts = pat.full_name.split(" ");
      const display = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
      setPatientFirstName(display);
    }

    setStage("verify");
  }, [token]);

  useEffect(() => { loadInvite(); }, [loadInvite]);

  const handleVerify = async (code: string) => {
    if (!invite || isVerifying) return;
    setIsVerifying(true);

    if (code === invite.codigo) {
      // Mark as used
      await (supabase as any)
        .from("portal_convites")
        .update({ utilizado: true })
        .eq("id", invite.id);

      setStage("create-account");
      toast.success("Código verificado com sucesso!");
    } else {
      // Increment attempts
      const newAttempts = invite.tentativas + 1;
      await (supabase as any)
        .from("portal_convites")
        .update({ tentativas: newAttempts })
        .eq("id", invite.id);

      setInvite({ ...invite, tentativas: newAttempts });
      setShake(true);
      setTimeout(() => setShake(false), 600);
      setOtpValue("");

      if (newAttempts >= invite.max_tentativas) {
        setErrorMessage("Número máximo de tentativas excedido. Contacte a clínica.");
        setStage("error");
      } else {
        toast.error(`Código incorreto. ${invite.max_tentativas - newAttempts} tentativa(s) restante(s).`);
      }
    }
    setIsVerifying(false);
  };

  const handleResend = async () => {
    if (!invite || isResending) return;
    setIsResending(true);
    try {
      const { error } = await supabase.functions.invoke("generate-portal-invite", {
        body: {
          paciente_id: invite.paciente_id,
          email: invite.enviado_para_email,
          telefone: invite.enviado_para_telefone,
        },
      });
      if (error) throw error;
      toast.success("Novo código enviado!");
      // Reload the page since a new token was generated
      window.location.reload();
    } catch {
      toast.error("Erro ao reenviar código.");
    } finally {
      setIsResending(false);
    }
  };

  const handleEmailSignUp = async () => {
    if (!invite) return;
    if (password.length < 8) { toast.error("A password deve ter pelo menos 8 caracteres."); return; }
    if (password !== confirmPassword) { toast.error("As passwords não coincidem."); return; }
    if (!email) { toast.error("Insira um email válido."); return; }

    setIsCreating(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/portal/onboarding" },
      });
      if (authError) throw authError;

      // Create portal account
      const { data: newAccount } = await (supabase as any).from("portal_contas").insert({
        paciente_id: invite.paciente_id,
        auth_user_id: authData.user?.id || null,
        email,
        provider: "email",
      }).select("id").single();

      // Insert into portal_conta_pacientes linking table
      if (newAccount?.id) {
        await (supabase as any).from("portal_conta_pacientes").insert({
          conta_id: newAccount.id,
          paciente_id: invite.paciente_id,
          relacao: "responsavel",
          is_primary: true,
        });
      }

      // Check if email exists in profiles (professional) — set portal_role to 'both'
      if (authData.user?.id) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("user_id", authData.user.id)
          .maybeSingle();

        if (existingProfile && existingProfile.role !== 'patient') {
          await supabase
            .from("profiles")
            .update({ portal_role: "both" } as any)
            .eq("id", existingProfile.id);
        }
      }

      // Store paciente_id for onboarding
      localStorage.setItem("portal_paciente_id", invite.paciente_id);

      toast.success("Conta criada! Verifique o seu email para confirmar.");
      navigate("/portal/onboarding");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar conta.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!invite) return;
    localStorage.setItem("portal_paciente_id", invite.paciente_id);
    localStorage.setItem("portal_google_pending", "true");

    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/portal/onboarding",
    });
    if (result.error) {
      toast.error("Erro ao iniciar login com Google");
    }
  };

  // Logo component
  const Logo = () => (
    <div className="flex items-center justify-center gap-3 mb-6">
      <div className="h-12 w-12 rounded-xl bg-[#1e40af] flex items-center justify-center text-white font-bold text-xl">P</div>
      <div>
        <p className="font-bold text-lg text-foreground">Physione</p>
        <p className="text-xs text-muted-foreground">Portal do Paciente</p>
      </div>
    </div>
  );

  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-[420px]">
          <CardContent className="pt-8 text-center space-y-4">
            <Logo />
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stage === "verify") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-[420px]">
          <CardHeader className="text-center pb-2">
            <Logo />
            <CardTitle className="text-lg">Bem-vindo(a), {patientFirstName}</CardTitle>
            <CardDescription>Verifique a sua identidade para continuar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 items-start">
              <Lock className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-800">
                Para sua segurança, insira o código de 6 dígitos enviado por email/SMS pela clínica.
              </p>
            </div>

            <div className={`flex justify-center ${shake ? "animate-shake" : ""}`}>
              <InputOTP
                maxLength={6}
                value={otpValue}
                onChange={(val) => {
                  setOtpValue(val);
                  if (val.length === 6) handleVerify(val);
                }}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            {isVerifying && (
              <div className="flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}

            <div className="text-center space-y-2">
              <button
                onClick={handleResend}
                disabled={isResending}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {isResending ? "A reenviar..." : "Não recebeu o código? Reenviar"}
              </button>
              <p className="text-[10px] text-muted-foreground">
                O código expira em 48 horas. Máximo 3 tentativas.
              </p>
            </div>
          </CardContent>
        </Card>

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
            20%, 40%, 60%, 80% { transform: translateX(4px); }
          }
          .animate-shake { animation: shake 0.5s ease-in-out; }
        `}</style>
      </div>
    );
  }

  // create-account stage
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-[420px]">
        <CardHeader className="text-center pb-2">
          <Logo />
          <div className="flex justify-center mb-2">
            <ShieldCheck className="h-10 w-10 text-green-500" />
          </div>
          <CardTitle className="text-lg">Criar a sua conta</CardTitle>
          <CardDescription>Para aceder ao portal de forma segura</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full gap-2 h-11"
            onClick={handleGoogleSignIn}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Entrar com Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password (mín. 8 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Input
              type="password"
              placeholder="Confirmar password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={handleEmailSignUp}
              disabled={isCreating || !email || password.length < 8}
            >
              {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
