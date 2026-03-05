import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useData, Pack } from "@/contexts/DataContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, Plus, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";

interface PackManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

export function PackManagerModal({
  isOpen,
  onClose,
  patientId,
  patientName,
}: PackManagerModalProps) {
  const { packs, addPack, updatePack, deletePack, getActivePack } = useData();
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletePackId, setDeletePackId] = useState<string | null>(null);

  // New pack form state
  const [quantidade, setQuantidade] = useState(10);
  const [valorTotal, setValorTotal] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<"pago" | "pendente" | "parcial">("pendente");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [notes, setNotes] = useState("");

  const patientPacks = packs
    .filter((p) => p.paciente_id === patientId)
    .sort((a, b) => b.numero_pack - a.numero_pack);

  const activePack = getActivePack(patientId);

  const handleCreatePack = async () => {
    setIsLoading(true);
    try {
      await addPack({
        paciente_id: patientId,
        data_inicio: new Date().toISOString().split("T")[0],
        quantidade_sessoes: quantidade,
        valor_total: valorTotal,
        payment_status: paymentStatus,
        payment_method: paymentMethod || null,
        paid_at: paymentStatus === "pago" ? new Date().toISOString() : null,
        notes: notes || null,
        is_active: true,
      });
      toast.success("Pack criado com sucesso!");
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar pack");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePack = async () => {
    if (!deletePackId) return;
    try {
      await deletePack(deletePackId);
      toast.success("Pack eliminado");
      setDeletePackId(null);
    } catch (err) {
      toast.error("Erro ao eliminar pack");
    }
  };

  const handleToggleActive = async (pack: Pack) => {
    try {
      await updatePack(pack.id, { is_active: !pack.is_active });
      toast.success(pack.is_active ? "Pack desactivado" : "Pack reactivado");
    } catch (err) {
      toast.error("Erro ao alterar estado do pack");
    }
  };

  const resetForm = () => {
    setIsCreating(false);
    setQuantidade(10);
    setValorTotal(0);
    setPaymentStatus("pendente");
    setPaymentMethod("");
    setNotes("");
  };

  const getAlertBadge = (pack: Pack) => {
    switch (pack.alert_status) {
      case "esgotado":
        return <Badge variant="destructive">Esgotado</Badge>;
      case "ultima_sessao":
        return <Badge className="bg-orange-500 text-white">Última sessão</Badge>;
      case "penultima_sessao":
        return <Badge className="bg-yellow-500 text-white">Penúltima sessão</Badge>;
      default:
        return <Badge className="bg-emerald-500 text-white">Activo</Badge>;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Packs — {patientName}
            </DialogTitle>
          </DialogHeader>

          {/* Active pack summary */}
          {activePack && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">
                    Pack #{activePack.numero_pack}
                  </span>
                  {getAlertBadge(activePack)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Usadas</span>
                    <p className="font-medium">
                      {activePack.sessoes_usadas}/{activePack.quantidade_sessoes}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Restantes</span>
                    <p className="font-medium">{activePack.sessoes_restantes}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor</span>
                    <p className="font-medium">€{activePack.valor_total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create new pack */}
          {isCreating ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h4 className="font-medium text-sm">Novo Pack</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Quantidade de sessões</Label>
                    <Input
                      type="number"
                      min={1}
                      value={quantidade}
                      onChange={(e) => setQuantidade(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Valor total (€)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={valorTotal}
                      onChange={(e) => setValorTotal(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Estado pagamento</Label>
                    <Select
                      value={paymentStatus}
                      onValueChange={(v) => setPaymentStatus(v as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="parcial">Parcial</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Método pagamento</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Numerário</SelectItem>
                        <SelectItem value="mbway">MBWay</SelectItem>
                        <SelectItem value="multibanco">Multibanco</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notas (opcional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreatePack}
                    disabled={isLoading || quantidade < 1}
                  >
                    {isLoading ? "A criar..." : "Criar Pack"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Pack
            </Button>
          )}

          {/* Pack history */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Histórico ({patientPacks.length})
            </h4>
            {patientPacks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum pack registado
              </p>
            ) : (
              patientPacks.map((pack) => (
                <Card
                  key={pack.id}
                  className={`${!pack.is_active ? "opacity-60" : ""}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          Pack #{pack.numero_pack}
                        </span>
                        {getAlertBadge(pack)}
                        {pack.payment_status === "pago" && (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                        {pack.payment_status === "pendente" && (
                          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleToggleActive(pack)}
                        >
                          {pack.is_active ? "Desactivar" : "Reactivar"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => setDeletePackId(pack.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {pack.sessoes_usadas}/{pack.quantidade_sessoes} sessões •
                      €{pack.valor_total} •{" "}
                      {format(new Date(pack.data_inicio), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={!!deletePackId}
        onClose={() => setDeletePackId(null)}
        onConfirm={handleDeletePack}
        title="Eliminar Pack"
        description="Tem certeza que deseja eliminar este pack? As sessões associadas serão desvinculadas."
        entityName="pack"
      />
    </>
  );
}
