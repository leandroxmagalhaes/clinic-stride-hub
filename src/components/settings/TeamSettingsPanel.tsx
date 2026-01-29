import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Search, Users, Clock, Mail, RotateCcw, X, Copy, MessageCircle } from 'lucide-react';
import { TeamService, TeamMember, AppRole, PendingInvite, CreateInviteResult } from '@/services/TeamService';
import { TeamMemberCard } from './TeamMemberCard';
import { InviteUserModal } from './InviteUserModal';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  professional: 'Fisioterapeuta',
  secretary: 'Secretaria',
};

export function TeamSettingsPanel() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchMembers = async () => {
    setIsLoading(true);
    const data = await TeamService.getTeamMembers();
    setMembers(data);
    setIsLoading(false);
  };

  const fetchInvites = async () => {
    setIsLoadingInvites(true);
    const data = await TeamService.getPendingInvites();
    setPendingInvites(data);
    setIsLoadingInvites(false);
  };

  useEffect(() => {
    fetchMembers();
    fetchInvites();
  }, []);

  const handleUpdateRoles = async (userId: string, roles: AppRole[]) => {
    const success = await TeamService.updateMemberRoles(userId, roles);
    if (success) {
      toast.success('Funções atualizadas com sucesso');
      fetchMembers();
    } else {
      toast.error('Erro ao atualizar funções');
    }
  };

  const handleToggleStatus = async (profileId: string, isActive: boolean) => {
    const success = await TeamService.toggleMemberStatus(profileId, isActive);
    if (success) {
      toast.success(isActive ? 'Usuário ativado' : 'Usuário desativado');
      fetchMembers();
    } else {
      toast.error('Erro ao alterar status');
    }
  };

  const handleCopyInviteLink = (invite: PendingInvite) => {
    const url = TeamService.getInviteUrl(invite.token);
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const handleWhatsAppInvite = (invite: PendingInvite) => {
    const url = TeamService.getInviteUrl(invite.token);
    const message = encodeURIComponent(
      `Olá ${invite.full_name}! Você foi convidado para se juntar à nossa clínica. ` +
      `Clique no link para criar sua conta: ${url}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleResendInvite = async (invite: PendingInvite) => {
    setResendingId(invite.id);
    const result = await TeamService.resendInvite(invite);
    setResendingId(null);
    
    if (result.success && result.inviteUrl) {
      // Copy new link to clipboard
      navigator.clipboard.writeText(result.inviteUrl);
      toast.success('Novo convite criado!', {
        description: 'Link copiado para a área de transferência',
      });
      fetchInvites();
    } else {
      toast.error('Erro ao recriar convite', { description: result.error });
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    setCancellingId(inviteId);
    const success = await TeamService.cancelInvite(inviteId);
    setCancellingId(null);
    
    if (success) {
      toast.success('Convite cancelado');
      fetchInvites();
    } else {
      toast.error('Erro ao cancelar convite');
    }
  };

  const filteredMembers = members.filter(member => 
    member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: active first, then by name
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (a.is_active !== b.is_active) {
      return a.is_active ? -1 : 1;
    }
    return a.full_name.localeCompare(b.full_name);
  });

  // Filter out expired invites
  const validInvites = pendingInvites.filter(invite => !isPast(new Date(invite.expires_at)));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Equipe
            </CardTitle>
            <CardDescription>
              Gerencie os membros da sua clínica e suas permissões
            </CardDescription>
          </div>
          <Button onClick={() => setIsInviteModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Convidar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="members">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Membros ({members.length})
            </TabsTrigger>
            <TabsTrigger value="invites" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pendentes ({validInvites.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                          <Skeleton className="h-5 w-24" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : sortedMembers.length > 0 ? (
                sortedMembers.map(member => (
                  <TeamMemberCard
                    key={member.profile_id}
                    member={member}
                    onUpdateRoles={handleUpdateRoles}
                    onToggleStatus={handleToggleStatus}
                    isCurrentUser={member.user_id === user?.id}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'Nenhum membro encontrado' : 'Nenhum membro na equipe'}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="invites" className="space-y-4 mt-4">
            {isLoadingInvites ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : validInvites.length > 0 ? (
              validInvites.map(invite => (
                <Card key={invite.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Mail className="h-5 w-5 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">{invite.full_name}</p>
                          <p className="text-sm text-muted-foreground">{invite.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">
                              {ROLE_LABELS[invite.role] || invite.role}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Expira {formatDistanceToNow(new Date(invite.expires_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyInviteLink(invite)}
                          title="Copiar link"
                        >
                          <Copy className="h-4 w-4" />
                          <span className="sr-only sm:not-sr-only sm:ml-2">Copiar</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWhatsAppInvite(invite)}
                          title="Enviar por WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span className="sr-only">WhatsApp</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendInvite(invite)}
                          disabled={resendingId === invite.id}
                          title="Gerar novo link"
                        >
                          <RotateCcw className={`h-4 w-4 ${resendingId === invite.id ? 'animate-spin' : ''}`} />
                          <span className="sr-only">Recriar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelInvite(invite.id)}
                          disabled={cancellingId === invite.id}
                          title="Cancelar convite"
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Cancelar</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum convite pendente</p>
                <p className="text-sm">Convide novos membros usando o botão acima</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <InviteUserModal
        open={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        onInviteCreated={fetchInvites}
      />
    </Card>
  );
}
