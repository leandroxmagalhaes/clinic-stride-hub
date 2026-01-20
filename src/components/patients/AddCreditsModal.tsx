import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Coins, Package } from "lucide-react";
import { toast } from "sonner";

export interface CreditPurchaseData {
  amount: number;
  description: string;
  monetaryValue: number;
  paymentMethod: 'pix' | 'credit_card' | 'cash' | 'transfer';
  paymentStatus: 'paid' | 'pending';
}

interface AddCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patientId: string;
  onAddCredits: (data: CreditPurchaseData) => Promise<void> | void;
}

const PACK_OPTIONS = [
  { id: "pack-1", name: "Pack 1 sessão", credits: 1, price: 120 },
  { id: "pack-4", name: "Pack 4 sessões", credits: 4, price: 440 },
  { id: "pack-8", name: "Pack 8 sessões", credits: 8, price: 800 },
  { id: "pack-12", name: "Pack 12 sessões", credits: 12, price: 1080 },
  { id: "custom", name: "Personalizado", credits: 0, price: 0 },
];

const PAYMENT_METHODS = [
  { id: "pix", label: "PIX" },
  { id: "credit_card", label: "Cartão de Crédito" },
  { id: "cash", label: "Dinheiro" },
  { id: "transfer", label: "Transferência" },
] as const;

export function AddCreditsModal({
  isOpen,
  onClose,
  patientName,
  patientId,
  onAddCredits,
}: AddCreditsModalProps) {
  const [selectedPack, setSelectedPack] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'cash' | 'transfer'>("pix");
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>("paid");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async () => {
    const pack = PACK_OPTIONS.find((p) => p.id === selectedPack);
    
    let amount: number;
    let monetaryValue: number;
    let desc: string;

    if (selectedPack === "custom") {
      amount = parseInt(customAmount, 10);
      monetaryValue = parseFloat(customPrice) || 0;
      if (isNaN(amount) || amount <= 0) {
        toast.error("Informe uma quantidade válida de créditos");
        return;
      }
      if (monetaryValue <= 0) {
        toast.error("Informe o valor cobrado");
        return;
      }
      desc = description || `Compra de ${amount} crédito(s) - Personalizado`;
    } else if (pack) {
      amount = pack.credits;
      monetaryValue = pack.price;
      desc = description || `Compra de ${pack.name} (${pack.credits} créditos)`;
    } else {
      toast.error("Selecione um pack de créditos");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddCredits({
        amount,
        description: desc,
        monetaryValue,
        paymentMethod,
        paymentStatus,
      });
      toast.success(`${amount} crédito(s) adicionado(s) com sucesso!`);
      resetAndClose();
    } catch (error) {
      console.error('Error adding credits:', error);
      toast.error("Erro ao adicionar créditos. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setSelectedPack("");
    setCustomAmount("");
    setCustomPrice("");
    setDescription("");
    setPaymentMethod("pix");
    setPaymentStatus("paid");
    onClose();
  };

  const isCustom = selectedPack === "custom";
  const selectedPackData = PACK_OPTIONS.find((p) => p.id === selectedPack);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Adicionar Créditos
          </DialogTitle>
          <DialogDescription>
            Registrar venda de pack de sessões para <strong>{patientName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Tipo de Pack</Label>
            <Select value={selectedPack} onValueChange={setSelectedPack}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Selecione o pack" />
              </SelectTrigger>
              <SelectContent>
                {PACK_OPTIONS.map((pack) => (
                  <SelectItem key={pack.id} value={pack.id} className="min-h-[44px]">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span>{pack.name}</span>
                      {pack.price > 0 && (
                        <span className="text-muted-foreground ml-auto">
                          - {formatCurrency(pack.price)}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isCustom && (
            <>
              <div className="space-y-2">
                <Label>Quantidade de Créditos</Label>
                <Input
                  type="number"
                  min="1"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Ex: 10"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Cobrado (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="Ex: 500.00"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.id} value={method.id} className="min-h-[44px]">
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status do Pagamento</Label>
            <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as typeof paymentStatus)}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid" className="min-h-[44px]">Pago</SelectItem>
                <SelectItem value="pending" className="min-h-[44px]">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Observações sobre a compra..."
              rows={2}
            />
          </div>

          {selectedPack && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total de créditos:</span>
                <span className="text-lg font-bold text-primary">
                  +{isCustom ? (parseInt(customAmount) || 0) : selectedPackData?.credits}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Valor:</span>
                <span className="text-lg font-bold text-primary">
                  {isCustom 
                    ? formatCurrency(parseFloat(customPrice) || 0) 
                    : formatCurrency(selectedPackData?.price || 0)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={resetAndClose}
            className="min-h-[44px] w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="min-h-[44px] w-full sm:w-auto"
            disabled={!selectedPack || (isCustom && !customAmount) || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Salvando...
              </>
            ) : (
              <>
                <Coins className="h-4 w-4 mr-2" />
                Confirmar Compra
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
