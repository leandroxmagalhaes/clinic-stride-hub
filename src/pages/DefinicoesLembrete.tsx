import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthContext } from "@/lib/auth-helpers";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Save, Mail } from "lucide-react";
import { toast } from "sonner";

interface ReminderSettings {
  reminder_ativo: boolean;
  reminder_antecedencia_horas: number;
  reminder_saudacao: string;
  mbway_nome_1: string;
  mbway_numero_1: string;
  mbway_nome_2: string;
  mbway_numero_2: string;
  iban_nome: string;
  iban: string;
}

const DEFAULT_GREETING =
  "Olá! Lembramos a consulta do/a {nome} no dia {data} às {hora}. Estamos a contar consigo 💙";

const EMPTY: ReminderSettings = {
  reminder_ativo: true,
  reminder_antecedencia_horas: 3,
  reminder_saudacao: DEFAULT_GREETING,
  mbway_nome_1: "",
  mbway_numero_1: "",
  mbway_nome_2: "",
  mbway_numero_2: "",
  iban_nome: "",
  iban: "",
};

const ANTECEDENCIA_OPTIONS = [1, 2, 3, 4, 6, 12, 24];

export default function DefinicoesLembrete() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ReminderSettings>(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["clinic-settings", "reminder"],
    queryFn: async () => {
      const { clinicId } = await getAuthContext();
      const { data, error } = await (supabase as any)
        .from("clinic_settings")
        .select(
          "reminder_ativo, reminder_antecedencia_horas, reminder_saudacao, mbway_nome_1, mbway_numero_1, mbway_nome_2, mbway_numero_2, iban_nome, iban"
        )
        .eq("clinic_id", clinicId)
        .maybeSingle();
      if (error) throw error;
      return { clinicId, row: data };
    },
  });

  useEffect(() => {
    if (data?.row) {
      setForm({
        reminder_ativo: data.row.reminder_ativo ?? true,
        reminder_antecedencia_horas: data.row.reminder_antecedencia_horas ?? 3,
        reminder_saudacao: data.row.reminder_saudacao ?? DEFAULT_GREETING,
        mbway_nome_1: data.row.mbway_nome_1 ?? "",
        mbway_numero_1: data.row.mbway_numero_1 ?? "",
        mbway_nome_2: data.row.mbway_nome_2 ?? "",
        mbway_numero_2: data.row.mbway_numero_2 ?? "",
        iban_nome: data.row.iban_nome ?? "",
        iban: data.row.iban ?? "",
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: ReminderSettings) => {
      const { clinicId } = await getAuthContext();
      const { error } = await (supabase as any)
        .from("clinic_settings")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("clinic_id", clinicId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Definições guardadas");
      queryClient.invalidateQueries({ queryKey: ["clinic-settings"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao guardar: ${err?.message ?? "desconhecido"}`);
    },
  });

  const preview = useMemo(() => {
    const sample = {
      nome: "Maria Silva",
      data: "segunda-feira, 30 de Junho",
      hora: "10:30",
    };
    const saudacao = (form.reminder_saudacao || DEFAULT_GREETING)
      .split("{nome}").join(sample.nome)
      .split("{data}").join(sample.data)
      .replaceAll("{hora}", sample.hora);
    return { saudacao, ...sample };
  }, [form.reminder_saudacao]);

  const update = <K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  return (
    <AppLayout
      title="Definições do Lembrete"
      subtitle="Configure o e-mail automático enviado antes de cada marcação"
    >
      <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-5">
        <form onSubmit={onSubmit} className="lg:col-span-3 space-y-6">
          {/* Ativação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" /> Lembrete automático
              </CardTitle>
              <CardDescription>
                Enviamos um e-mail ao utente antes da consulta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label htmlFor="reminder_ativo" className="text-base">
                      Ativar lembretes
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Quando desligado, nenhuma marcação recebe e-mail.
                    </p>
                  </div>
                  <Switch
                    id="reminder_ativo"
                    role="switch"
                    aria-checked={form.reminder_ativo}
                    checked={form.reminder_ativo}
                    onCheckedChange={(v) => update("reminder_ativo", v)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reminder_antecedencia_horas">Antecedência</Label>
                <Select
                  value={String(form.reminder_antecedencia_horas)}
                  onValueChange={(v) => update("reminder_antecedencia_horas", Number(v))}
                >
                  <SelectTrigger id="reminder_antecedencia_horas">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANTECEDENCIA_OPTIONS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h} {h === 1 ? "hora" : "horas"} antes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reminder_saudacao">Saudação</Label>
                <Textarea
                  id="reminder_saudacao"
                  rows={3}
                  value={form.reminder_saudacao}
                  onChange={(e) => update("reminder_saudacao", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Pode usar as variáveis <code>{"{nome}"}</code>, <code>{"{data}"}</code> e{" "}
                  <code>{"{hora}"}</code>.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Pagamento */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes de pagamento</CardTitle>
              <CardDescription>
                Aparecem no e-mail apenas quando a sessão ainda está por pagar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mbway_nome_1">MB WAY principal — nome</Label>
                  <Input
                    id="mbway_nome_1"
                    value={form.mbway_nome_1}
                    onChange={(e) => update("mbway_nome_1", e.target.value)}
                    placeholder="Ex.: Camila"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mbway_numero_1">MB WAY principal — telemóvel</Label>
                  <Input
                    id="mbway_numero_1"
                    inputMode="tel"
                    value={form.mbway_numero_1}
                    onChange={(e) => update("mbway_numero_1", e.target.value)}
                    placeholder="9XXXXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mbway_nome_2">MB WAY alternativo — nome</Label>
                  <Input
                    id="mbway_nome_2"
                    value={form.mbway_nome_2}
                    onChange={(e) => update("mbway_nome_2", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mbway_numero_2">MB WAY alternativo — telemóvel</Label>
                  <Input
                    id="mbway_numero_2"
                    inputMode="tel"
                    value={form.mbway_numero_2}
                    onChange={(e) => update("mbway_numero_2", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="iban_nome">Titular do IBAN</Label>
                  <Input
                    id="iban_nome"
                    value={form.iban_nome}
                    onChange={(e) => update("iban_nome", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    value={form.iban}
                    onChange={(e) => update("iban", e.target.value)}
                    placeholder="PT50 ..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "A guardar..." : "Guardar alterações"}
            </Button>
          </div>
        </form>

        {/* Preview */}
        <aside className="lg:col-span-2">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" /> Pré-visualização
              </CardTitle>
              <CardDescription>Como o utente vê o e-mail</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border bg-card p-3 text-sm">
                <div className="text-xs text-muted-foreground">De: A sua clínica</div>
                <div className="text-xs text-muted-foreground">
                  Assunto: Lembrete da sua consulta
                </div>
              </div>

              <p className="text-sm leading-relaxed">{preview.saudacao}</p>

              <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
                <div className="font-medium">Detalhes da marcação</div>
                <div className="text-muted-foreground">📅 {preview.data}</div>
                <div className="text-muted-foreground">🕐 {preview.hora}</div>
                <div className="text-muted-foreground">
                  👤 Fisioterapeuta exemplo · Sessão de fisioterapia
                </div>
              </div>

              {(form.mbway_numero_1 || form.mbway_numero_2 || form.iban) && (
                <div className="rounded-md border-l-4 border-sky-500 bg-sky-50 p-3 text-sm dark:bg-sky-950/30">
                  <div className="font-medium mb-1">Pagamento</div>
                  {form.mbway_numero_1 && (
                    <div className="text-muted-foreground">
                      MB WAY: {form.mbway_nome_1 || "—"} · {form.mbway_numero_1}
                    </div>
                  )}
                  {form.mbway_numero_2 && (
                    <div className="text-muted-foreground">
                      MB WAY: {form.mbway_nome_2 || "—"} · {form.mbway_numero_2}
                    </div>
                  )}
                  {form.iban && (
                    <div className="text-muted-foreground">
                      IBAN: {form.iban_nome || "—"} · {form.iban}
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Remarcações ou cancelamentos podem ser feitos até ao dia anterior às 14h00.
                Após esse horário, a sessão será cobrada normalmente.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </AppLayout>
  );
}
