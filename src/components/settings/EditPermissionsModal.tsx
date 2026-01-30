import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Shield, Briefcase, User, RotateCcw } from 'lucide-react';
import { TeamMember, AppRole } from '@/services/TeamService';
import { 
  UserPermissionService, 
  UserPermissions, 
  ModulePermission,
  MODULE_KEYS,
  MODULE_LABELS,
  DEFAULT_PERMISSIONS,
  PermissionValue,
} from '@/services/UserPermissionService';
import { toast } from 'sonner';

interface EditPermissionsModalProps {
  member: TeamMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, roles: AppRole[], isActive: boolean) => Promise<void>;
}

const ROLE_CONFIG: Record<AppRole, { label: string; description: string; icon: React.ElementType }> = {
  admin: {
    label: 'Admin Master',
    description: 'Acesso total ao sistema, incluindo configurações e gestão de equipe',
    icon: Shield,
  },
  professional: {
    label: 'Fisioterapeuta',
    description: 'Vê apenas seus próprios pacientes e sessões atribuídos',
    icon: Briefcase,
  },
  secretary: {
    label: 'Secretaria',
    description: 'Acesso operacional completo, exceto totais financeiros consolidados',
    icon: User,
  },
  patient: {
    label: 'Paciente',
    description: 'Acesso ao portal do paciente',
    icon: User,
  },
};

export function EditPermissionsModal({ member, open, onOpenChange, onSave }: EditPermissionsModalProps) {
  const [selectedRole, setSelectedRole] = useState<Exclude<AppRole, 'patient'>>('professional');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customPermissions, setCustomPermissions] = useState<UserPermissions | null>(null);
  const [hasCustomPermissions, setHasCustomPermissions] = useState(false);

  useEffect(() => {
    if (member && open) {
      // Get the main role (exclude patient)
      const mainRole = member.roles.find(r => r !== 'patient') as Exclude<AppRole, 'patient'> | undefined;
      setSelectedRole(mainRole || 'professional');
      setIsActive(member.is_active ?? true);
      
      // Load custom permissions
      loadCustomPermissions();
    }
  }, [member, open]);

  const loadCustomPermissions = async () => {
    if (!member) return;
    
    setIsLoading(true);
    try {
      const permissions = await UserPermissionService.getUserPermissions(member.user_id);
      if (permissions && Object.keys(permissions).length > 0) {
        setCustomPermissions(permissions);
        setHasCustomPermissions(true);
      } else {
        // Use role defaults
        const mainRole = member.roles.find(r => r !== 'patient') as Exclude<AppRole, 'patient'> | undefined;
        setCustomPermissions(UserPermissionService.getDefaultPermissionsForRole(mainRole || 'professional'));
        setHasCustomPermissions(false);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
      const mainRole = member.roles.find(r => r !== 'patient') as Exclude<AppRole, 'patient'> | undefined;
      setCustomPermissions(UserPermissionService.getDefaultPermissionsForRole(mainRole || 'professional'));
      setHasCustomPermissions(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = (role: Exclude<AppRole, 'patient'>) => {
    setSelectedRole(role);
    // Reset to role defaults when changing role
    setCustomPermissions(UserPermissionService.getDefaultPermissionsForRole(role));
    setHasCustomPermissions(false);
  };

  const handlePermissionChange = (
    module: string, 
    permission: keyof ModulePermission, 
    checked: boolean
  ) => {
    if (!customPermissions) return;
    
    setCustomPermissions(prev => {
      if (!prev) return prev;
      
      const newPerms = { ...prev };
      if (!newPerms[module]) {
        newPerms[module] = { view: false, edit: false, delete: false, financial: false };
      }
      
      newPerms[module] = {
        ...newPerms[module],
        [permission]: checked,
      };
      
      // If disabling view, also disable edit, delete, financial
      if (permission === 'view' && !checked) {
        newPerms[module].edit = false;
        newPerms[module].delete = false;
        newPerms[module].financial = false;
      }
      
      // If enabling edit/delete/financial, also enable view
      if ((permission === 'edit' || permission === 'delete' || permission === 'financial') && checked) {
        newPerms[module].view = true;
      }
      
      return newPerms;
    });
    setHasCustomPermissions(true);
  };

  const handleResetToDefaults = () => {
    setCustomPermissions(UserPermissionService.getDefaultPermissionsForRole(selectedRole));
    setHasCustomPermissions(false);
    toast.info('Permissões restauradas para o padrão da função');
  };

  const handleSave = async () => {
    if (!member) return;
    
    setIsSaving(true);
    try {
      // Save role and status
      await onSave(member.user_id, [selectedRole], isActive);
      
      // Save custom permissions if they differ from defaults
      if (hasCustomPermissions && customPermissions) {
        const result = await UserPermissionService.saveUserPermissions(
          member.user_id,
          customPermissions
        );
        
        if (!result.success) {
          toast.error('Erro ao guardar permissões customizadas');
          return;
        }
      } else {
        // Reset to defaults (delete custom permissions)
        await UserPermissionService.resetToRoleDefaults(member.user_id);
      }
      
      toast.success('Permissões atualizadas com sucesso');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Erro ao guardar permissões');
    } finally {
      setIsSaving(false);
    }
  };

  const getPermissionValue = (module: string, permission: keyof ModulePermission): boolean => {
    if (!customPermissions?.[module]) return false;
    const value = customPermissions[module][permission];
    // Convert 'own' to true for checkbox display
    return value === true || value === 'own';
  };

  const isOwnPermission = (module: string, permission: keyof ModulePermission): boolean => {
    if (!customPermissions?.[module]) return false;
    return customPermissions[module][permission] === 'own';
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Permissões - {member.full_name}</DialogTitle>
          <DialogDescription>
            Altere a função e personalize as permissões deste utilizador.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Role Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Função Base</Label>
              <RadioGroup
                value={selectedRole}
                onValueChange={(value) => handleRoleChange(value as Exclude<AppRole, 'patient'>)}
                className="space-y-3"
              >
                {(['admin', 'professional', 'secretary'] as const).map((role) => {
                  const config = ROLE_CONFIG[role];
                  const Icon = config.icon;
                  return (
                    <div
                      key={role}
                      className={`flex items-start space-x-3 rounded-lg border p-4 transition-colors ${
                        selectedRole === role
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value={role} id={role} className="mt-1" />
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={role} className="flex items-center gap-2 font-medium cursor-pointer">
                          <Icon className="h-4 w-4" />
                          {config.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">{config.description}</p>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            <Separator />

            {/* Permissions Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Permissões Personalizadas</Label>
                  {hasCustomPermissions && (
                    <Badge variant="secondary" className="ml-2 text-xs">Customizado</Badge>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleResetToDefaults}
                  disabled={!hasCustomPermissions || isLoading}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restaurar Padrão
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Módulo</th>
                        <th className="text-center p-3 font-medium w-20">Ver</th>
                        <th className="text-center p-3 font-medium w-20">Editar</th>
                        <th className="text-center p-3 font-medium w-20">Apagar</th>
                        <th className="text-center p-3 font-medium w-24">Financeiro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {MODULE_KEYS.map((module) => (
                        <tr key={module} className="hover:bg-muted/30">
                          <td className="p-3 font-medium">
                            {MODULE_LABELS[module]}
                            {isOwnPermission(module, 'view') && (
                              <Badge variant="outline" className="ml-2 text-xs px-1.5 py-0 text-amber-600 border-amber-300">
                                Próprio
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={getPermissionValue(module, 'view')}
                                onCheckedChange={(checked) => 
                                  handlePermissionChange(module, 'view', checked as boolean)
                                }
                                disabled={selectedRole === 'admin'}
                              />
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={getPermissionValue(module, 'edit')}
                                onCheckedChange={(checked) => 
                                  handlePermissionChange(module, 'edit', checked as boolean)
                                }
                                disabled={selectedRole === 'admin'}
                              />
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={getPermissionValue(module, 'delete')}
                                onCheckedChange={(checked) => 
                                  handlePermissionChange(module, 'delete', checked as boolean)
                                }
                                disabled={selectedRole === 'admin'}
                              />
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={getPermissionValue(module, 'financial')}
                                onCheckedChange={(checked) => 
                                  handlePermissionChange(module, 'financial', checked as boolean)
                                }
                                disabled={selectedRole === 'admin'}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedRole === 'admin' && (
                <p className="text-xs text-muted-foreground">
                  Admin Master possui acesso total. Para restringir permissões, altere a função.
                </p>
              )}
            </div>

            <Separator />

            {/* Status Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Status do Utilizador</Label>
                <p className="text-sm text-muted-foreground">
                  {isActive 
                    ? 'O utilizador pode acessar o sistema' 
                    : 'O utilizador está impedido de acessar'}
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
