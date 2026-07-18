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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  Bell,
  Save,
  Mail,
  MessageCircle,
  Smartphone,
  CalendarClock,
  CreditCard,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

/* ============================================================
   Tipos e utilitários
   ============================================================ */

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
  confirmacao_dia_anterior_ativo: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
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
  confirmacao_dia_anterior_ativo: true,
  whatsapp_enabled: true,
  email_enabled: true,
  sms_enabled: false,
};

const ANTECEDENCIA_OPTIONS = [1, 2, 3, 4, 6, 12, 24];

interface AutomacaoRow {
  id: string;
  chave: string;
  nome: string;
  ativo: boolean;
  config: Record<string, any>;
}

/* ============================================================
   Página
   ============================================================ */

export default function Automacoes() {
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<ReminderSettings>(EMPTY);

  // véspera
  const [vespera, setVespera] = useState({
    ativo: true,
    hora_corte: "14:00",
    hora_segunda: "18:00",
    hora_alerta: "20:00",
  });

  // follow-up
  const [followup, setFollowup] = useState({
    ativo: true,
    atraso_minutos: 30,
  });

  /* -------- Query: clinic_settings -------- */
  const clinicSettingsQuery = useQuery({
    queryKey: ["clinic-settings", "automacoes"],
    queryFn: async () => {
      const { clinicId } = await getAuthContext();
      const { data, error } = await (supabase as any)
        .from("clinic_settings")
        .select(
          "reminder_ativo, reminder_antecedencia_horas, reminder_saudacao, mbway_nome_1, mbway_numero_1, mbway_nome_2, mbway_numero_2, iban_nome, iban, confirmacao_dia_anterior_ativo, whatsapp_enabled, email_enabled, sms_enabled"
        )
        .eq("clinic_id", clinicId)
        .maybeSingle();
      if (error) throw error;
      return { clinicId, row: data };
    },
  });

  /* -------- Query: automacoes_config -------- */
  const automacoesQuery = useQuery({
    queryKey: ["automacoes-config"],
    queryFn: async () => {
      const { clinicId } = await getAuthContext();
      const { data, error } = await (supabase as any)
        .from("automacoes_config")
        .select("id, chave, nome, ativo, config")
        .eq("clinic_id", clinicId);
      if (error) throw error;
      const map: Record<string, AutomacaoRow> = {};
      for (const row of (data ?? []) as AutomacaoRow[]) {
        map[row.chave] = row;
      }
      return { clinicId, map };
    },
  });

  useEffect(() => {
    if (clinicSettingsQuery.data?.row) {
      const r = clinicSettingsQuery.data.row;
      setSettings({
        reminder_ativo: r.reminder_ativo ?? true,
        reminder_antecedencia_horas: r.reminder_antecedencia_horas ?? 3,
        reminder_saudacao: r.reminder_saudacao ?? DEFAULT_GREETING,
        mbway_nome_1: r.mbway_nome_1 ?? "",
        mbway_numero_1: r.mbway_numero_1 ?? "",
        mbway_nome_2: r.mbway_nome_2 ?? "",
        mbway_numero_2: r.mbway_numero_2 ?? "",
        iban_nome: r.iban_nome ?? "",
        iban: r.iban ?? "",
        confirmacao_dia_anterior_ativo: r.confirmacao_dia_anterior_ativo ?? true,
        whatsapp_enabled: r.whatsapp_enabled ?? true,
        email_enabled: r.email_enabled ?? true,
        sms_enabled: r.sms_enabled ?? false,
      });
    }
  }, [clinicSettingsQuery.data]);

  useEffect(() => {
    const map = automacoesQuery.data?.map;
    if (!map) return;
    const v = map["confirmacao_vespera"];
    if (v) {
      setVespera({
        ativo: v.ativo ?? true,
        hora_corte: v.config?.hora_corte ?? "14:00",
        hora_segunda: v.config?.hora_segunda ?? "18:00",
        hora_alerta: v.config?.hora_alerta ?? "20:00",
      });
    }
    const f = map["followup_pagamento"];
    if (f) {
      setFollowup({
        ativo: f.ativo ?? true,
        atraso_minutos: Number(f.config?.atraso_minutos ?? 30),
      });
    }
  }, [automacoesQuery.data]);

  /* -------- Mutations -------- */
  const saveClinicSettings = useMutation({
    mutationFn: async (payload: Partial<ReminderSettings>) => {
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
    onError: (err: any) => toast.error(`Erro: ${err?.message ?? "desconhecido"}`),
  });

  const saveAutomacao = useMutation({
    mutationFn: async (payload: {
      chave: string;
      nome: string;
      ativo: boolean;
      config: Record<string, any>;
    }) => {
      const { clinicId } = await getAuthContext();
      const map = automacoesQuery.data?.map ?? {};
      const existing = map[payload.chave];
      if (existing) {
        const { error } = await (supabase as any)
          .from("automacoes_config")
          .update({
            ativo: payload.ativo,
            config: payload.config,
            nome: payload.nome,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("automacoes_config")
          .insert({
            clinic_id: clinicId,
            chave: payload.chave,
            nome: payload.nome,
            ativo: payload.ativo,
            config: payload.config,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Automação atualizada");
      queryClient.invalidateQueries({ queryKey: ["automacoes-config"] });
    },
    onError: (err: any) => toast.error(`Erro: ${err?.message ?? "desconhecido"}`),
  });

  /* -------- Preview do lembrete -------- */
  const preview = useMemo(() => {
    const sample = { nome: "Maria Silva", data: "segunda-feira, 30 de Junho", hora: "10:30" };
    const saudacao = (settings.reminder_saudacao || DEFAULT_GREETING)
      .split("{nome}").join(sample.nome)
      .split("{data}").join(sample.data)
      .split("{hora}").join(sample.hora);
    return { saudacao, ...sample };
  }, [settings.reminder_saudacao]);

  const update = <K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const isLoading = clinicSettingsQuery.isLoading || automacoesQuery.isLoading;

  return (
    <AppLayout
      title="Central de Automações"
      subtitle="Configure os fluxos automáticos que trabalham por si"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Canais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" /> Canais de comunicação
            </CardTitle>
            <CardDescription>
              Ligue ou desligue globalmente cada canal utilizado pelas automações.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-base font-medium">
                      <MessageCircle className="h-5 w-5 text-emerald-600" />
                      WhatsApp
                      <Badge variant="secondary">Recomendado</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enviar lembretes e mensagens via WhatsApp Web.
                    </p>
                  </div>
                  <Switch
                    checked={settings.whatsapp_enabled}
                    onCheckedChange={(v) => {
                      update("whatsapp_enabled", v);
                      saveClinicSettings.mutate({ whatsapp_enabled: v });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-base font-medium">
                      <Mail className="h-5 w-5 text-blue-600" />
                      E-mail
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enviar notificações e relatórios por e-mail.
                    </p>
                  </div>
                  <Switch
                    checked={settings.email_enabled}
                    onCheckedChange={(v) => {
                      update("email_enabled", v);
                      saveClinicSettings.mutate({ email_enabled: v });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4 opacity-75">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-base font-medium">
                      <Smartphone className="h-5 w-5 text-violet-600" />
                      SMS
                      <Badge variant="outline">Em breve</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Enviar mensagens de texto via SMS.</p>
                  </div>
                  <Switch checked={settings.sms_enabled} disabled />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Lembrete 3h */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" /> Lembrete 3 horas antes
            </CardTitle>
            <CardDescription>
              E-mail automático enviado antes da consulta com saudação e detalhes de pagamento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const {
                  reminder_ativo,
                  reminder_antecedencia_horas,
                  reminder_saudacao,
                  mbway_nome_1,
                  mbway_numero_1,
                  mbway_nome_2,
                  mbway_numero_2,
                  iban_nome,
                  iban,
                } = settings;
                saveClinicSettings.mutate({
                  reminder_ativo,
                  reminder_antecedencia_horas,
                  reminder_saudacao,
                  mbway_nome_1,
                  mbway_numero_1,
                  mbway_nome_2,
                  mbway_numero_2,
                  iban_nome,
                  iban,
                });
              }}
              className="grid gap-6 lg:grid-cols-5"
            >
              <div className="lg:col-span-3 space-y-6">
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
                      checked={settings.reminder_ativo}
                      onCheckedChange={(v) => update("reminder_ativo", v)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reminder_antecedencia_horas">Antecedência</Label>
                  <Select
                    value={String(settings.reminder_antecedencia_horas)}
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
                    value={settings.reminder_saudacao}
                    onChange={(e) => update("reminder_saudacao", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variáveis: <code>{"{nome}"}</code>, <code>{"{data}"}</code>,{" "}
                    <code>{"{hora}"}</code>.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="mbway_nome_1">MB WAY principal — nome</Label>
                    <Input
                      id="mbway_nome_1"
                      value={settings.mbway_nome_1}
                      onChange={(e) => update("mbway_nome_1", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mbway_numero_1">MB WAY principal — telemóvel</Label>
                    <Input
                      id="mbway_numero_1"
                      inputMode="tel"
                      value={settings.mbway_numero_1}
                      onChange={(e) => update("mbway_numero_1", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mbway_nome_2">MB WAY alternativo — nome</Label>
                    <Input
                      id="mbway_nome_2"
                      value={settings.mbway_nome_2}
                      onChange={(e) => update("mbway_nome_2", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mbway_numero_2">MB WAY alternativo — telemóvel</Label>
                    <Input
                      id="mbway_numero_2"
                      inputMode="tel"
                      value={settings.mbway_numero_2}
                      onChange={(e) => update("mbway_numero_2", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iban_nome">Titular do IBAN</Label>
                    <Input
                      id="iban_nome"
                      value={settings.iban_nome}
                      onChange={(e) => update("iban_nome", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iban">IBAN</Label>
                    <Input
                      id="iban"
                      value={settings.iban}
                      onChange={(e) => update("iban", e.target.value)}
                      placeholder="PT50 ..."
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={saveClinicSettings.isPending} className="gap-2">
                    <Save className="h-4 w-4" />
                    {saveClinicSettings.isPending ? "A guardar..." : "Guardar lembrete"}
                  </Button>
                </div>
              </div>

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
                    </div>
                    {(settings.mbway_numero_1 || settings.mbway_numero_2 || settings.iban) && (
                      <div className="rounded-md border-l-4 border-sky-500 bg-sky-50 p-3 text-sm dark:bg-sky-950/30">
                        <div className="font-medium mb-1">Pagamento</div>
                        {settings.mbway_numero_1 && (
                          <div className="text-muted-foreground">
                            MB WAY: {settings.mbway_nome_1 || "—"} · {settings.mbway_numero_1}
                          </div>
                        )}
                        {settings.mbway_numero_2 && (
                          <div className="text-muted-foreground">
                            MB WAY: {settings.mbway_nome_2 || "—"} · {settings.mbway_numero_2}
                          </div>
                        )}
                        {settings.iban && (
                          <div className="text-muted-foreground">
                            IBAN: {settings.iban_nome || "—"} · {settings.iban}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </aside>
            </form>
          </CardContent>
        </Card>

        {/* Confirmação de véspera */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" /> Confirmação de véspera
            </CardTitle>
            <CardDescription>
              Envia pedido de confirmação no dia anterior à consulta, com segunda tentativa e alerta interno.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="text-base">Ativar confirmação de véspera</Label>
                    <p className="text-sm text-muted-foreground">
                      Controla o envio automático no dia anterior.
                    </p>
                  </div>
                  <Switch
                    checked={settings.confirmacao_dia_anterior_ativo}
                    onCheckedChange={(v) => {
                      update("confirmacao_dia_anterior_ativo", v);
                      saveClinicSettings.mutate({ confirmacao_dia_anterior_ativo: v });
                      saveAutomacao.mutate({
                        chave: "confirmacao_vespera",
                        nome: "Confirmação de véspera",
                        ativo: v,
                        config: vespera,
                      });
                      setVespera((x) => ({ ...x, ativo: v }));
                    }}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="hora_corte">Hora de corte</Label>
                    <Input
                      id="hora_corte"
                      type="time"
                      value={vespera.hora_corte}
                      onChange={(e) => setVespera((x) => ({ ...x, hora_corte: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hora_segunda">Segunda tentativa</Label>
                    <Input
                      id="hora_segunda"
                      type="time"
                      value={vespera.hora_segunda}
                      onChange={(e) => setVespera((x) => ({ ...x, hora_segunda: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hora_alerta">Alerta interno</Label>
                    <Input
                      id="hora_alerta"
                      type="time"
                      value={vespera.hora_alerta}
                      onChange={(e) => setVespera((x) => ({ ...x, hora_alerta: e.target.value }))}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Nota: os novos horários aplicam-se às próximas execuções do fluxo.
                </p>

                <div className="flex justify-end">
                  <Button
                    onClick={() =>
                      saveAutomacao.mutate({
                        chave: "confirmacao_vespera",
                        nome: "Confirmação de véspera",
                        ativo: vespera.ativo,
                        config: {
                          hora_corte: vespera.hora_corte,
                          hora_segunda: vespera.hora_segunda,
                          hora_alerta: vespera.hora_alerta,
                        },
                      })
                    }
                    disabled={saveAutomacao.isPending}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" /> Guardar horários
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Follow-up pagamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Follow-up de método de pagamento
            </CardTitle>
            <CardDescription>
              Após a consulta, se ainda não houver método definido, envia mensagem de follow-up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="text-base">Ativar follow-up</Label>
                    <p className="text-sm text-muted-foreground">
                      Envia lembrete ao utente para escolher método de pagamento.
                    </p>
                  </div>
                  <Switch
                    checked={followup.ativo}
                    onCheckedChange={(v) => {
                      setFollowup((x) => ({ ...x, ativo: v }));
                      saveAutomacao.mutate({
                        chave: "followup_pagamento",
                        nome: "Follow-up de método de pagamento",
                        ativo: v,
                        config: { atraso_minutos: followup.atraso_minutos },
                      });
                    }}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="atraso_minutos">Atraso (minutos após a consulta)</Label>
                    <Input
                      id="atraso_minutos"
                      type="number"
                      min={0}
                      value={followup.atraso_minutos}
                      onChange={(e) =>
                        setFollowup((x) => ({ ...x, atraso_minutos: Number(e.target.value) || 0 }))
                      }
                    />
                  </div>
                  <div>
                    <Button
                      onClick={() =>
                        saveAutomacao.mutate({
                          chave: "followup_pagamento",
                          nome: "Follow-up de método de pagamento",
                          ativo: followup.ativo,
                          config: { atraso_minutos: followup.atraso_minutos },
                        })
                      }
                      disabled={saveAutomacao.isPending}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" /> Guardar follow-up
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Lembretes personalizados */}
        <CustomRemindersSection />

      </div>
    </AppLayout>
  );
}
