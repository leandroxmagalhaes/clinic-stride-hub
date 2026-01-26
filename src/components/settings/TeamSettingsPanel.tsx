import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Search, Users } from 'lucide-react';
import { TeamService, TeamMember, AppRole } from '@/services/TeamService';
import { TeamMemberCard } from './TeamMemberCard';
import { InviteUserModal } from './InviteUserModal';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function TeamSettingsPanel() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const { user } = useAuth();

  const fetchMembers = async () => {
    setIsLoading(true);
    const data = await TeamService.getTeamMembers();
    setMembers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMembers();
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

  const handleInvite = async (data: { email: string; full_name: string; role: AppRole }) => {
    const result = await TeamService.inviteUser(data);
    if (result.success) {
      toast.success('Convite enviado!', {
        description: result.error, // Contains info message about email system
      });
      fetchMembers();
    } else {
      toast.error('Erro ao convidar', { description: result.error });
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
      </CardContent>

      <InviteUserModal
        open={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        onInvite={handleInvite}
      />
    </Card>
  );
}
