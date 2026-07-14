import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Euro, Pencil, RotateCcw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";

interface PriceHistoryRow {
  id: string;
  valor: number | null;
  valor_anterior: number | null;
  motivo: string | null;
  criado_em: string;
  criado_por: string | null;
  criado_por_nome?: string | null;
}

interface Props {
  patientId: string;
  precoConsulta: number | null | undefined;
  onChange?: (novoPreco: number | null) => void;
}

function fmt(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toFixed(2)} €`;
}

export function PatientPriceCard({ patientId, precoConsulta, onChange }: Props) {
  const [preco, setPreco] = useState<number | null>(precoConsulta ?? null);
  const [history, setHistory] = useState<PriceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [valorInput, setValorInput] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPreco(precoConsulta ?? null);
  }, [precoConsulta]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("historico_precos_paciente")
      .select("id, valor, valor_anterior, motivo, criado_em, criado_por")
      .eq("paciente_id", patientId)
      .order("criado_em", { ascending: false });
    if (error) {
      console.error(error);
      setHistory([]);
      setLoading(false);
      return;
    }
    const rows = (data || []) as PriceHistoryRow[];
    const userIds = Array.from(new Set(rows.map((r) => r.criado_por).filter(Boolean))) as string[];
    let namesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      (profs || []).forEach((p: any) => { namesMap[p.user_id] = p.full_name; });
    }
    setHistory(rows.map((r) => ({ ...r, criado_por_nome: r.criado_por ? namesMap[r.criado_por] : null })));
    setLoading(false);
  }, [patientId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const openEdit = () => {
    setValorInput(preco !== null && preco !== undefined ? String(preco) : "");
    setMotivo("");
    setDialogOpen(true);
  };

  const persist = async (novoValor: number | null) => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;

      const { error: updErr } = await supabase
        .from("pacientes")
        .update({ preco_consulta: novoValor } as any)
        .eq("id", patientId);
      if (updErr) throw updErr;

      const { error: histErr } = await (supabase as any)
        .from("historico_precos_paciente")
        .insert({
          paciente_id: patientId,
          valor: novoValor,
          valor_anterior: preco,
          motivo: motivo.trim() || null,
          criado_por: userId,
        });
      if (histErr) throw histErr;

      setPreco(novoValor);
      onChange?.(novoValor);
      toast.success(novoValor === null ? "Voltou ao preço geral do serviço" : "Preço atualizado");
      setDialogOpen(false);
      await loadHistory();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Não foi possível guardar o preço");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const parsed = parseFloat(valorInput.replace(",", "."));
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Valor inválido");
      return;
    }
    persist(parsed);
  };

  const handleReset = () => {
    if (preco === null || preco === undefined) return;
    setMotivo("");
    persist(null);
  };

  return (
    <>
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Euro className="h-4 w-4" /> Preço da consulta
          </CardTitle>
          <div className="flex items-center gap-2">
            {preco !== null && preco !== undefined && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleReset} disabled={saving}>
                <RotateCcw className="h-3.5 w-3.5" /> Preço geral
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}>
              <Pencil className="h-3.5 w-3.5" /> Alterar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Preço atual</p>
            {preco !== null && preco !== undefined ? (
              <p className="text-2xl font-semibold">{fmt(preco)}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Preço geral do serviço</p>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Histórico de preços</p>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> A carregar…
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nunca houve alterações de preço.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {history.map((h) => (
                  <li key={h.id} className="p-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{fmt(h.valor_anterior)}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold">{fmt(h.valor)}</span>
                        {h.valor === null && <span className="text-xs text-muted-foreground">(voltou ao geral)</span>}
                      </div>
                      {h.motivo && <p className="text-xs text-muted-foreground mt-0.5 truncate">{h.motivo}</p>}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 sm:text-right">
                      {format(parseISO(h.criado_em), "dd/MM/yyyy HH:mm", { locale: pt })}
                      {h.criado_por_nome && <span> · {h.criado_por_nome}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar preço da consulta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="preco-valor">Valor (€)</Label>
              <Input
                id="preco-valor"
                type="number"
                min={0}
                step="0.01"
                placeholder="0,00"
                value={valorInput}
                onChange={(e) => setValorInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="preco-motivo">Motivo (opcional)</Label>
              <Textarea
                id="preco-motivo"
                rows={2}
                placeholder="Ex.: condição especial, cliente antigo…"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
