import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, Shield, Briefcase, User, Search, Check, X, Pencil, RotateCcw, Loader2 } from 'lucide-react';
import { TeamService, TeamMember, AppRole } from '@/services/TeamService';
import { DEFAULT_PERMISSIONS, type UserPermissions, type ModulePermission } from '@/services/UserPermissionService';
import { RolePermissionService } from '@/services/RolePermissionService';
import { EditPermissionsModal } from './EditPermissionsModal';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type PermissionValue = boolean | 'own';

const MODULE_KEYS = [
  'dashboard', 'agenda', 'pacientes', 'prontuarios', 'profissionais',
  'servicos', 'comercial', 'financeiro', 'engajamento', 'configuracoes', 'equipe',
] as const;

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

const PERM_FIELDS = ['view', 'edit', 'delete', 'financial'] as const;
const PERM_LABELS: Record<string, string> = {
  view: 'Ver',
  edit: 'Editar',
  delete: 'Apagar',
  financial: 'Financeiro',
};

function AdminMatrixTable() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3 font-medium">Módulo</th>
            {PERM_FIELDS.map(f => (
              <th key={f} className="text-center p-3 font-medium w-20">{PERM_LABELS[f]}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {MODULE_KEYS.map(mod => (
            <tr key={mod} className="hover:bg-muted/30">
              <td className="p-3 font-medium">{MODULE_LABELS[mod]}</td>
              {PERM_FIELDS.map(f => (
                <td key={f} className="p-3 text-center">
                  <div className="flex justify-center">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-3 bg-muted/30 border-t">
        <p className="text-xs text-muted-foreground">
          O Admin Master tem sempre acesso total e não pode ser restringido.
        </p>
      </div>
    </div>
  );
}

function EditableMatrixTable({
  role,
  permissions,
  onToggle,
  onReset,
  isSaving,
}: {
  role: Exclude<AppRole, 'patient' | 'admin'>;
  permissions: UserPermissions;
  onToggle: (module: string, field: string) => void;
  onReset: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {isSaving && <span className="text-xs text-muted-foreground">A guardar...</span>}
        </div>
        <Button variant="outline" size="sm" onClick={onReset} className="gap-2">
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar Padrão
        </Button>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Módulo</th>
              {PERM_FIELDS.map(f => (
                <th key={f} className="text-center p-3 font-medium w-20">{PERM_LABELS[f]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {MODULE_KEYS.map(mod => {
              const modPerms = permissions[mod] || { view: false, edit: false, delete: false, financial: false };
              return (
                <tr key={mod} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{MODULE_LABELS[mod]}</td>
                  {PERM_FIELDS.map(field => {
                    const val = modPerms[field as keyof ModulePermission];
                    const isChecked = val === true || val === 'own';
                    return (
                      <td key={field} className="p-3 text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => onToggle(mod, field)}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserListItem({ member, onEdit }: { member: TeamMember; onEdit: (m: TeamMember) => void }) {
  const mainRole = member.roles.find(r => r !== 'patient') || member.roles[0];
  const initials = member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{member.full_name}</p>
          <p className="text-sm text-muted-foreground">{member.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={mainRole === 'admin' ? 'default' : 'secondary'} className="flex items-center gap-1">
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
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Role permissions state
  const [professionalPerms, setProfessionalPerms] = useState<UserPermissions>({ ...DEFAULT_PERMISSIONS.professional });
  const [secretaryPerms, setSecretaryPerms] = useState<UserPermissions>({ ...DEFAULT_PERMISSIONS.secretary });
  const [isSaving, setIsSaving] = useState(false);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load clinic ID and role permissions
  useEffect(() => {
    const loadClinicAndPerms = async () => {
      if (!user?.id) return;
      const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('user_id', user.id).single();
      if (!profile?.clinic_id) return;
      setClinicId(profile.clinic_id);

      const dbPerms = await RolePermissionService.getAllRolePermissions(profile.clinic_id);
      if (dbPerms.professional && Object.keys(dbPerms.professional).length > 0) {
        setProfessionalPerms(dbPerms.professional);
      }
      if (dbPerms.secretary && Object.keys(dbPerms.secretary).length > 0) {
        setSecretaryPerms(dbPerms.secretary);
      }
    };
    loadClinicAndPerms();
  }, [user?.id]);

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

  useEffect(() => { loadMembers(); }, []);

  const debouncedSave = useCallback((role: AppRole, perms: UserPermissions) => {
    if (!clinicId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      const result = await RolePermissionService.saveRolePermissions(clinicId, role, perms);
      setIsSaving(false);
      if (result.success) {
        toast.success('Permissões guardadas');
      } else {
        toast.error('Erro ao guardar permissões');
      }
    }, 800);
  }, [clinicId]);

  const handleToggle = useCallback((role: 'professional' | 'secretary', module: string, field: string) => {
    const setter = role === 'professional' ? setProfessionalPerms : setSecretaryPerms;
    setter(prev => {
      const modPerms = prev[module] || { view: false, edit: false, delete: false, financial: false };
      const currentVal = modPerms[field as keyof ModulePermission];
      const newVal = currentVal === true || currentVal === 'own' ? false : true;
      const updated = {
        ...prev,
        [module]: { ...modPerms, [field]: newVal },
      };
      debouncedSave(role, updated);
      return updated;
    });
  }, [debouncedSave]);

  const handleReset = useCallback(async (role: 'professional' | 'secretary') => {
    if (!clinicId) return;
    const defaults = { ...DEFAULT_PERMISSIONS[role] };
    if (role === 'professional') setProfessionalPerms(defaults);
    else setSecretaryPerms(defaults);
    
    const result = await RolePermissionService.resetToDefaults(clinicId, role);
    if (result.success) {
      toast.success('Permissões restauradas para o padrão');
    }
  }, [clinicId]);

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
    return member.full_name.toLowerCase().includes(query) || member.email?.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Matriz de Permissões por Função
          </CardTitle>
          <CardDescription>
            Configure as permissões de cada função do sistema. As alterações são guardadas automaticamente.
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
              <AdminMatrixTable />
            </TabsContent>
            <TabsContent value="professional">
              <EditableMatrixTable
                role="professional"
                permissions={professionalPerms}
                onToggle={(mod, field) => handleToggle('professional', mod, field)}
                onReset={() => handleReset('professional')}
                isSaving={isSaving}
              />
            </TabsContent>
            <TabsContent value="secretary">
              <EditableMatrixTable
                role="secretary"
                permissions={secretaryPerms}
                onToggle={(mod, field) => handleToggle('secretary', mod, field)}
                onReset={() => handleReset('secretary')}
                isSaving={isSaving}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Utilizadores</CardTitle>
              <CardDescription>Gerencie as permissões de cada membro da sua clínica</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar utilizador..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
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
              {searchQuery ? 'Nenhum utilizador encontrado com essa busca' : 'Nenhum membro da equipe encontrado'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMembers.map(member => (
                <UserListItem key={member.profile_id} member={member} onEdit={handleEditMember} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EditPermissionsModal
        member={selectedMember}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSave={handleSavePermissions}
      />
    </div>
  );
}
