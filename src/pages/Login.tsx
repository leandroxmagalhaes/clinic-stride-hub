import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Activity, Stethoscope, Users, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRoleChoice, setShowRoleChoice] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const nextParam = new URLSearchParams(location.search).get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
  const from = safeNext || (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Por favor, preencha todos os campos');
      return;
    }

    setIsLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      setIsLoading(false);
      console.error('Login error:', error);
      toast.error('Erro ao fazer login', {
        description: error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : 'Não foi possível iniciar sessão. Tente novamente.',
      });
      return;
    }

    // Check user roles to determine where to redirect
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    const userId = session.user.id;

    // Check if user has dual role (professional + patient portal)
    const { data: profile } = await supabase
      .from('profiles')
      .select('portal_role, role')
      .eq('user_id', userId)
      .maybeSingle();

    if (profile?.portal_role === 'both') {
      setIsLoading(false);
      setShowRoleChoice(true);
      return;
    }

    // Check user_roles to determine access
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const roles = (userRoles || []).map(r => r.role);
    const hasStaffRole = roles.some(r => ['admin', 'professional', 'secretary'].includes(r));
    const hasPatientRole = roles.includes('patient');

    // Check for pending invites (only for staff)
    if (hasStaffRole) {
      try {
        const { data: pendingRows } = await (supabase as any)
          .rpc('get_pending_team_invite_for_me');
        const pendingInvite = Array.isArray(pendingRows) ? pendingRows[0] : pendingRows;

        if (pendingInvite) {
          const { data: result } = await supabase.rpc('process_team_invite', {
            invite_token: pendingInvite.token
          });

          const resultData = result as { success?: boolean; error?: string } | null;
          if (resultData?.success) {
            toast.success('Convite aceito automaticamente!', {
              description: `Você agora faz parte da clínica como ${pendingInvite.role === 'professional' ? 'Fisioterapeuta' : pendingInvite.role}`,
            });
          }
        }
      } catch (err) {
        console.error('Error processing pending invite:', err);
      }
    }

    setIsLoading(false);

    if (hasStaffRole) {
      toast.success('Login realizado com sucesso!');
      navigate(from, { replace: true });
    } else if (hasPatientRole) {
      // Patient-only user → redirect to portal
      navigate('/patient-portal', { replace: true });
    } else {
      // No recognized role — might be new user with default patient role
      // Check if they have a portal account
      const { data: portalConta } = await (supabase as any)
        .from('portal_contas')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (portalConta) {
        navigate('/patient-portal', { replace: true });
      } else {
        toast.success('Login realizado com sucesso!');
        navigate(from, { replace: true });
      }
    }
  };

  const handleRoleChoice = (role: 'professional' | 'patient') => {
    setShowRoleChoice(false);
    if (role === 'professional') {
      toast.success('Login realizado com sucesso!');
      navigate(from, { replace: true });
    } else {
      navigate('/patient-portal', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Activity className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">PhysioNE</CardTitle>
          <CardDescription>
            Entre com suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
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
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Para criar uma conta, solicite um convite ao administrador.
            </p>
            <a
              href="/portal/login"
              className="text-xs text-muted-foreground hover:text-primary transition-colors text-center"
            >
              É utente/responsável? Aceda ao Portal do Paciente →
            </a>
          </CardFooter>
        </form>
      </Card>

      {/* Dual-role choice dialog */}
      <Dialog open={showRoleChoice} onOpenChange={setShowRoleChoice}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Como deseja entrar?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <Card
              className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all"
              onClick={() => handleRoleChoice('professional')}
            >
              <CardContent className="flex flex-col items-center py-6 text-center">
                <Stethoscope className="h-10 w-10 text-primary mb-3" />
                <p className="font-semibold text-sm">Profissional</p>
                <p className="text-[10px] text-muted-foreground mt-1">Gestão da clínica</p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all"
              onClick={() => handleRoleChoice('patient')}
            >
              <CardContent className="flex flex-col items-center py-6 text-center">
                <Users className="h-10 w-10 text-primary mb-3" />
                <p className="font-semibold text-sm">Responsável</p>
                <p className="text-[10px] text-muted-foreground mt-1">Portal do Paciente</p>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
