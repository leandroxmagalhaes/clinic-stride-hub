import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Globe, Languages, Save } from 'lucide-react';
import { 
  generalSettingsSchema, 
  type GeneralSettingsFormData,
  type ClinicSettings,
  TIMEZONE_OPTIONS,
  LANGUAGE_OPTIONS,
} from '@/types/settings';

interface GeneralSettingsFormProps {
  settings: ClinicSettings | null | undefined;
  clinicName?: string;
  isLoading: boolean;
  isSaving: boolean;
  onSave: (data: GeneralSettingsFormData) => void;
}

export function GeneralSettingsForm({
  settings,
  clinicName,
  isLoading,
  isSaving,
  onSave,
}: GeneralSettingsFormProps) {
  const form = useForm<GeneralSettingsFormData>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      clinic_name: '',
      timezone: 'Europe/Lisbon',
      language: 'pt-PT',
    },
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      form.reset({
        clinic_name: settings.clinic_name || clinicName || '',
        timezone: settings.timezone || 'Europe/Lisbon',
        language: (settings.language as 'pt-PT' | 'pt-BR') || 'pt-PT',
      });
    } else if (clinicName) {
      form.setValue('clinic_name', clinicName);
    }
  }, [settings, clinicName, form]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Informações Gerais
        </CardTitle>
        <CardDescription>
          Configure as informações básicas da sua clínica
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
            <FormField
              control={form.control}
              name="clinic_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Clínica</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Clínica Saúde Total" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Este nome aparecerá nos relatórios e comunicações
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Fuso Horário
                  </FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o fuso horário" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Usado para agendamentos e relatórios
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Languages className="h-4 w-4" />
                    Idioma
                  </FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o idioma" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Define a formatação de datas e moedas
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={isSaving || !form.formState.isDirty}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
