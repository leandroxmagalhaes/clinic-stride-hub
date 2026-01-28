import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, MapPin, Phone, Mail, FileText, Globe, Save } from 'lucide-react';
import { toast } from 'sonner';
import { ClinicService } from '@/services/ClinicService';
import { clinicDataSchema, type ClinicDataFormData } from '@/types/clinic';
import { useLocale } from '@/contexts/LocaleContext';

export function ClinicDataForm() {
  const queryClient = useQueryClient();
  const { locale } = useLocale();

  // Fetch clinic data
  const { data: clinic, isLoading } = useQuery({
    queryKey: ['clinic-data'],
    queryFn: ClinicService.getClinic,
    staleTime: 5 * 60 * 1000,
  });

  // Mutation for saving
  const saveMutation = useMutation({
    mutationFn: ClinicService.updateClinic,
    onSuccess: (data) => {
      queryClient.setQueryData(['clinic-data'], data);
      queryClient.invalidateQueries({ queryKey: ['clinic-info'] });
      toast.success('Dados da clínica salvos com sucesso!');
    },
    onError: (err) => {
      toast.error(`Erro ao salvar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    },
  });

  const form = useForm<ClinicDataFormData>({
    resolver: zodResolver(clinicDataSchema),
    defaultValues: {
      name: '',
      address: '',
      phone: '',
      email: '',
      cnpj: '',
      website: '',
    },
  });

  // Update form when clinic data loads
  useEffect(() => {
    if (clinic) {
      form.reset({
        name: clinic.name || '',
        address: clinic.address || '',
        phone: clinic.phone || '',
        email: clinic.email || '',
        cnpj: clinic.cnpj || '',
        website: clinic.website || '',
      });
    }
  }, [clinic, form]);

  const onSubmit = (data: ClinicDataFormData) => {
    saveMutation.mutate(data);
  };

  // Dynamic label for NIF/CNPJ based on locale
  const taxIdLabel = locale === 'pt-PT' ? 'NIF' : 'CNPJ';
  const taxIdPlaceholder = locale === 'pt-PT' ? 'Ex: 123456789' : 'Ex: 12.345.678/0001-00';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Dados da Clínica
        </CardTitle>
        <CardDescription>
          Informações que aparecerão no header, recibos e comunicações
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Clinic Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Nome da Clínica *
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Clínica Saúde Total" {...field} />
                  </FormControl>
                  <FormDescription>
                    Aparece no header do sistema e nos documentos
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Address */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço Completo
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Av. da Liberdade, 100 - Lisboa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone & Email in grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Telefone
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="+351 XXX XXX XXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contacto@clinica.pt" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* NIF/CNPJ & Website in grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {taxIdLabel}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={taxIdPlaceholder} {...field} />
                    </FormControl>
                    <FormDescription>
                      Número de identificação fiscal
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Website (opcional)
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.clinica.pt" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button 
              type="submit" 
              disabled={saveMutation.isPending || !form.formState.isDirty}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
