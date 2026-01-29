import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, User, Shield, Briefcase, CheckCircle, Copy, MessageCircle } from 'lucide-react';
import { TeamService, AppRole, CreateInviteResult } from '@/services/TeamService';
import { toast } from 'sonner';

const formSchema = z.object({
  email: z.string().email('Email inválido'),
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  role: z.enum(['admin', 'professional', 'secretary'] as const),
});

type FormData = z.infer<typeof formSchema>;
type ModalState = 'form' | 'success';

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteCreated?: () => void;
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin Master', description: 'Acesso total ao sistema', icon: Shield },
  { value: 'professional', label: 'Fisioterapeuta', description: 'Vê apenas seus pacientes e sessões', icon: Briefcase },
  { value: 'secretary', label: 'Secretaria', description: 'Acesso administrativo sem financeiro completo', icon: User },
];

export function InviteUserModal({ open, onOpenChange, onInviteCreated }: InviteUserModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [inviteResult, setInviteResult] = useState<CreateInviteResult | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      full_name: '',
      role: 'professional',
    },
  });

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when closing
      setModalState('form');
      setInviteResult(null);
      form.reset();
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async (values: FormData) => {
    setIsSubmitting(true);
    const result = await TeamService.createInvite({
      email: values.email,
      full_name: values.full_name,
      role: values.role,
    });
    setIsSubmitting(false);

    if (result.success && result.inviteUrl) {
      setInviteResult(result);
      setModalState('success');
      onInviteCreated?.();
    } else {
      toast.error('Erro ao criar convite', { description: result.error });
    }
  };

  const handleCopyLink = () => {
    if (inviteResult?.inviteUrl) {
      navigator.clipboard.writeText(inviteResult.inviteUrl);
      toast.success('Link copiado!');
    }
  };

  const handleWhatsApp = () => {
    if (inviteResult?.inviteUrl) {
      const message = encodeURIComponent(
        `Olá ${inviteResult.inviteName}! Você foi convidado para se juntar à nossa clínica. ` +
        `Clique no link para criar sua conta: ${inviteResult.inviteUrl}`
      );
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {modalState === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Convidar Membro
              </DialogTitle>
              <DialogDescription>
                Adicione um novo membro à sua equipe. Um link de convite será gerado.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo</FormLabel>
                      <FormControl>
                        <Input placeholder="João Silva" {...field} />
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="joao@clinica.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Função</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma função" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLE_OPTIONS.map(option => {
                            const Icon = option.icon;
                            return (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <span className="font-medium">{option.label}</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                      — {option.description}
                                    </span>
                                  </div>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => handleClose(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Gerar Convite
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <CheckCircle className="h-5 w-5" />
              Convite Criado!
            </DialogTitle>
            <DialogDescription>
              O convite para {inviteResult?.inviteName} foi criado com sucesso.
            </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Copie o link abaixo e envie para o convidado:
              </p>
              
              <div className="flex gap-2">
                <Input 
                  value={inviteResult?.inviteUrl || ''} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button onClick={handleCopyLink} variant="outline" size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleCopyLink} className="flex-1">
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Link
                </Button>
                <Button onClick={handleWhatsApp} variant="outline" className="flex-1">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Este link expira em 7 dias
              </p>
            </div>

            <DialogFooter>
              <Button onClick={() => handleClose(false)} variant="outline" className="w-full">
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
