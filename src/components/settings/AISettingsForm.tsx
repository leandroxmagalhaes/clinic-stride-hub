import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Sparkles, Brain, BarChart3, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getAuthContext } from '@/lib/auth-helpers';

interface AISettings {
  ai_enabled: boolean;
  ai_clinical_enabled: boolean;
  ai_management_enabled: boolean;
}

export function AISettingsForm() {
  const [settings, setSettings] = useState<AISettings>({
    ai_enabled: true,
    ai_clinical_enabled: true,
    ai_management_enabled: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { clinicId } = await getAuthContext();
      const { data } = await supabase
        .from('clinic_settings')
        .select('ai_enabled, ai_clinical_enabled, ai_management_enabled')
        .eq('clinic_id', clinicId)
        .maybeSingle();

      if (data) {
        setSettings({
          ai_enabled: data.ai_enabled ?? true,
          ai_clinical_enabled: data.ai_clinical_enabled ?? true,
          ai_management_enabled: data.ai_management_enabled ?? true,
        });
      }
    } catch (err) {
      console.error('Error loading AI settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { clinicId } = await getAuthContext();

      const { data: existing } = await supabase
        .from('clinic_settings')
        .select('id')
        .eq('clinic_id', clinicId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('clinic_settings')
          .update({
            ai_enabled: settings.ai_enabled,
            ai_clinical_enabled: settings.ai_clinical_enabled,
            ai_management_enabled: settings.ai_management_enabled,
            updated_at: new Date().toISOString(),
          })
          .eq('clinic_id', clinicId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clinic_settings')
          .insert({
            clinic_id: clinicId,
            ai_enabled: settings.ai_enabled,
            ai_clinical_enabled: settings.ai_clinical_enabled,
            ai_management_enabled: settings.ai_management_enabled,
          });

        if (error) throw error;
      }

      toast.success('Configurações de IA salvas!');
    } catch (err) {
      toast.error('Erro ao salvar configurações de IA');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Inteligência Artificial
        </CardTitle>
        <CardDescription>
          Controle as funcionalidades de IA disponíveis na clínica. A IA é apenas sugestiva — nunca substitui o julgamento clínico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <Label className="font-medium">IA Ativada</Label>
              <p className="text-sm text-muted-foreground">
                Ativa ou desativa todas as funcionalidades de IA
              </p>
            </div>
          </div>
          <Switch
            checked={settings.ai_enabled}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, ai_enabled: checked }))}
          />
        </div>

        {/* Clinical AI */}
        <div className={`flex items-center justify-between p-4 rounded-lg border ${!settings.ai_enabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <Label className="font-medium">IA Clínica</Label>
              <p className="text-sm text-muted-foreground">
                Resumos de evolução, assistente de escrita e relatórios automáticos
              </p>
            </div>
          </div>
          <Switch
            checked={settings.ai_clinical_enabled}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, ai_clinical_enabled: checked }))}
            disabled={!settings.ai_enabled}
          />
        </div>

        {/* Management AI */}
        <div className={`flex items-center justify-between p-4 rounded-lg border ${!settings.ai_enabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div>
              <Label className="font-medium">IA de Gestão</Label>
              <p className="text-sm text-muted-foreground">
                Insights financeiros, risco de churn e qualificação de leads
              </p>
            </div>
          </div>
          <Switch
            checked={settings.ai_management_enabled}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, ai_management_enabled: checked }))}
            disabled={!settings.ai_enabled}
          />
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar Configurações de IA
        </Button>
      </CardContent>
    </Card>
  );
}
