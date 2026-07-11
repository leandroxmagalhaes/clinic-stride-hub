import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";

type TipoCaso = "respiratorio" | "motora" | "neurodesenvolvimento" | "vestibular";

const TIPO_CASO_OPCOES: { value: TipoCaso; label: string }[] = [
  { value: "respiratorio", label: "Fisioterapia respiratória" },
  { value: "motora", label: "Fisioterapia motora" },
  { value: "neurodesenvolvimento", label: "Neurodesenvolvimento (torcicolo e assimetria craniana)" },
  { value: "vestibular", label: "Reabilitação vestibular" },
];

function calcularIdade(dataNascimento: string): number | null {
  if (!dataNascimento) return null;
  const nasc = new Date(dataNascimento);
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function SolicitarVaga() {
  useEffect(() => {
    document.title = "Pedido de Vaga";
  }, []);

  const [nomePaciente, setNomePaciente] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [nif, setNif] = useState("");
  const [semNif, setSemNif] = useState(false);
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [tipoCaso, setTipoCaso] = useState<TipoCaso | "">("");
  const [urgente, setUrgente] = useState(false);
  const [motivoUrgencia, setMotivoUrgencia] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  const idade = useMemo(() => calcularIdade(dataNascimento), [dataNascimento]);
  const menorIdade = idade !== null && idade < 18;

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (!nomePaciente.trim()) e.nomePaciente = "Indique o nome do paciente.";
    if (!dataNascimento) e.dataNascimento = "Indique a data de nascimento.";
    else if (idade === null || idade < 0 || idade > 120) e.dataNascimento = "Data de nascimento inválida.";
    if (!semNif && !nif.trim()) e.nif = "Indique o NIF / documento de identificação, ou assinale que ainda não tem.";
    if (menorIdade && !nomeResponsavel.trim()) e.nomeResponsavel = "Indique o nome do responsável.";
    if (!telefone.trim()) e.telefone = "Indique o telefone de contacto.";
    if (!email.trim()) e.email = "Indique o email.";
    else if (!emailValido(email)) e.email = "Email inválido.";
    if (!tipoCaso) e.tipoCaso = "Escolha o tipo de caso.";
    if (urgente && !motivoUrgencia.trim()) e.motivoUrgencia = "Explique porque considera urgente.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const submeter = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (enviando) return;
    if (!validar()) return;

    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("solicitar-vaga", {
        body: {
          nome_paciente: nomePaciente.trim(),
          data_nascimento: dataNascimento,
          nome_responsavel: menorIdade ? nomeResponsavel.trim() : null,
          telefone: telefone.trim(),
          email: email.trim(),
          tipo_caso: tipoCaso,
          urgente,
          motivo_urgencia: urgente ? motivoUrgencia.trim() : null,
          observacoes: observacoes.trim() || null,
          website,
        },
      });

      if (error) throw error;
      if (data && (data as any).success === false) throw new Error((data as any).error || "Erro");

      setSucesso(true);
    } catch (err) {
      console.error("[solicitar-vaga] erro:", err);
      toast({
        title: "Não foi possível enviar o pedido",
        description: "Ocorreu um problema. Por favor tente novamente dentro de instantes.",
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4 sm:py-10">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 text-center">
          <p className="text-sm font-medium text-primary">Respira &amp; Desenvolve</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Pedido de Vaga</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A nossa equipa analisa cada pedido e entra em contacto brevemente.
          </p>
        </header>

        {sucesso ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="rounded-full bg-primary/10 p-3">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Pedido recebido</h2>
              <p className="text-sm text-muted-foreground">
                A equipa vai analisar o seu pedido e entrará em contacto brevemente. Enviámos também um email de
                confirmação.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preencha os seus dados</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submeter} className="space-y-5" noValidate>
                {/* Honeypot */}
                <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                  <label>
                    Website
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do paciente *</Label>
                  <Input
                    id="nome"
                    value={nomePaciente}
                    onChange={(e) => setNomePaciente(e.target.value)}
                    autoComplete="name"
                    required
                  />
                  {erros.nomePaciente && <p className="text-xs text-destructive">{erros.nomePaciente}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nasc">Data de nascimento *</Label>
                  <Input
                    id="nasc"
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    required
                  />
                  {idade !== null && idade >= 0 && idade <= 120 && (
                    <p className="text-xs text-muted-foreground">Idade: {idade} ano{idade === 1 ? "" : "s"}</p>
                  )}
                  {erros.dataNascimento && <p className="text-xs text-destructive">{erros.dataNascimento}</p>}
                </div>

                {menorIdade && (
                  <div className="space-y-2">
                    <Label htmlFor="responsavel">Nome do responsável *</Label>
                    <Input
                      id="responsavel"
                      value={nomeResponsavel}
                      onChange={(e) => setNomeResponsavel(e.target.value)}
                      autoComplete="name"
                      required
                    />
                    {erros.nomeResponsavel && <p className="text-xs text-destructive">{erros.nomeResponsavel}</p>}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone *</Label>
                  <Input
                    id="telefone"
                    type="tel"
                    inputMode="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    autoComplete="tel"
                    required
                  />
                  {erros.telefone && <p className="text-xs text-destructive">{erros.telefone}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                  {erros.email && <p className="text-xs text-destructive">{erros.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Tipo de caso *</Label>
                  <RadioGroup
                    value={tipoCaso}
                    onValueChange={(v) => setTipoCaso(v as TipoCaso)}
                    className="gap-2"
                  >
                    {TIPO_CASO_OPCOES.map((opt) => (
                      <label
                        key={opt.value}
                        htmlFor={`tipo-${opt.value}`}
                        className="flex items-start gap-3 rounded-md border border-input p-3 cursor-pointer hover:bg-accent"
                      >
                        <RadioGroupItem id={`tipo-${opt.value}`} value={opt.value} className="mt-0.5" />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </RadioGroup>
                  {erros.tipoCaso && <p className="text-xs text-destructive">{erros.tipoCaso}</p>}
                </div>

                <div className="flex items-center justify-between rounded-md border border-input p-3">
                  <Label htmlFor="urgente" className="cursor-pointer">É um caso urgente?</Label>
                  <Switch id="urgente" checked={urgente} onCheckedChange={setUrgente} />
                </div>

                {urgente && (
                  <div className="space-y-2">
                    <Label htmlFor="motivo">Porque considera urgente? *</Label>
                    <Textarea
                      id="motivo"
                      value={motivoUrgencia}
                      onChange={(e) => setMotivoUrgencia(e.target.value)}
                      rows={3}
                      required
                    />
                    {erros.motivoUrgencia && <p className="text-xs text-destructive">{erros.motivoUrgencia}</p>}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="obs">Observações</Label>
                  <Textarea
                    id="obs"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={4}
                    placeholder="Se quiser, partilhe outra informação relevante."
                  />
                </div>

                <Button type="submit" className="w-full" disabled={enviando}>
                  {enviando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      A enviar...
                    </>
                  ) : (
                    "Enviar pedido"
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Os dados enviados serão usados apenas para contacto sobre a disponibilidade de vaga.
                </p>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
