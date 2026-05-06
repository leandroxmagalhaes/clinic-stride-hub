import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Send, ArrowLeft, MessageCircle, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PortalAccountService } from "@/services/PortalAccountService";
import {
  UnifiedThread,
  useUnifiedThread,
  enviarMensagemUnificada,
} from "@/components/messages/UnifiedThread";

const moodOptions = [
  { value: "great", label: "😄 Muito bem" },
  { value: "good", label: "🙂 Bem" },
  { value: "okay", label: "😐 Razoável" },
  { value: "bad", label: "😟 Mal" },
  { value: "terrible", label: "😢 Muito mal" },
];

const categoryOptions = [
  { value: "observation", label: "Observação" },
  { value: "improvement", label: "Melhoria" },
  { value: "worsening", label: "Piora" },
  { value: "exercise", label: "Exercício" },
  { value: "pain", label: "Dor" },
  { value: "fall", label: "Queda" },
  { value: "sleep", label: "Sono" },
  { value: "medication", label: "Medicação" },
  { value: "question", label: "Pergunta" },
];

export default function PortalMensagens() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [pacienteNome, setPacienteNome] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const { refresh } = useUnifiedThread(pacienteId);

  // Diary modal state
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [dHumor, setDHumor] = useState<string>("okay");
  const [dDor, setDDor] = useState<number>(0);
  const [dCategoria, setDCategoria] = useState<string>("observation");
  const [dTexto, setDTexto] = useState("");
  const [dSending, setDSending] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/portal/login");
      return;
    }
    (async () => {
      const result = await PortalAccountService.resolveForUser(user.id);
      if (result.status === "ok" && result.primaryPacienteId) {
        setPacienteId(result.primaryPacienteId);
        setPacienteNome(result.pacienteNome || "Utente");
      } else {
        navigate("/patient-portal");
      }
    })();
  }, [user, navigate]);

  // Mark professional messages as read when entering
  useEffect(() => {
    if (!pacienteId) return;
    (supabase as any)
      .from("portal_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("paciente_id", pacienteId)
      .eq("autor_tipo", "professional")
      .is("lida_em", null);
  }, [pacienteId]);

  const handleSend = async () => {
    if (!draft.trim() || !pacienteId) return;
    setSending(true);
    try {
      await enviarMensagemUnificada({
        paciente_id: pacienteId,
        texto: draft.trim(),
        autor_tipo: "patient",
        autor_nome: pacienteNome || "Utente",
        tipo: "mensagem",
      });
      setDraft("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  const handleDiary = async () => {
    if (!dTexto.trim() || !pacienteId) return;
    setDSending(true);
    try {
      await enviarMensagemUnificada({
        paciente_id: pacienteId,
        texto: dTexto.trim(),
        autor_tipo: "patient",
        autor_nome: pacienteNome || "Utente",
        tipo: "diario",
        humor: dHumor,
        categoria: dCategoria,
        nivel_dor: dDor,
      });
      toast.success("Registo de diário guardado!");
      setDiaryOpen(false);
      setDTexto("");
      setDDor(0);
      setDHumor("okay");
      setDCategoria("observation");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao guardar");
    } finally {
      setDSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/patient-portal")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Mensagens
            </h1>
            <p className="text-xs text-muted-foreground">Conversa com a clínica</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        <Card className="flex flex-col h-[calc(100vh-180px)]">
          <UnifiedThread pacienteId={pacienteId} viewerTipo="patient" />
          <div className="p-3 border-t flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDiaryOpen(true)}
              title="Novo registo de diário"
            >
              <BookOpen className="h-4 w-4" />
            </Button>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreva uma mensagem..."
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button onClick={handleSend} disabled={sending || !draft.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </main>

      <Dialog open={diaryOpen} onOpenChange={setDiaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo registo de diário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Como se sente?</Label>
              <Select value={dHumor} onValueChange={setDHumor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {moodOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nível de dor: {dDor}/10</Label>
              <Slider min={0} max={10} step={1} value={[dDor]} onValueChange={(v) => setDDor(v[0])} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={dCategoria} onValueChange={setDCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Como foi o seu dia?</Label>
              <Textarea
                value={dTexto}
                onChange={(e) => setDTexto(e.target.value)}
                rows={4}
                placeholder="Descreva o que aconteceu, como se sentiu..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDiaryOpen(false)} disabled={dSending}>
              Cancelar
            </Button>
            <Button onClick={handleDiary} disabled={dSending || !dTexto.trim()}>
              {dSending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
