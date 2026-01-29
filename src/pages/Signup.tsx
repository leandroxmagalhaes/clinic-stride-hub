import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, Activity, UserPlus, Building2, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface InviteDetails {
  valid: boolean;
  email?: string;
  full_name?: string;
  role?: string;
  clinic_name?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  professional: 'Fisioterapeuta',
  secretary: 'Secretaria',
};

export default function Signup() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInvite, setIsLoadingInvite] = useState(!!inviteToken);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  
  const { signUp } = useAuth();
  const navigate = useNavigate();

  // Fetch invite details if token is present
  useEffect(() => {
    async function fetchInviteDetails() {
      if (!inviteToken) return;
      
      setIsLoadingInvite(true);
      try {
        const { data, error } = await supabase.rpc('get_invite_details', {
          invite_token: inviteToken
        });

        if (error) {
          console.error('Error fetching invite details:', error);
          setInviteDetails({ valid: false });
        } else {
          const inviteData = data as unknown as InviteDetails;
          setInviteDetails(inviteData);
          if (inviteData?.valid) {
            setEmail(inviteData.email || '');
            setFullName(inviteData.full_name || '');
          }
        }
      } catch (error) {
        console.error('Error fetching invite details:', error);
        setInviteDetails({ valid: false });
      } finally {
        setIsLoadingInvite(false);
      }
    }

    fetchInviteDetails();
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName || !email || !password || !confirmPassword) {
      toast.error('Por favor, preencha todos os campos');
      return;
    }

    if (fullName.length < 3) {
      toast.error('O nome deve ter pelo menos 3 caracteres');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsLoading(true);
    
    const { error } = await signUp(email, password, fullName);
    
    if (error) {
      setIsLoading(false);
      
      // Detectar se o utilizador já existe
      if (error.message?.toLowerCase().includes('already registered') || 
          error.message?.toLowerCase().includes('user already registered')) {
        toast.error('Este email já está registado', {
          description: 'Faça login com a sua conta existente e o convite será processado automaticamente.',
          action: {
            label: 'Ir para Login',
            onClick: () => navigate('/login'),
          },
        });
        return;
      }
      
      toast.error('Erro ao criar conta', {
        description: error.message,
      });
      return;
    }

    // If this is an invite signup, process the invite after account creation
    if (inviteToken && inviteDetails?.valid) {
      // Wait a moment for auth to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const { data: result, error: processError } = await supabase.rpc('process_team_invite', {
          invite_token: inviteToken
        });

        const processResult = result as unknown as { success: boolean; error?: string; clinic_id?: string };

        if (processError) {
          console.error('Error processing invite:', processError);
          toast.warning('Conta criada, mas houve um problema ao processar o convite. Contacte o administrador.');
        } else if (processResult && !processResult.success) {
          console.error('Invite processing failed:', processResult.error);
          toast.warning('Conta criada, mas o convite não pôde ser processado: ' + processResult.error);
        } else {
          toast.success('Conta criada e convite aceite!', {
            description: `Você agora faz parte da ${inviteDetails.clinic_name}.`,
          });
        }
      } catch (error) {
        console.error('Error processing invite:', error);
        toast.warning('Conta criada, mas houve um erro ao processar o convite.');
      }
    } else {
      toast.success('Conta criada com sucesso!', {
        description: 'Você já pode fazer login.',
      });
    }
    
    setIsLoading(false);
    navigate('/login');
  };

  // If no invite token, show restricted access message
  if (!inviteToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Acesso Restrito</CardTitle>
            <CardDescription className="text-base">
              O cadastro neste sistema é feito exclusivamente através de convite.
              Solicite um convite ao administrador da sua clínica.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-4">
            <Link to="/login" className="w-full">
              <Button variant="outline" className="w-full">
                Ir para Login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isLoadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">A carregar convite...</p>
        </div>
      </div>
    );
  }

  // Show error if invite is invalid
  if (inviteDetails && !inviteDetails.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <Activity className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Convite Inválido</CardTitle>
            <CardDescription>
              Este convite já expirou ou não é válido. Por favor, solicite um novo convite ao administrador da clínica.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link to="/login">
              <Button variant="outline">Ir para Login</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const isInviteSignup = inviteToken && inviteDetails?.valid;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            {isInviteSignup ? (
              <UserPlus className="h-8 w-8 text-primary" />
            ) : (
              <Activity className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isInviteSignup ? 'Aceitar Convite' : 'Criar Conta'}
          </CardTitle>
          <CardDescription>
            {isInviteSignup ? (
              <>Você foi convidado para a <strong>{inviteDetails?.clinic_name}</strong></>
            ) : (
              'Preencha os dados abaixo para criar sua conta no PhysioNE'
            )}
          </CardDescription>
        </CardHeader>

        {isInviteSignup && (
          <div className="px-6">
            <Alert className="bg-primary/5 border-primary/20">
              <Building2 className="h-4 w-4" />
              <AlertDescription>
                Você será adicionado como <strong>{ROLE_LABELS[inviteDetails?.role || ''] || inviteDetails?.role}</strong> na clínica <strong>{inviteDetails?.clinic_name}</strong>.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading || isInviteSignup}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || isInviteSignup}
                autoComplete="email"
              />
              {isInviteSignup && (
                <p className="text-xs text-muted-foreground">
                  O email não pode ser alterado pois está associado ao convite.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isInviteSignup ? 'A aceitar convite...' : 'Criando conta...'}
                </>
              ) : (
                isInviteSignup ? 'Aceitar Convite e Criar Conta' : 'Criar Conta'
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Faça login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
