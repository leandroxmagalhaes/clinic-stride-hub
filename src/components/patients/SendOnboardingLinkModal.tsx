import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Copy, Mail, Check, ArrowLeft } from "lucide-react";
import { Patient, PatientService } from "@/services/PatientService";
import { toast } from "sonner";

interface SendOnboardingLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
}

export function SendOnboardingLinkModal({ isOpen, onClose, patients }: SendOnboardingLinkModalProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = PatientService.filterBySearch(patients, search);

  const buildLink = (token: string) =>
    `${window.location.origin}/pre-registo/${token}`;

  const handleCopy = async () => {
    if (!selected?.public_token) return;
    try {
      await navigator.clipboard.writeText(buildLink(selected.public_token));
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  const handleClose = () => {
    setSearch("");
    setSelected(null);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-[480px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">
            {selected ? "Enviar Link de Pré-Registo" : "Selecionar Utente"}
          </DialogTitle>
        </DialogHeader>

        {selected ? (
          <div className="space-y-4 py-2">
            <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setCopied(false); }} className="gap-1 -ml-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {selected.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{selected.full_name}</p>
                {selected.email && <p className="text-xs text-muted-foreground">{selected.email}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground break-all bg-muted p-2 rounded">
                {selected.public_token ? buildLink(selected.public_token) : "Token não disponível"}
              </p>

              <div className="flex gap-2">
                <Button onClick={handleCopy} className="flex-1 gap-2" variant={copied ? "secondary" : "default"} disabled={!selected.public_token}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado!" : "Copiar Link"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar utente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-1 max-h-[400px]">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum utente encontrado</p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent text-left transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {p.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.phone}{p.email ? ` · ${p.email}` : ""}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
