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

interface AddCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patientId: string;
  onAddCredits: (amount: number, description: string) => void;
}

const PACK_OPTIONS = [
  { id: "pack-1", name: "Pack 1 sessão", credits: 1, price: "R$ 120" },
  { id: "pack-4", name: "Pack 4 sessões", credits: 4, price: "R$ 440" },
  { id: "pack-8", name: "Pack 8 sessões", credits: 8, price: "R$ 800" },
  { id: "pack-12", name: "Pack 12 sessões", credits: 12, price: "R$ 1.080" },
  { id: "custom", name: "Personalizado", credits: 0, price: "" },
];

export function AddCreditsModal({
  isOpen,
  onClose,
  patientName,
  patientId,
  onAddCredits,
}: AddCreditsModalProps) {
  const [selectedPack, setSelectedPack] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    const pack = PACK_OPTIONS.find((p) => p.id === selectedPack);
    
    let amount: number;
    let desc: string;

    if (selectedPack === "custom") {
      amount = parseInt(customAmount, 10);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Informe uma quantidade válida de créditos");
        return;
      }
      desc = description || `Compra de ${amount} crédito(s) - Personalizado`;
    } else if (pack) {
      amount = pack.credits;
      desc = description || `Compra de ${pack.name} (${pack.credits} créditos)`;
    } else {
      toast.error("Selecione um pack de créditos");
      return;
    }

    onAddCredits(amount, desc);
    toast.success(`${amount} crédito(s) adicionado(s) com sucesso!`);
    resetAndClose();
  };

  const resetAndClose = () => {
    setSelectedPack("");
    setCustomAmount("");
    setDescription("");
    onClose();
  };

  const isCustom = selectedPack === "custom";

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
                      {pack.price && (
                        <span className="text-muted-foreground ml-auto">
                          - {pack.price}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isCustom && (
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
          )}

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Observações sobre a compra..."
              rows={2}
            />
          </div>

          {selectedPack && !isCustom && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total de créditos:</span>
                <span className="text-lg font-bold text-primary">
                  +{PACK_OPTIONS.find((p) => p.id === selectedPack)?.credits}
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
            disabled={!selectedPack || (isCustom && !customAmount)}
          >
            <Coins className="h-4 w-4 mr-2" />
            Confirmar Compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
