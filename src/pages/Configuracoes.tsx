import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Palette, Zap, Shield, Puzzle, Users, Hospital, FileArchive, History, Lock, Sparkles } from 'lucide-react';
import { GeneralSettingsForm } from '@/components/settings/GeneralSettingsForm';
import { AppearanceSettingsForm } from '@/components/settings/AppearanceSettingsForm';
import { AutomationSettingsForm } from '@/components/settings/AutomationSettingsForm';
import { TeamSettingsPanel } from '@/components/settings/TeamSettingsPanel';
import { ClinicDataForm } from '@/components/settings/ClinicDataForm';
import { BackupSettingsPanel } from '@/components/settings/BackupSettingsPanel';
import { AuditLogsPanel } from '@/components/settings/AuditLogsPanel';
import { PermissionsSettingsPanel } from '@/components/settings/PermissionsSettingsPanel';
import { AISettingsForm } from '@/components/settings/AISettingsForm';
import { useSettings } from '@/hooks/useSettings';
import { usePermissions } from '@/hooks/usePermissions';
import type { 
  GeneralSettingsFormData, 
  AppearanceSettingsFormData, 
  AutomationSettingsFormData 
} from '@/types/settings';

export default function Configuracoes() {
  const { settings, isLoading, isSaving, saveSettings, clinicInfo } = useSettings();
  const { isAdminMaster, canAccessModule } = usePermissions();

  const handleSaveGeneral = (data: GeneralSettingsFormData) => {
    saveSettings(data);
  };

  const handleSaveAppearance = (data: AppearanceSettingsFormData) => {
    saveSettings({
      ...data,
      logo_url: data.logo_url || null,
    });
  };

  const handleSaveAutomation = (data: AutomationSettingsFormData) => {
    saveSettings(data);
  };

  return (
    <AppLayout 
      title="Configurações" 
      subtitle="Personalize o sistema para sua clínica"
    >
      <div className="max-w-4xl mx-auto">
        <Tabs defaultValue="clinica" className="space-y-6">
          <TabsList className="grid w-full grid-cols-10 lg:w-auto lg:inline-grid">
            <TabsTrigger value="clinica" className="gap-2">
              <Hospital className="h-4 w-4 hidden sm:inline" />
              Clínica
            </TabsTrigger>
            <TabsTrigger value="geral" className="gap-2">
              <Building2 className="h-4 w-4 hidden sm:inline" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="aparencia" className="gap-2">
              <Palette className="h-4 w-4 hidden sm:inline" />
              Aparência
            </TabsTrigger>
            <TabsTrigger value="automacao" className="gap-2">
              <Zap className="h-4 w-4 hidden sm:inline" />
              Automação
            </TabsTrigger>
            {canAccessModule('equipe') && (
              <TabsTrigger value="equipe" className="gap-2">
                <Users className="h-4 w-4 hidden sm:inline" />
                Equipe
              </TabsTrigger>
            )}
            <TabsTrigger value="backup" className="gap-2">
              <FileArchive className="h-4 w-4 hidden sm:inline" />
              Backup
            </TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-2">
              <History className="h-4 w-4 hidden sm:inline" />
              Auditoria
            </TabsTrigger>
            {isAdminMaster && (
              <TabsTrigger value="permissoes" className="gap-2">
                <Lock className="h-4 w-4 hidden sm:inline" />
                Permissões
              </TabsTrigger>
            )}
            <TabsTrigger value="ia" className="gap-2">
              <Sparkles className="h-4 w-4 hidden sm:inline" />
              IA
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="gap-2" disabled>
              <Shield className="h-4 w-4 hidden sm:inline" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="integracoes" className="gap-2" disabled>
              <Puzzle className="h-4 w-4 hidden sm:inline" />
              Integrações
            </TabsTrigger>
          </TabsList>

          {/* Clinic Data Tab */}
          <TabsContent value="clinica">
            <ClinicDataForm />
          </TabsContent>

          {/* General Settings Tab */}
          <TabsContent value="geral">
            <GeneralSettingsForm
              settings={settings}
              clinicName={clinicInfo?.name}
              isLoading={isLoading}
              isSaving={isSaving}
              onSave={handleSaveGeneral}
            />
          </TabsContent>

          {/* Appearance Settings Tab */}
          <TabsContent value="aparencia">
            <AppearanceSettingsForm
              settings={settings}
              isLoading={isLoading}
              isSaving={isSaving}
              onSave={handleSaveAppearance}
            />
          </TabsContent>

          {/* Automation Settings Tab */}
          <TabsContent value="automacao" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4" />
                  Definições do lembrete
                </CardTitle>
                <CardDescription>
                  Saudação, antecedência e dados de pagamento do e-mail automático enviado antes da consulta.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link to="/configuracoes/lembrete">Abrir definições do lembrete</Link>
                </Button>
              </CardContent>
            </Card>
            <AutomationSettingsForm
              settings={settings}
              isLoading={isLoading}
              isSaving={isSaving}
              onSave={handleSaveAutomation}
            />
          </TabsContent>

          {/* Team Tab */}
          {canAccessModule('equipe') && (
            <TabsContent value="equipe">
              <TeamSettingsPanel />
            </TabsContent>
          )}

          {/* Backup Tab */}
          <TabsContent value="backup">
            <BackupSettingsPanel />
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="auditoria">
            <AuditLogsPanel />
          </TabsContent>

          {/* Permissions Tab */}
          {isAdminMaster && (
            <TabsContent value="permissoes">
              <PermissionsSettingsPanel />
            </TabsContent>
          )}

          {/* AI Settings Tab */}
          <TabsContent value="ia">
            <AISettingsForm />
          </TabsContent>

          {/* Security Tab (Coming Soon) */}
          <TabsContent value="seguranca">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Segurança
                  <Badge variant="outline">Em breve</Badge>
                </CardTitle>
                <CardDescription>
                  Configurações de segurança e controle de acesso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Em breve: gestão de usuários, permissões e logs de auditoria.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations Tab (Coming Soon) */}
          <TabsContent value="integracoes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Puzzle className="h-5 w-5" />
                  Integrações
                  <Badge variant="outline">Em breve</Badge>
                </CardTitle>
                <CardDescription>
                  Conecte com outras ferramentas e serviços
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Em breve: integrações com Google Calendar, Stripe, e mais.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
