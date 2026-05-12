import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, Loader2, MessageCircle, Mail, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  reason: string; // "expired" | "used" | "not_found" | custom message
  onLogin?: () => void;
  whatsappNumber?: string; // E.164 sem '+', ex: "351912345678"
}

const REASON_TEXT: Record<string, { title: string; bullets: string[] }> = {
  expired: {
    title: "O seu link expirou",
    bullets: [
      "Os links de acesso são válidos durante 7 dias",
      "Pode pedir um novo link abaixo",
      "Ou contacte directamente a clínica",
    ],
  },
  used: {
    title: "Este link já foi usado",
    bullets: [
      "Cada link só pode ser usado uma vez",
      "Se já criou a sua conta, faça login com o seu email e password",
      "Se nunca chegou a entrar, peça um novo link abaixo",
    ],
  },
  not_found: {
    title: "Não conseguimos encontrar o seu link",
    bullets: [
      "Pode ter sido enviado um link mais recente — verifique o seu email",
      "O link pode ter sido copiado de forma incompleta",
      "Pode pedir um novo link abaixo",
    ],
  },
};

export function PortalErrorScreen({ reason, onLogin, whatsappNumber }: Props) {
  const info = REASON_TEXT[reason] ?? {
    title: "Não foi possível aceder ao seu link",
    bullets: [reason || "Tente novamente ou contacte a clínica."],
  };

  const [email, setEmail] = useState("");
  const [showRequest, setShowRequest] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  const handleRequestNewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Indique o seu email.");
      return;
    }
    setRequesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-new-portal-link", {
        body: { email: email.trim().toLowerCase() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRequested(true);
      toast.success("Se existir uma conta, enviámos-lhe um novo link.");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível enviar o link agora.");
    } finally {
      setRequesting(false);
    }
  };

  const waHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
        "Olá, estou com problemas a aceder ao Portal."
      )}`
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>{info.title}</CardTitle>
          <CardDescription className="pt-2 text-left">
            <ul className="list-disc pl-5 space-y-1">
              {info.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {requested ? (
            <div className="flex items-start gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Se existir uma conta com esse email, enviámos um novo link agora mesmo. Verifique também a pasta de spam.</span>
            </div>
          ) : showRequest ? (
            <form onSubmit={handleRequestNewLink} className="space-y-3">
              <div>
                <Label htmlFor="newlink-email">O seu email</Label>
                <Input
                  id="newlink-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                  disabled={requesting}
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" className="w-full" disabled={requesting}>
                {requesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A enviar...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" /> Enviar novo link
                  </>
                )}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setShowRequest(false)}>
                Cancelar
              </Button>
            </form>
          ) : (
            <Button className="w-full" onClick={() => setShowRequest(true)}>
              <Mail className="mr-2 h-4 w-4" /> Pedir novo link
            </Button>
          )}

          {waHref && (
            <Button variant="outline" className="w-full" asChild>
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> Falar com a clínica
              </a>
            </Button>
          )}

          {onLogin && (
            <Button variant="ghost" className="w-full" onClick={onLogin}>
              Já tenho conta — ir para Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PortalErrorScreen;
