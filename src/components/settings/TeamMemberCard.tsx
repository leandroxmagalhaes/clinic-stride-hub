import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { MoreVertical, Shield, User, Briefcase } from 'lucide-react';
import { TeamMember, AppRole } from '@/services/TeamService';
import { usePermissions } from '@/hooks/usePermissions';

interface TeamMemberCardProps {
  member: TeamMember;
  onUpdateRoles: (userId: string, roles: AppRole[]) => void;
  onToggleStatus: (profileId: string, isActive: boolean) => void;
  isCurrentUser: boolean;
}

const ROLE_CONFIG: Record<AppRole, { label: string; color: string; icon: React.ElementType }> = {
  admin: { label: 'Admin Master', color: 'bg-red-500/10 text-red-600 border-red-200', icon: Shield },
  professional: { label: 'Fisioterapeuta', color: 'bg-blue-500/10 text-blue-600 border-blue-200', icon: Briefcase },
  secretary: { label: 'Secretaria', color: 'bg-purple-500/10 text-purple-600 border-purple-200', icon: User },
  patient: { label: 'Paciente', color: 'bg-green-500/10 text-green-600 border-green-200', icon: User },
};

export function TeamMemberCard({ member, onUpdateRoles, onToggleStatus, isCurrentUser }: TeamMemberCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { isAdminMaster } = usePermissions();

  const initials = member.full_name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleRoleChange = async (role: AppRole) => {
    if (isCurrentUser) return;
    setIsUpdating(true);
    
    // Toggle role
    const currentRoles = member.roles;
    const hasRole = currentRoles.includes(role);
    const newRoles = hasRole 
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    
    await onUpdateRoles(member.user_id, newRoles);
    setIsUpdating(false);
  };

  const handleStatusToggle = async () => {
    if (isCurrentUser) return;
    setIsUpdating(true);
    await onToggleStatus(member.profile_id, !member.is_active);
    setIsUpdating(false);
  };

  // Filter out 'patient' role for display in team management
  const displayRoles = member.roles.filter(r => r !== 'patient');

  return (
    <Card className={`transition-opacity ${!member.is_active ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={member.avatar_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground truncate">
                {member.full_name}
              </h3>
              {isCurrentUser && (
                <Badge variant="outline" className="text-xs">Você</Badge>
              )}
              {!member.is_active && (
                <Badge variant="secondary" className="text-xs">Inativo</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {member.email}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {displayRoles.length > 0 ? (
                displayRoles.map(role => {
                  const config = ROLE_CONFIG[role];
                  const Icon = config.icon;
                  return (
                    <Badge 
                      key={role} 
                      variant="outline" 
                      className={`text-xs ${config.color}`}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  );
                })
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Sem função definida
                </Badge>
              )}
            </div>
          </div>

          {isAdminMaster && !isCurrentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isUpdating}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Funções
                </div>
                {(['admin', 'professional', 'secretary'] as AppRole[]).map(role => {
                  const config = ROLE_CONFIG[role];
                  const hasRole = member.roles.includes(role);
                  return (
                    <DropdownMenuItem 
                      key={role}
                      onClick={() => handleRoleChange(role)}
                      className="flex items-center justify-between"
                    >
                      <span>{config.label}</span>
                      {hasRole && (
                        <Badge variant="default" className="text-xs h-5">
                          ✓
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleStatusToggle}
                  className="flex items-center justify-between"
                >
                  <span>{member.is_active ? 'Desativar' : 'Ativar'}</span>
                  <Switch 
                    checked={member.is_active ?? true} 
                    className="pointer-events-none"
                  />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
