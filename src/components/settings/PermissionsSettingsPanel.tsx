import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, Shield, Briefcase, User, Search, Check, X, Pencil } from 'lucide-react';
import { TeamService, TeamMember, AppRole } from '@/services/TeamService';
import { EditPermissionsModal } from './EditPermissionsModal';
import { toast } from 'sonner';

type PermissionValue = boolean | 'own';

interface ModulePermission {
  view: PermissionValue;
  edit: PermissionValue;
  delete: PermissionValue;
  financial: boolean;
}

interface PermissionMatrix {
  [module: string]: ModulePermission;
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  agenda: 'Agenda',
  pacientes: 'Pacientes',
  prontuarios: 'Prontuários',
  profissionais: 'Profissionais',
  servicos: 'Serviços',
  comercial: 'Comercial',
  financeiro: 'Financeiro',
  engajamento: 'Engajamento',
  configuracoes: 'Configurações',
  equipe: 'Equipe',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin Master',
  professional: 'Fisioterapeuta',
  secretary: 'Secretaria',
  patient: 'Paciente',
};

const PERMISSION_MATRIX: Record<Exclude<AppRole, 'patient'>, PermissionMatrix> = {
  admin: {
    dashboard: { view: true, edit: true, delete: true, financial: true },
    agenda: { view: true, edit: true, delete: true, financial: true },
    pacientes: { view: true, edit: true, delete: true, financial: true },
    prontuarios: { view: true, edit: true, delete: true, financial: true },
    profissionais: { view: true, edit: true, delete: true, financial: true },
    servicos: { view: true, edit: true, delete: true, financial: true },
    comercial: { view: true, edit: true, delete: true, financial: true },
    financeiro: { view: true, edit: true, delete: true, financial: true },
    engajamento: { view: true, edit: true, delete: true, financial: true },
    configuracoes: { view: true, edit: true, delete: true, financial: true },
    equipe: { view: true, edit: true, delete: true, financial: true },
  },
  secretary: {
    dashboard: { view: true, edit: true, delete: true, financial: false },
    agenda: { view: true, edit: true, delete: true, financial: false },
    pacientes: { view: true, edit: true, delete: true, financial: false },
    prontuarios: { view: true, edit: true, delete: true, financial: false },
    profissionais: { view: true, edit: true, delete: true, financial: false },
    servicos: { view: true, edit: true, delete: true, financial: false },
    comercial: { view: true, edit: true, delete: true, financial: false },
    financeiro: { view: true, edit: true, delete: false, financial: false },
    engajamento: { view: true, edit: true, delete: true, financial: false },
    configuracoes: { view: false, edit: false, delete: false, financial: false },
    equipe: { view: false, edit: false, delete: false, financial: false },
  },
  professional: {
    dashboard: { view: true, edit: false, delete: false, financial: false },
    agenda: { view: true, edit: true, delete: false, financial: false },
    pacientes: { view: 'own', edit: 'own', delete: false, financial: false },
    prontuarios: { view: 'own', edit: 'own', delete: false, financial: false },
    profissionais: { view: false, edit: false, delete: false, financial: false },
    servicos: { view: true, edit: false, delete: false, financial: false },
    comercial: { view: false, edit: false, delete: false, financial: false },
    financeiro: { view: false, edit: false, delete: false, financial: false },
    engajamento: { view: true, edit: false, delete: false, financial: false },
    configuracoes: { view: false, edit: false, delete: false, financial: false },
    equipe: { view: false, edit: false, delete: false, financial: false },
  },
};

function PermissionIcon({ value }: { value: PermissionValue }) {
  if (value === true) {
    return <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  }
  if (value === 'own') {
    return (
      <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500">
        Próprio
      </Badge>
    );
  }
  return <X className="h-4 w-4 text-muted-foreground/50" />;
}

function PermissionMatrixTable({ role }: { role: Exclude<AppRole, 'patient'> }) {
  const permissions = PERMISSION_MATRIX[role];

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3 font-medium">Módulo</th>
            <th className="text-center p-3 font-medium w-16">Ver</th>
            <th className="text-center p-3 font-medium w-16">Editar</th>
            <th className="text-center p-3 font-medium w-16">Apagar</th>
            <th className="text-center p-3 font-medium w-20">Financeiro</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {Object.entries(permissions).map(([module, perms]) => (
            <tr key={module} className="hover:bg-muted/30">
              <td className="p-3 font-medium">{MODULE_LABELS[module] || module}</td>
              <td className="p-3 text-center">
                <div className="flex justify-center">
                  <PermissionIcon value={perms.view} />
                </div>
              </td>
              <td className="p-3 text-center">
                <div className="flex justify-center">
                  <PermissionIcon value={perms.edit} />
                </div>
              </td>
              <td className="p-3 text-center">
                <div className="flex justify-center">
                  <PermissionIcon value={perms.delete} />
                </div>
              </td>
              <td className="p-3 text-center">
                <div className="flex justify-center">
                  <PermissionIcon value={perms.financial} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {role === 'professional' && (
      <div className="p-3 bg-muted/30 border-t">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500">
            Próprio
          </Badge>
          = Apenas pacientes/sessões atribuídos a este profissional
        </p>
      </div>
    )}
  </div>
);
}

function UserListItem({ 
  member, 
  onEdit 
}: { 
  member: TeamMember; 
  onEdit: (member: TeamMember) => void;
}) {
  const mainRole = member.roles.find(r => r !== 'patient') || member.roles[0];
  const initials = member.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{member.full_name}</p>
          <p className="text-sm text-muted-foreground">{member.email}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Badge 
          variant={mainRole === 'admin' ? 'default' : 'secondary'}
          className="flex items-center gap-1"
        >
          {mainRole === 'admin' && <Shield className="h-3 w-3" />}
          {mainRole === 'professional' && <Briefcase className="h-3 w-3" />}
          {mainRole === 'secretary' && <User className="h-3 w-3" />}
          {ROLE_LABELS[mainRole] || mainRole}
        </Badge>
        
        <Badge variant={member.is_active ? 'outline' : 'destructive'}>
          {member.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
        
        <Button variant="ghost" size="sm" onClick={() => onEdit(member)}>
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function PermissionsSettingsPanel() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const data = await TeamService.getTeamMembers();
      setMembers(data);
    } catch (error) {
      console.error('Error loading team members:', error);
      toast.error('Erro ao carregar membros da equipe');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleEditMember = (member: TeamMember) => {
    setSelectedMember(member);
    setIsEditModalOpen(true);
  };

  const handleSavePermissions = async (userId: string, roles: AppRole[], isActive: boolean) => {
    try {
      await TeamService.updateMemberRoles(userId, roles, isActive);
      toast.success('Permissões atualizadas com sucesso');
      await loadMembers();
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Erro ao atualizar permissões');
      throw error;
    }
  };

  const filteredMembers = members.filter(member => {
    const query = searchQuery.toLowerCase();
    return (
      member.full_name.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Permission Matrix Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Matriz de Permissões por Função
          </CardTitle>
          <CardDescription>
            Consulte as permissões de cada função do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="admin" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="admin" className="gap-2">
                <Shield className="h-4 w-4 hidden sm:inline" />
                Admin Master
              </TabsTrigger>
              <TabsTrigger value="professional" className="gap-2">
                <Briefcase className="h-4 w-4 hidden sm:inline" />
                Fisioterapeuta
              </TabsTrigger>
              <TabsTrigger value="secretary" className="gap-2">
                <User className="h-4 w-4 hidden sm:inline" />
                Secretaria
              </TabsTrigger>
            </TabsList>

            <TabsContent value="admin">
              <PermissionMatrixTable role="admin" />
            </TabsContent>
            <TabsContent value="professional">
              <PermissionMatrixTable role="professional" />
            </TabsContent>
            <TabsContent value="secretary">
              <PermissionMatrixTable role="secretary" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Users List Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Utilizadores</CardTitle>
              <CardDescription>
                Gerencie as permissões de cada membro da sua clínica
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar utilizador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery 
                ? 'Nenhum utilizador encontrado com essa busca'
                : 'Nenhum membro da equipe encontrado'
              }
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMembers.map((member) => (
                <UserListItem
                  key={member.profile_id}
                  member={member}
                  onEdit={handleEditMember}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Permissions Modal */}
      <EditPermissionsModal
        member={selectedMember}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSave={handleSavePermissions}
      />
    </div>
  );
}
