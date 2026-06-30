import { useSearchParams } from "react-router-dom";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export default function ConfirmarRemarcacao() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const simHref = `${SUPABASE_URL}/functions/v1/confirmar-presenca?token=${encodeURIComponent(token)}&accao=remarcar&confirmar=1`;
  const naoHref = `/r?e=ja-confirmado`;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f5", padding: "24px 16px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "12px 0 24px" }}>
          <h1 style={{ margin: 0, color: "#be123c", fontSize: 20, letterSpacing: 1, textTransform: "uppercase" }}>Clínica</h1>
        </div>
        <div style={{ background: "#ffffff", borderRadius: 14, padding: "36px 24px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
          <h2 style={{ margin: "0 0 12px", color: "#18181b", fontSize: 22, textAlign: "center" }}>Quer mesmo remarcar?</h2>
          <p style={{ margin: "0 0 24px", color: "#52525b", fontSize: 15, lineHeight: 1.6, textAlign: "center" }}>
            Ao remarcar, a sua vaga de amanhã fica livre e a equipa entra em contacto para combinar uma nova data.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <a
              href={simHref}
              style={{ display: "inline-block", background: "#be123c", color: "#ffffff", textDecoration: "none", fontWeight: 600, fontSize: 16, padding: "16px 28px", borderRadius: 10, minWidth: 260, textAlign: "center" }}
            >
              Sim, pedir remarcação
            </a>
            <a
              href={naoHref}
              style={{ display: "inline-block", background: "transparent", color: "#52525b", textDecoration: "none", fontSize: 14, padding: "10px 18px", minWidth: 260, textAlign: "center" }}
            >
              Não, manter consulta
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
