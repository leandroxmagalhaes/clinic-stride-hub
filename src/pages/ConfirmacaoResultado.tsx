import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertCircle, CalendarClock, Info } from "lucide-react";

type Estado = "confirmado" | "ja-confirmado" | "remarcado" | "metodo-registado" | "erro";

const MENSAGENS: Record<Estado, { titulo: string; texto: string; icon: JSX.Element; cor: string; bg: string }> = {
  "confirmado": {
    titulo: "Presença confirmada",
    texto: "Obrigado por confirmar. Contamos consigo.",
    icon: <CheckCircle2 className="h-12 w-12" strokeWidth={1.5} />,
    cor: "#16a34a",
    bg: "#dcfce7",
  },
  "ja-confirmado": {
    titulo: "Presença já confirmada",
    texto: "A sua presença já estava registada. Obrigado.",
    icon: <Info className="h-12 w-12" strokeWidth={1.5} />,
    cor: "#2563eb",
    bg: "#dbeafe",
  },
  "remarcado": {
    titulo: "Pedido registado",
    texto: "Recebemos o seu pedido de remarcação. Vamos entrar em contacto para combinar uma nova data.",
    icon: <CalendarClock className="h-12 w-12" strokeWidth={1.5} />,
    cor: "#2563eb",
    bg: "#dbeafe",
  },
  "erro": {
    titulo: "Link inválido",
    texto: "Este link expirou ou já foi usado. Por favor contacte a clínica.",
    icon: <AlertCircle className="h-12 w-12" strokeWidth={1.5} />,
    cor: "#dc2626",
    bg: "#fee2e2",
  },
};

export default function ConfirmacaoResultado() {
  const [params] = useSearchParams();
  const eRaw = params.get("e") || "erro";
  const estado: Estado = (["confirmado", "ja-confirmado", "remarcado", "erro"].includes(eRaw) ? eRaw : "erro") as Estado;
  const m = MENSAGENS[estado];

  const [clinic, setClinic] = useState<{ name: string; phone: string | null; email: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("clinics")
        .select("name, phone, email")
        .limit(1)
        .maybeSingle();
      if (data) setClinic(data);
    })();
  }, []);

  const phone = clinic?.phone || "+351 936 199 829";
  const email = clinic?.email || "";
  const clinicName = clinic?.name || "Clínica";

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f5", padding: "24px 16px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "12px 0 24px" }}>
          <h1 style={{ margin: 0, color: "#be123c", fontSize: 20, letterSpacing: 1, textTransform: "uppercase" }}>{clinicName}</h1>
        </div>
        <div style={{ background: "#ffffff", borderRadius: 14, padding: "36px 24px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)", textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: m.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18, color: m.cor }}>
            {m.icon}
          </div>
          <h2 style={{ margin: "0 0 10px", color: "#18181b", fontSize: 24 }}>{m.titulo}</h2>
          <p style={{ margin: 0, color: "#52525b", fontSize: 15, lineHeight: 1.6 }}>{m.texto}</p>
        </div>
        <div style={{ textAlign: "center", padding: "20px 8px", color: "#71717a", fontSize: 13, lineHeight: 1.6 }}>
          {phone && <div>Tel: {phone}</div>}
          {email && <div>{email}</div>}
        </div>
      </div>
    </div>
  );
}
