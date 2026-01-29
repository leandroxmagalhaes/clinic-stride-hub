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
import { Loader2, Shield, Briefcase, User, Check, X, Minus } from 'lucide-react';
import { TeamMember, AppRole } from '@/services/TeamService';

interface EditPermissionsModalProps {
  member: TeamMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, roles: AppRole[], isActive: boolean) => Promise<void>;
}

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
    return <Check className="h-4 w-4 text-green-600" />;
  }
  if (value === 'own') {
    return (
      <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 border-amber-300">
        Próprio
      </Badge>
    );
  }
  return <X className="h-4 w-4 text-muted-foreground/50" />;
}

export function EditPermissionsModal({ member, open, onOpenChange, onSave }: EditPermissionsModalProps) {
  const [selectedRole, setSelectedRole] = useState<Exclude<AppRole, 'patient'>>('professional');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (member) {
      // Get the main role (exclude patient)
      const mainRole = member.roles.find(r => r !== 'patient') as Exclude<AppRole, 'patient'> | undefined;
      setSelectedRole(mainRole || 'professional');
      setIsActive(member.is_active ?? true);
    }
  }, [member]);

  const handleSave = async () => {
    if (!member) return;
    
    setIsSaving(true);
    try {
      await onSave(member.user_id, [selectedRole], isActive);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const currentPermissions = PERMISSION_MATRIX[selectedRole];

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Permissões - {member.full_name}</DialogTitle>
          <DialogDescription>
            Altere a função e veja as permissões associadas a este utilizador.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Role Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Função</Label>
              <RadioGroup
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as Exclude<AppRole, 'patient'>)}
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
                <Label className="text-base font-semibold">Permissões</Label>
                <span className="text-xs text-muted-foreground">
                  Baseado na função selecionada
                </span>
              </div>

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
                    {Object.entries(currentPermissions).map(([module, perms]) => (
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
              </div>

              {selectedRole === 'professional' && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 border-amber-300">
                    Próprio
                  </Badge>
                  = Apenas pacientes/sessões atribuídos a este profissional
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
          <Button onClick={handleSave} disabled={isSaving}>
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
