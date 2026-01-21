import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Zap, Save, MessageCircle, Mail, Smartphone } from 'lucide-react';
import { 
  automationSettingsSchema, 
  type AutomationSettingsFormData,
  type ClinicSettings,
} from '@/types/settings';

interface AutomationSettingsFormProps {
  settings: ClinicSettings | null | undefined;
  isLoading: boolean;
  isSaving: boolean;
  onSave: (data: AutomationSettingsFormData) => void;
}

export function AutomationSettingsForm({
  settings,
  isLoading,
  isSaving,
  onSave,
}: AutomationSettingsFormProps) {
  const form = useForm<AutomationSettingsFormData>({
    resolver: zodResolver(automationSettingsSchema),
    defaultValues: {
      whatsapp_enabled: true,
      sms_enabled: false,
      email_enabled: true,
    },
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      form.reset({
        whatsapp_enabled: settings.whatsapp_enabled ?? true,
        sms_enabled: settings.sms_enabled ?? false,
        email_enabled: settings.email_enabled ?? true,
      });
    }
  }, [settings, form]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Automações
        </CardTitle>
        <CardDescription>
          Controle global dos canais de comunicação automatizada
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
            {/* WhatsApp Toggle */}
            <FormField
              control={form.control}
              name="whatsapp_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5 flex-1">
                    <FormLabel className="flex items-center gap-2 text-base">
                      <MessageCircle className="h-5 w-5 text-emerald-600" />
                      WhatsApp
                      <Badge variant="secondary" className="ml-2">Recomendado</Badge>
                    </FormLabel>
                    <FormDescription>
                      Enviar lembretes e mensagens via WhatsApp Web
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Email Toggle */}
            <FormField
              control={form.control}
              name="email_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5 flex-1">
                    <FormLabel className="flex items-center gap-2 text-base">
                      <Mail className="h-5 w-5 text-blue-600" />
                      E-mail
                    </FormLabel>
                    <FormDescription>
                      Enviar notificações e relatórios por e-mail
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* SMS Toggle */}
            <FormField
              control={form.control}
              name="sms_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 opacity-75">
                  <div className="space-y-0.5 flex-1">
                    <FormLabel className="flex items-center gap-2 text-base">
                      <Smartphone className="h-5 w-5 text-violet-600" />
                      SMS
                      <Badge variant="outline" className="ml-2">Em breve</Badge>
                    </FormLabel>
                    <FormDescription>
                      Enviar mensagens de texto via SMS
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="pt-2">
              <p className="text-sm text-muted-foreground mb-4">
                💡 Desativar um canal aqui impede <strong>todos</strong> os fluxos de automação 
                de usá-lo. Configure fluxos individuais na aba "Automação".
              </p>

              <Button 
                type="submit" 
                disabled={isSaving || !form.formState.isDirty}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
