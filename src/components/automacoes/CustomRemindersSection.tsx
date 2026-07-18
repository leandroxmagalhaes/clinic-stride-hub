import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthContext } from "@/lib/auth-helpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

type Gatilho = "antes" | "depois";
type Condicao = "todas" | "nao_confirmadas" | "pagamento_pendente";

interface CustomReminder {
  id: string;
  chave: string;
  nome: string;
  ativo: boolean;
  config: {
    gatilho?: Gatilho;
    offset_horas?: number;
    condicao?: Condicao;
    assunto?: string;
    corpo?: string;
  };
}

interface FormState {
  id: string | null;
  chave: string | null;
  nome: string;
  ativo: boolean;
  gatilho: Gatilho;
  offset_horas: number;
  condicao: Condicao;
  assunto: string;
  corpo: string;
}

const EMPTY: FormState = {
  id: null,
  chave: null,
  nome: "",
  ativo: true,
  gatilho: "antes",
  offset_horas: 3,
  condicao: "todas",
  assunto: "Lembrete da sua consulta",
  corpo:
    "Olá {nome},\n\nRecordamos a sua consulta com {profissional} ({servico}) em {data} às {hora}.\n\nAté breve!",
};

const CONDICAO_LABEL: Record<Condicao, string> = {
  todas: "Todas as consultas",
  nao_confirmadas: "Só não confirmadas",
  pagamento_pendente: "Só com pagamento pendente",
};

const GATILHO_LABEL: Record<Gatilho, string> = {
  antes: "Antes da consulta",
  depois: "Depois da consulta",
};

function newChave() {
  // Generates a stable, unique key for a new custom reminder rule.
  const id =
    (globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2))
      .replace(/-/g, "")
      .slice(0, 12);
  return `custom_${id}`;
}

export function CustomRemindersSection() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CustomReminder | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const listQuery = useQuery({
    queryKey: ["automacoes-config-custom"],
    queryFn: async () => {
      const { clinicId } = await getAuthContext();
      const { data, error } = await (supabase as any)
        .from("automacoes_config")
        .select("id, chave, nome, ativo, config")
        .eq("clinic_id", clinicId)
        .like("chave", "custom_%")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CustomReminder[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const { clinicId } = await getAuthContext();
      if (!payload.nome.trim()) throw new Error("Nome obrigatório");
      if (!payload.assunto.trim()) throw new Error("Assunto obrigatório");
      if (!payload.corpo.trim()) throw new Error("Corpo obrigatório");
      const cfg = {
        gatilho: payload.gatilho,
        offset_horas: Math.max(1, Math.min(72, Number(payload.offset_horas) || 1)),
        condicao: payload.condicao,
        assunto: payload.assunto.trim(),
        corpo: payload.corpo,
      };
      if (payload.id) {
        const { error } = await (supabase as any)
          .from("automacoes_config")
          .update({ nome: payload.nome.trim(), ativo: payload.ativo, config: cfg })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const chave = payload.chave ?? newChave();
        const { error } = await (supabase as any)
          .from("automacoes_config")
          .insert({
            clinic_id: clinicId,
            chave,
            nome: payload.nome.trim(),
            ativo: payload.ativo,
            config: cfg,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Lembrete guardado");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["automacoes-config-custom"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: CustomReminder) => {
      const { error } = await (supabase as any)
        .from("automacoes_config")
        .update({ ativo: !row.ativo })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automacoes-config-custom"] }),
    onError: (err: any) => toast.error(err?.message ?? "Erro"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("automacoes_config")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lembrete eliminado");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["automacoes-config-custom"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro"),
  });

  const openNew = () => {
    setForm({ ...EMPTY, chave: newChave() });
    setDialogOpen(true);
  };

  const openEdit = (row: CustomReminder) => {
    setForm({
      id: row.id,
      chave: row.chave,
      nome: row.nome ?? "",
      ativo: row.ativo ?? true,
      gatilho: (row.config?.gatilho as Gatilho) ?? "antes",
      offset_horas: Number(row.config?.offset_horas ?? 3),
      condicao: (row.config?.condicao as Condicao) ?? "todas",
      assunto: row.config?.assunto ?? "",
      corpo: row.config?.corpo ?? "",
    });
    setDialogOpen(true);
  };

  const rows = listQuery.data ?? [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" /> Lembretes personalizados
            </CardTitle>
            <CardDescription>
              Crie os seus próprios lembretes com gatilho, condição e mensagem.
            </CardDescription>
          </div>
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Criar lembrete
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {listQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              Ainda não tem lembretes personalizados. Crie o primeiro.
            </div>
          ) : (
            rows.map((row) => {
              const g = (row.config?.gatilho as Gatilho) ?? "antes";
              const h = Number(row.config?.offset_horas ?? 0);
              const c = (row.config?.condicao as Condicao) ?? "todas";
              const resumo = `${GATILHO_LABEL[g]} • ${h}h • ${CONDICAO_LABEL[c]}`;
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{row.nome || "(sem nome)"}</span>
                      {!row.ativo && <Badge variant="outline">Desativado</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{resumo}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={row.ativo}
                      onCheckedChange={() => toggleMutation.mutate(row)}
                    />
                    <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setConfirmDelete(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar lembrete" : "Novo lembrete"}</DialogTitle>
            <DialogDescription>
              O lembrete será enviado por email conforme o gatilho definido.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Lembrete 24h antes"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Gatilho</Label>
                <Select
                  value={form.gatilho}
                  onValueChange={(v: Gatilho) => setForm({ ...form, gatilho: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="antes">Antes da consulta</SelectItem>
                    <SelectItem value="depois">Depois da consulta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Horas</Label>
                <Input
                  type="number"
                  min={1}
                  max={72}
                  value={form.offset_horas}
                  onChange={(e) =>
                    setForm({ ...form, offset_horas: Number(e.target.value) || 1 })
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Condição</Label>
              <Select
                value={form.condicao}
                onValueChange={(v: Condicao) => setForm({ ...form, condicao: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as consultas</SelectItem>
                  <SelectItem value="nao_confirmadas">Só não confirmadas</SelectItem>
                  <SelectItem value="pagamento_pendente">
                    Só com pagamento pendente
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Assunto do email</Label>
              <Input
                value={form.assunto}
                onChange={(e) => setForm({ ...form, assunto: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Corpo do email</Label>
              <Textarea
                rows={6}
                value={form.corpo}
                onChange={(e) => setForm({ ...form, corpo: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: <code>{"{nome}"}</code>, <code>{"{data}"}</code>,{" "}
                <code>{"{hora}"}</code>, <code>{"{profissional}"}</code>,{" "}
                <code>{"{servico}"}</code>.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">
                  Se desligado, este lembrete não é enviado.
                </p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação eliminar */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar lembrete</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que quer eliminar “{confirmDelete?.nome}”? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
