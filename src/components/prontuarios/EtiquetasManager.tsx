import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthContext } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";
import { Plus, Tag as TagIcon, History, ChevronDown, Pencil, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Etiqueta {
  id: string;
  nome: string;
  cor: string;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  etiqueta_nome: string;
  etiqueta_cor: string | null;
  accao: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  realizado_por_nome: string | null;
  created_at: string;
}

const COLOR_PRESETS = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#84CC16", "#10B981", "#14B8A6", "#06B6D4",
  "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899",
  "#6B7280", "#0F172A",
];

interface Props {
  pacienteId: string;
}

export function EtiquetasManager({ pacienteId }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Etiqueta | null>(null);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(COLOR_PRESETS[8]);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<Etiqueta | null>(null);

  const load = async () => {
    setLoading(true);
    const [tagsRes, auditRes] = await Promise.all([
      (supabase as any)
        .from("paciente_etiquetas")
        .select("*")
        .eq("paciente_id", pacienteId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      (supabase as any)
        .from("etiquetas_auditoria")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setEtiquetas(tagsRes.data || []);
    setAudit(auditRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  const openNew = () => {
    setEditing(null);
    setNome("");
    setCor(COLOR_PRESETS[8]);
    setModalOpen(true);
  };

  const openEdit = (e: Etiqueta) => {
    setEditing(e);
    setNome(e.nome);
    setCor(e.cor);
    setModalOpen(true);
  };

  const logAudit = async (params: {
    clinicId: string;
    etiqueta_id: string | null;
    etiqueta_nome: string;
    etiqueta_cor: string | null;
    accao: "criada" | "editada" | "excluida" | "restaurada";
    valor_anterior?: string | null;
    valor_novo?: string | null;
  }) => {
    if (!user) return;
    const nome = (user.user_metadata as any)?.full_name || user.email || "Profissional";
    await (supabase as any).from("etiquetas_auditoria").insert({
      clinic_id: params.clinicId,
      paciente_id: pacienteId,
      etiqueta_id: params.etiqueta_id,
      etiqueta_nome: params.etiqueta_nome,
      etiqueta_cor: params.etiqueta_cor,
      accao: params.accao,
      valor_anterior: params.valor_anterior ?? null,
      valor_novo: params.valor_novo ?? null,
      realizado_por: user.id,
      realizado_por_nome: nome,
    });
  };

  const handleSave = async () => {
    const trimmed = nome.trim();
    if (!trimmed) {
      toast.error("Indique o nome da etiqueta");
      return;
    }
    if (trimmed.length > 60) {
      toast.error("Nome demasiado longo (máx. 60 caracteres)");
      return;
    }
    setSaving(true);
    try {
      const { userId, clinicId } = await getAuthContext();
      if (editing) {
        const before = `${editing.nome} (${editing.cor})`;
        const after = `${trimmed} (${cor})`;
        const { error } = await (supabase as any)
          .from("paciente_etiquetas")
          .update({ nome: trimmed, cor, updated_by: userId })
          .eq("id", editing.id);
        if (error) throw error;
        await logAudit({
          clinicId,
          etiqueta_id: editing.id,
          etiqueta_nome: trimmed,
          etiqueta_cor: cor,
          accao: "editada",
          valor_anterior: before,
          valor_novo: after,
        });
        toast.success("Etiqueta atualizada");
      } else {
        const { data, error } = await (supabase as any)
          .from("paciente_etiquetas")
          .insert({
            clinic_id: clinicId,
            paciente_id: pacienteId,
            nome: trimmed,
            cor,
            created_by: userId,
          })
          .select()
          .single();
        if (error) throw error;
        await logAudit({
          clinicId,
          etiqueta_id: data.id,
          etiqueta_nome: trimmed,
          etiqueta_cor: cor,
          accao: "criada",
          valor_novo: `${trimmed} (${cor})`,
        });
        toast.success("Etiqueta criada");
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao guardar etiqueta");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const { userId, clinicId } = await getAuthContext();
    const { error } = await (supabase as any)
      .from("paciente_etiquetas")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", toDelete.id);
    if (error) throw new Error(error.message);
    await logAudit({
      clinicId,
      etiqueta_id: toDelete.id,
      etiqueta_nome: toDelete.nome,
      etiqueta_cor: toDelete.cor,
      accao: "excluida",
      valor_anterior: `${toDelete.nome} (${toDelete.cor})`,
    });
    toast.success("Etiqueta excluída");
    await load();
  };

  const accaoLabel = (a: string) => ({
    criada: "criada",
    editada: "editada",
    excluida: "excluída",
    restaurada: "restaurada",
  }[a] || a);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg">Etiquetas de Saúde</h3>
          <p className="text-sm text-muted-foreground">
            Personalizam o atendimento e geram alertas no agendamento.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nova Etiqueta
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : etiquetas.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-lg">
          <TagIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma etiqueta atribuída</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {etiquetas.map((e) => (
            <Badge
              key={e.id}
              variant="secondary"
              className="group gap-1.5 pl-2.5 pr-1 py-1 border-0 font-medium"
              style={{ backgroundColor: `${e.cor}22`, color: e.cor }}
            >
              <button
                type="button"
                className="hover:underline"
                onClick={() => openEdit(e)}
                title="Editar"
              >
                {e.nome}
              </button>
              <button
                type="button"
                className="ml-0.5 rounded p-0.5 hover:bg-black/10"
                onClick={() => openEdit(e)}
                title="Editar"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                className="rounded p-0.5 hover:bg-black/10"
                onClick={() => setToDelete(e)}
                title="Excluir"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <History className="h-4 w-4 mr-1" />
            Ver histórico de alterações
            <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 border rounded-lg divide-y max-h-80 overflow-auto">
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                Sem registos de alterações.
              </p>
            ) : (
              audit.map((a) => (
                <div key={a.id} className="p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: a.etiqueta_cor || "#999" }}
                    />
                    <span>
                      Etiqueta <strong>"{a.etiqueta_nome}"</strong> {accaoLabel(a.accao)} por{" "}
                      <strong>{a.realizado_por_nome || "—"}</strong>
                    </span>
                  </div>
                  {a.accao === "editada" && (a.valor_anterior || a.valor_novo) && (
                    <div className="text-xs text-muted-foreground ml-4 mt-0.5">
                      {a.valor_anterior} → {a.valor_novo}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground ml-4">
                    {new Date(a.created_at).toLocaleString("pt-PT")}
                  </div>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Create/edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar etiqueta" : "Nova etiqueta"}</DialogTitle>
            <DialogDescription>
              As etiquetas ajudam a personalizar o atendimento deste utente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tag-nome">Nome</Label>
              <Input
                id="tag-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Alergia, VIP, Cuidado redobrado"
                maxLength={60}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    className={`h-8 w-8 rounded-full border-2 transition ${
                      cor === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Selecionar cor ${c}`}
                  />
                ))}
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="h-8 w-8 rounded cursor-pointer border"
                  title="Cor personalizada"
                />
              </div>
            </div>
            <div className="rounded border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">Pré-visualização</div>
              <Badge
                variant="secondary"
                className="border-0 font-medium"
                style={{ backgroundColor: `${cor}22`, color: cor }}
              >
                {nome.trim() || "Nome da etiqueta"}
              </Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Guardar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="Excluir etiqueta?"
        description="A etiqueta é removida da lista activa mas fica registada no histórico para auditoria."
        entityName={toDelete?.nome || ""}
        confirmLabel="Excluir"
      />
    </div>
  );
}
