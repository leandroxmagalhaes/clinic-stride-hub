import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Loader2, User, Phone, FileText, ShieldCheck, Copy } from "lucide-react";

interface PatientData {
  full_name: string;
  birth_date: string | null;
  gender: string | null;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  billing_name: string | null;
  billing_nif: string | null;
  billing_address: {
    rua?: string;
    numero?: string;
    andar?: string;
    codigo_postal?: string;
    localidade?: string;
  } | null;
  image_consent: boolean;
  data_consent: boolean;
  onboarding_completed_at: string | null;
}

interface ClinicInfo {
  name: string;
  logo_url: string;
}

export default function PreRegisto() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Determine mode: "new" if token is "novo", otherwise "edit"
  const isNewMode = token === "novo";
  const clinicIdParam = isNewMode ? searchParams.get("c") : null;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinic, setClinic] = useState<ClinicInfo>({ name: "", logo_url: "" });

  const [form, setForm] = useState<PatientData>({
    full_name: "",
    birth_date: null,
    gender: null,
    cpf: null,
    phone: null,
    email: null,
    height_cm: null,
    weight_kg: null,
    emergency_contact: null,
    emergency_phone: null,
    billing_name: null,
    billing_nif: null,
    billing_address: null,
    image_consent: false,
    data_consent: false,
    onboarding_completed_at: null,
  });

  useEffect(() => {
    if (isNewMode) {
      if (!clinicIdParam) {
        setError("Link inválido. Parâmetro de clínica em falta.");
        setLoading(false);
        return;
      }
      fetchClinicOnly();
    } else {
      if (!token) return;
      fetchPatientData();
    }
  }, [token, isNewMode, clinicIdParam]);

  const fetchClinicOnly = async () => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patient-onboarding?clinic_id=${clinicIdParam}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!response.ok) {
        setError("Link inválido ou clínica não encontrada.");
        setLoading(false);
        return;
      }

      const data = await response.json();
      setClinic(data.clinic);
    } catch {
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientData = async () => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patient-onboarding?token=${token}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!response.ok) {
        setError("Link inválido ou expirado.");
        setLoading(false);
        return;
      }

      const data = await response.json();
      setClinic(data.clinic);

      const p = data.patient;
      setForm({
        full_name: p.full_name || "",
        birth_date: p.birth_date || null,
        gender: p.gender || null,
        cpf: p.cpf || null,
        phone: p.phone || null,
        email: p.email || null,
        height_cm: p.height_cm || null,
        weight_kg: p.weight_kg || null,
        emergency_contact: p.emergency_contact || null,
        emergency_phone: p.emergency_phone || null,
        billing_name: p.billing_name || null,
        billing_nif: p.billing_nif || null,
        billing_address: p.billing_address || null,
        image_consent: p.image_consent || false,
        data_consent: p.data_consent || false,
        onboarding_completed_at: p.onboarding_completed_at || null,
      });

      if (p.onboarding_completed_at) {
        setSuccess(true);
      }
    } catch {
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof PatientData, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateBillingAddress = (field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      billing_address: {
        ...(prev.billing_address || {}),
        [field]: value,
      },
    }));
  };

  const replicarDados = () => {
    setForm((prev) => ({
      ...prev,
      billing_name: prev.full_name,
      billing_nif: prev.cpf,
    }));
    toast({ title: "Dados replicados com sucesso" });
  };

  const handleSubmit = async () => {
    if (!form.data_consent) {
      toast({
        title: "Consentimento obrigatório",
        description: "Deve aceitar o tratamento dos seus dados pessoais.",
        variant: "destructive",
      });
      return;
    }

    if (!form.full_name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, preencha o nome completo.",
        variant: "destructive",
      });
      return;
    }

    if (isNewMode && !form.phone?.trim()) {
      toast({
        title: "Telemóvel obrigatório",
        description: "Por favor, preencha o número de telemóvel.",
        variant: "destructive",
      });
      return;
    }

    if (!form.cpf?.trim() || form.cpf.replace(/\D/g, "").length !== 9) {
      toast({
        title: "NIF obrigatório",
        description: "Por favor, preencha o NIF com 9 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const queryParam = isNewMode ? `clinic_id=${clinicIdParam}` : `token=${token}`;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patient-onboarding?${queryParam}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: "Erro",
          description: result.error || "Erro ao atualizar dados.",
          variant: "destructive",
        });
        return;
      }

      setSuccess(true);
    } catch {
      toast({
        title: "Erro",
        description: "Erro de ligação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">{error}</h1>
          <p className="text-muted-foreground text-sm">
            Verifique se o link está correto ou contacte a clínica.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center space-y-4 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {isNewMode ? "O seu registo foi criado com sucesso!" : "Os seus dados foram atualizados com sucesso!"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Pode fechar esta página. Obrigado!
          </p>
          {clinic.name && (
            <p className="text-xs text-muted-foreground">{clinic.name}</p>
          )}
        </div>
      </div>
    );
  }

  const disabled = success || submitting;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-center">
        {clinic.logo_url ? (
          <img
            src={clinic.logo_url}
            alt={clinic.name}
            className="h-10 object-contain"
          />
        ) : (
          <h1 className="text-lg font-semibold text-foreground">
            {clinic.name || "Pré-Registo"}
          </h1>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            Ficha de Pré-Registo
          </h2>
          <p className="text-sm text-muted-foreground">
            Preencha os seus dados antes da consulta.
          </p>
        </div>

        <Accordion
          type="multiple"
          defaultValue={["pessoal", "contactos", "faturacao", "consentimentos"]}
          className="space-y-3"
        >
          {/* 1. Dados Pessoais */}
          <AccordionItem value="pessoal" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="font-medium">Dados Pessoais</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div>
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => updateField("full_name", e.target.value)}
                  disabled={disabled}
                  maxLength={200}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="birth_date">Data de Nascimento</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={form.birth_date || ""}
                    onChange={(e) => updateField("birth_date", e.target.value || null)}
                    disabled={disabled}
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Género</Label>
                  <Select
                    value={form.gender || ""}
                    onValueChange={(v) => updateField("gender", v)}
                    disabled={disabled}
                  >
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                      <SelectItem value="O">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="cpf">NIF *</Label>
                <Input
                  id="cpf"
                  value={form.cpf || ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 9);
                    updateField("cpf", v);
                  }}
                  placeholder="123456789"
                  disabled={disabled}
                  maxLength={9}
                  inputMode="numeric"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="height_cm">Altura (cm)</Label>
                  <Input
                    id="height_cm"
                    type="number"
                    value={form.height_cm ?? ""}
                    onChange={(e) =>
                      updateField("height_cm", e.target.value ? parseInt(e.target.value) : null)
                    }
                    placeholder="170"
                    disabled={disabled}
                    min={50}
                    max={250}
                  />
                </div>
                <div>
                  <Label htmlFor="weight_kg">Peso (kg)</Label>
                  <Input
                    id="weight_kg"
                    type="number"
                    value={form.weight_kg ?? ""}
                    onChange={(e) =>
                      updateField("weight_kg", e.target.value ? parseFloat(e.target.value) : null)
                    }
                    placeholder="70"
                    disabled={disabled}
                    min={10}
                    max={300}
                    step="0.1"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 2. Contactos */}
          <AccordionItem value="contactos" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span className="font-medium">Contactos</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="phone">Telemóvel</Label>
                  <Input
                    id="phone"
                    value={form.phone || ""}
                    onChange={(e) => updateField("phone", e.target.value)}
                    disabled={disabled}
                    maxLength={20}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email || ""}
                    onChange={(e) => updateField("email", e.target.value)}
                    disabled={disabled}
                    maxLength={255}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="emergency_contact">Contacto de Emergência</Label>
                  <Input
                    id="emergency_contact"
                    value={form.emergency_contact || ""}
                    onChange={(e) => updateField("emergency_contact", e.target.value)}
                    placeholder="Nome"
                    disabled={disabled}
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label htmlFor="emergency_phone">Telefone de Emergência</Label>
                  <Input
                    id="emergency_phone"
                    value={form.emergency_phone || ""}
                    onChange={(e) => updateField("emergency_phone", e.target.value)}
                    placeholder="Telefone"
                    disabled={disabled}
                    maxLength={20}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 3. Dados de Faturação */}
          <AccordionItem value="faturacao" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">Dados de Faturação</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={replicarDados}
                disabled={disabled}
                className="gap-2"
              >
                <Copy className="h-3.5 w-3.5" />
                Replicar dados cadastrais
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="billing_name">Nome na Fatura</Label>
                  <Input
                    id="billing_name"
                    value={form.billing_name || ""}
                    onChange={(e) => updateField("billing_name", e.target.value)}
                    disabled={disabled}
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label htmlFor="billing_nif">NIF da Fatura</Label>
                  <Input
                    id="billing_nif"
                    value={form.billing_nif || ""}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 9);
                      updateField("billing_nif", v);
                    }}
                    disabled={disabled}
                    maxLength={9}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div>
                <Label>Morada</Label>
                <div className="space-y-2 mt-1">
                  <Input
                    placeholder="Rua"
                    value={form.billing_address?.rua || ""}
                    onChange={(e) => updateBillingAddress("rua", e.target.value)}
                    disabled={disabled}
                    maxLength={200}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Número"
                      value={form.billing_address?.numero || ""}
                      onChange={(e) => updateBillingAddress("numero", e.target.value)}
                      disabled={disabled}
                      maxLength={20}
                    />
                    <Input
                      placeholder="Andar"
                      value={form.billing_address?.andar || ""}
                      onChange={(e) => updateBillingAddress("andar", e.target.value)}
                      disabled={disabled}
                      maxLength={20}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Código Postal"
                      value={form.billing_address?.codigo_postal || ""}
                      onChange={(e) => updateBillingAddress("codigo_postal", e.target.value)}
                      disabled={disabled}
                      maxLength={10}
                    />
                    <Input
                      placeholder="Localidade"
                      value={form.billing_address?.localidade || ""}
                      onChange={(e) => updateBillingAddress("localidade", e.target.value)}
                      disabled={disabled}
                      maxLength={100}
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 4. Consentimentos */}
          <AccordionItem value="consentimentos" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="font-medium">Consentimentos</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="image_consent"
                  checked={form.image_consent}
                  onCheckedChange={(v) => updateField("image_consent", !!v)}
                  disabled={disabled}
                />
                <Label htmlFor="image_consent" className="text-sm leading-relaxed cursor-pointer">
                  Autorizo o uso da minha imagem para fins de divulgação da clínica.
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="data_consent"
                  checked={form.data_consent}
                  onCheckedChange={(v) => updateField("data_consent", !!v)}
                  disabled={disabled}
                />
                <Label htmlFor="data_consent" className="text-sm leading-relaxed cursor-pointer">
                  Declaro que estou de acordo com o armazenamento e tratamento dos meus dados
                  pessoais. <span className="text-destructive">*</span>
                </Label>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button
          onClick={handleSubmit}
          disabled={disabled}
          className="w-full h-12 text-base"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            isNewMode ? "Submeter Registo" : "Atualizar Ficha"
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Os seus dados são tratados de forma confidencial e segura.
        </p>
      </div>
    </div>
  );
}
