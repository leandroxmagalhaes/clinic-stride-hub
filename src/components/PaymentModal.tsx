// PaymentModal — 4 métodos: MB Way, Multibanco, Dinheiro, Paga depois
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Smartphone, Landmark, Banknote, Clock, Copy, MessageCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  patientId: string | null;
  patientName?: string;
  patientPhone?: string;
  amount: number;
  onPaid?: () => void;
}

type Step =
  | "choose"
  | "mbway-phone"
  | "mbway-waiting"
  | "mbway-paid"
  | "mbway-expired"
  | "multibanco"
  | "dinheiro-confirm"
  | "loading";

export function PaymentModal({
  isOpen,
  onClose,
  sessionId,
  patientId,
  patientName,
  patientPhone,
  amount,
  onPaid,
}: PaymentModalProps) {
  const [step, setStep] = useState<Step>("choose");
  const [phone, setPhone] = useState(patientPhone || "");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [mbData, setMbData] = useState<{ entity: string; reference: string; amount: string } | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("choose");
      setPhone(patientPhone || "");
      setPaymentId(null);
      setMbData(null);
    }
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isOpen, patientPhone]);

  const callCreatePayment = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("create-payment", { body });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.error || "Falha ao criar pagamento");
    return data as any;
  };

  const handleMbWay = async () => {
    if (!sessionId || !patientId) return;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 9) {
      toast.error("Telefone inválido");
      return;
    }
    setStep("loading");
    try {
      const res = await callCreatePayment({
        session_id: sessionId,
        patient_id: patientId,
        amount,
        method: "mbway",
        phone: cleaned,
      });
      setPaymentId(res.payment_id);
      setStep("mbway-waiting");
      // Polling do estado
      const started = Date.now();
      pollRef.current = window.setInterval(async () => {
        if (Date.now() - started > 5 * 60 * 1000) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setStep("mbway-expired");
          return;
        }
        const { data } = await supabase
          .from("payments")
          .select("status")
          .eq("id", res.payment_id)
          .maybeSingle();
        if (data?.status === "pago") {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setStep("mbway-paid");
          onPaid?.();
        } else if (data?.status === "expirado" || data?.status === "cancelado") {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setStep("mbway-expired");
        }
      }, 3000);
    } catch (e) {
      toast.error((e as Error).message);
      setStep("choose");
    }
  };

  const handleMultibanco = async () => {
    if (!sessionId || !patientId) return;
    setStep("loading");
    try {
      const res = await callCreatePayment({
        session_id: sessionId,
        patient_id: patientId,
        amount,
        method: "multibanco",
      });
      setPaymentId(res.payment_id);
      setMbData({ entity: res.entity, reference: res.reference, amount: res.amount });
      setStep("multibanco");
    } catch (e) {
      toast.error((e as Error).message);
      setStep("choose");
    }
  };

  const handleDinheiro = async () => {
    if (!sessionId || !patientId) return;
    setStep("loading");
    try {
      await callCreatePayment({
        session_id: sessionId,
        patient_id: patientId,
        amount,
        method: "dinheiro",
      });
      setStep("dinheiro-confirm");
      onPaid?.();
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      toast.error((e as Error).message);
      setStep("choose");
    }
  };

  const handlePagaDepois = async () => {
    if (!sessionId || !patientId) return;
    setStep("loading");
    try {
      // Inserção direta com status pendente (idempotente por session_id)
      const { error } = await (supabase as any)
        .from("payments")
        .upsert(
          { session_id: sessionId, patient_id: patientId, amount, status: "pendente" },
          { onConflict: "session_id" },
        );
      if (error) throw error;
      toast.success("Marcado como 'A receber'");
      onPaid?.();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
      setStep("choose");
    }
  };

  const copyReference = () => {
    if (!mbData) return;
    const txt = `Entidade: ${mbData.entity}\nReferência: ${mbData.reference}\nValor: ${mbData.amount}€`;
    navigator.clipboard.writeText(txt);
    toast.success("Referência copiada");
  };

  const sendWhatsApp = () => {
    if (!mbData) return;
    const msg = encodeURIComponent(
      `Olá${patientName ? " " + patientName.split(" ")[0] : ""}! Dados para pagamento da sessão:\n\n` +
        `Entidade: ${mbData.entity}\nReferência: ${mbData.reference}\nValor: ${mbData.amount}€\n\n` +
        `Pode pagar em qualquer caixa Multibanco, homebanking ou MB Way (referência). Obrigado!`,
    );
    const tel = (patientPhone || "").replace(/\D/g, "");
    const url = tel ? `https://wa.me/${tel}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Pagamento
          </DialogTitle>
          <DialogDescription>
            {patientName ? <span className="font-medium text-foreground">{patientName}</span> : "Sessão"}
            {" · "}
            <span className="font-semibold text-foreground">{amount.toFixed(2)}€</span>
          </DialogDescription>
        </DialogHeader>

        {step === "loading" && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {step === "choose" && (
          <div className="grid grid-cols-1 gap-2">
            <Button
              size="lg"
              variant="outline"
              className="min-h-[56px] justify-start gap-3 text-base"
              onClick={() => setStep("mbway-phone")}
            >
              <Smartphone className="h-5 w-5 text-primary" />
              <div className="flex-1 text-left">
                <div className="font-semibold">MB Way</div>
                <div className="text-xs text-muted-foreground">Notificação no telemóvel</div>
              </div>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-h-[56px] justify-start gap-3 text-base"
              onClick={handleMultibanco}
            >
              <Landmark className="h-5 w-5 text-primary" />
              <div className="flex-1 text-left">
                <div className="font-semibold">Referência Multibanco</div>
                <div className="text-xs text-muted-foreground">Pagar no MB ou homebanking</div>
              </div>
            </Button>
            <Button
              size="lg"
              className="min-h-[56px] justify-start gap-3 text-base bg-green-600 hover:bg-green-700"
              onClick={handleDinheiro}
            >
              <Banknote className="h-5 w-5" />
              <div className="flex-1 text-left">
                <div className="font-semibold">Dinheiro 💶</div>
                <div className="text-xs opacity-90">Confirmar pagamento agora</div>
              </div>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="min-h-[56px] justify-start gap-3 text-base"
              onClick={handlePagaDepois}
            >
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 text-left">
                <div className="font-semibold">Paga depois</div>
                <div className="text-xs text-muted-foreground">Adicionar a "A receber"</div>
              </div>
            </Button>
          </div>
        )}

        {step === "mbway-phone" && (
          <div className="space-y-3">
            <Button variant="ghost" size="sm" onClick={() => setStep("choose")} className="gap-1 h-8 px-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Label htmlFor="phone">Telemóvel MB Way</Label>
            <Input
              id="phone"
              inputMode="tel"
              placeholder="912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-h-[48px] text-base"
            />
            <Button onClick={handleMbWay} className="w-full min-h-[48px]" size="lg">
              Enviar pedido
            </Button>
          </div>
        )}

        {step === "mbway-waiting" && (
          <div className="text-center space-y-3 py-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-sm">A aguardar confirmação no telemóvel…</p>
            <p className="text-xs text-muted-foreground">Não feche esta janela. Expira em 5 minutos.</p>
          </div>
        )}

        {step === "mbway-paid" && (
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <p className="font-semibold text-lg">Pagamento recebido!</p>
            <Button onClick={onClose} className="w-full">
              Fechar
            </Button>
          </div>
        )}

        {step === "mbway-expired" && (
          <div className="text-center space-y-3 py-4">
            <Badge variant="destructive">Expirado / sem confirmação</Badge>
            <Button onClick={() => setStep("choose")} className="w-full" variant="outline">
              Escolher outro método
            </Button>
          </div>
        )}

        {step === "multibanco" && mbData && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-1 text-center">
              <div className="text-xs text-muted-foreground">Entidade</div>
              <div className="text-2xl font-mono font-bold tracking-wider">{mbData.entity}</div>
              <div className="text-xs text-muted-foreground mt-2">Referência</div>
              <div className="text-2xl font-mono font-bold tracking-wider">{mbData.reference}</div>
              <div className="text-xs text-muted-foreground mt-2">Valor</div>
              <div className="text-xl font-semibold">{mbData.amount}€</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2 min-h-[48px]" onClick={copyReference}>
                <Copy className="h-4 w-4" /> Copiar
              </Button>
              <Button className="flex-1 gap-2 min-h-[48px] bg-green-600 hover:bg-green-700" onClick={sendWhatsApp}>
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            </div>
            <Button variant="ghost" onClick={onClose} className="w-full">
              Fechar
            </Button>
          </div>
        )}

        {step === "dinheiro-confirm" && (
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <p className="font-semibold text-lg">Pago em dinheiro 💶</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
