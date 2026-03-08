import { useState, useCallback, useRef, CSSProperties } from "react";

/* ─── Paleta ────────────────────────────────────────────────────────────── */
const G = {
  gold: "#B8933A",
  goldLight: "#D4AF5A",
  goldPale: "#F5EDD0",
  goldBg: "#FDFAF2",
  dark: "#1C1C2E",
  darkMid: "#2E2E45",
  ink: "#2D2D2D",
  muted: "#6B6B7B",
  border: "#E2D5A8",
  borderLight: "#EDE4C0",
  white: "#FFFFFF",
  success: "#2D7A4F",
  error: "#C0392B",
};

/* ─── Utilitários de estilo ─────────────────────────────────────────────── */
const card = (extra: CSSProperties = {}): CSSProperties => ({
  background: G.white,
  borderRadius: 16,
  border: `1px solid ${G.border}`,
  boxShadow: "0 2px 20px rgba(0,0,0,0.06)",
  ...extra,
});

const btn = (variant = "primary", extra: CSSProperties = {}): CSSProperties => ({
  padding: "11px 22px",
  borderRadius: 10,
  border: "none",
  fontFamily: "inherit",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer" as const,
  transition: "all 0.2s" as const,
  ...(variant === "primary"
    ? {
        background: `linear-gradient(135deg, ${G.gold}, ${G.goldLight})`,
        color: "#4A2E00",
        boxShadow: `0 4px 14px ${G.gold}44`,
      }
    : variant === "ghost"
      ? {
          background: "transparent",
          color: G.muted,
          border: `1px solid ${G.border}`,
        }
      : {
          background: G.goldPale,
          color: G.dark,
          border: `1px solid ${G.border}`,
        }),
  ...extra,
});

const label = (extra: CSSProperties = {}): CSSProperties => ({
  display: "block" as const,
  fontSize: 11,
  fontWeight: 700,
  color: G.muted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.8px" as const,
  marginBottom: 5,
  ...extra,
});

const input = (extra: CSSProperties = {}): CSSProperties => ({
  width: "100%",
  padding: "9px 13px",
  borderRadius: 8,
  border: `1px solid ${G.border}`,
  fontSize: 13,
  fontFamily: "Georgia, serif",
  color: G.ink,
  background: G.white,
  boxSizing: "border-box" as const,
  outline: "none" as const,
  ...extra,
});

/* ─── Constantes ────────────────────────────────────────────────────────── */
const STEPS = [
  { id: 1, icon: "📤", label: "Upload" },
  { id: 2, icon: "🤖", label: "Análise IA" },
  { id: 3, icon: "✏️", label: "Editar" },
  { id: 4, icon: "📄", label: "Relatório" },
];

const SECOES_CONFIG = [
  { id: "parametros", label: "Parâmetros Técnicos", desc: "SIndex, PIF, Volume, PNV" },
  { id: "diagnostico", label: "Diagnóstico Funcional", desc: "DFR e classificação clínica" },
  { id: "intervencao", label: "Proposta de Intervenção", desc: "Equipamento, frequência, técnica" },
  { id: "metas", label: "Metas Clínicas", desc: "Curto e médio prazo" },
  { id: "progressao", label: "Tabela de Progressão Semanal", desc: "Cargas semana a semana" },
  { id: "mobilidade", label: "Exercícios de Mobilidade", desc: "Expansão torácica e higiene brônquica" },
];

const EMPTY_DATA = {
  nome: "",
  data: "",
  idade: "",
  peso: "",
  altura: "",
  bmi: "",
  pnv: "",
  sindex_best: "",
  sindex_avg: "",
  percentagem_pnv: "",
  pif: "",
  volume: "",
  grau_fraqueza: "",
  diagnostico: "",
  observacao_clinica: "",
  equipamento: "",
  frequencia: "",
  repeticoes: "",
  carga_inicial: "",
  tecnica: "",
  meta_curto: "",
  meta_medio: "",
  mobilidade: "",
  fisioterapeuta: "Camila Maria Oliveira Té Magalhães",
  cedula: "nº 9875 da OF",
  progressao: [
    { semana: "1", carga: "10-12", criterio: "Iniciar com a carga base definida." },
    { semana: "2", carga: "12-14", criterio: "Manutenção de boa técnica e tolerância sem fadiga excessiva." },
    { semana: "3", carga: "14-16", criterio: "Mantendo a técnica e sem sinais de desconforto ou exaustão." },
    {
      semana: "4",
      carga: "16-18",
      criterio: "Continuidade da boa tolerância e esforço consistente. Preparação para reavaliação.",
    },
    {
      semana: "5",
      carga: "Ajuste pós-reavaliação",
      criterio: "Reavaliação do SIndex em 30 dias para determinar nova carga ideal e próximos objetivos.",
    },
  ],
};

/* ═══════════════════════════════════════════════════════════════════════════
   STEPPER
═══════════════════════════════════════════════════════════════════════════ */
function Stepper({ current }) {
  return (
    <div style={{ display: "flex" as const, alignItems: "center", justifyContent: "center", marginBottom: 36 }}>
      {STEPS.map((s, i) => (
        <div key={s.id} style={{ display: "flex" as const, alignItems: "center" }}>
          <div style={{ display: "flex" as const, flexDirection: "column" as const, alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background:
                  current >= s.id
                    ? `linear-gradient(135deg, ${G.gold}, ${G.goldLight})`
                    : current === s.id - 1
                      ? G.goldPale
                      : "#F0EDE0",
                border: `2px solid ${current >= s.id ? G.gold : G.border}`,
                display: "flex" as const,
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                boxShadow: current === s.id ? `0 0 0 4px ${G.gold}22` : "none",
                transition: "all 0.35s",
              }}
            >
              {current > s.id ? "✓" : s.icon}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: current === s.id ? 800 : 500,
                color: current >= s.id ? G.gold : G.muted,
                letterSpacing: "0.5px" as const,
              }}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              style={{
                width: 64,
                height: 2,
                margin: "0 4px",
                marginBottom: 22,
                background: current > s.id ? `linear-gradient(90deg, ${G.gold}, ${G.goldLight})` : G.borderLight,
                transition: "background 0.4s",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 1 — UPLOAD
═══════════════════════════════════════════════════════════════════════════ */
function StepUpload({ onFileReady }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((f) => {
    if (!f || f.type !== "application/pdf") return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") setFileData(result.split(",")[1]);
    };
    reader.readAsDataURL(f);
  }, []);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: G.dark, margin: "0 0 8px" }}>
          Upload do Relatório BreatheLink
        </h2>
        <p style={{ color: G.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
          Carregue o PDF exportado pelo software POWERbreathe / BreatheLink IMT Suite. A IA irá extrair e interpretar
          todos os dados clínicos automaticamente.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          processFile(e.dataTransfer.files[0]);
        }}
        onClick={() => {
          if (inputRef.current) inputRef.current.click();
        }}
        style={{
          border: `2px dashed ${dragging ? G.gold : file ? G.goldLight : G.border}`,
          borderRadius: 16,
          padding: "44px 32px",
          textAlign: "center" as const,
          background: dragging ? G.goldPale : file ? "#FEFCF5" : G.goldBg,
          cursor: "pointer" as const,
          transition: "all 0.2s" as const,
          boxShadow: dragging ? `0 0 24px ${G.gold}33` : "none",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: "none" as const }}
          onChange={(e) => processFile(e.target.files[0])}
        />
        {file ? (
          <div>
            <div style={{ fontSize: 44, marginBottom: 10 }}>📄</div>
            <p style={{ fontWeight: 700, color: G.dark, fontSize: 15, margin: "0 0 4px" }}>{file.name}</p>
            <p style={{ fontSize: 12, color: G.muted, margin: 0 }}>
              {(file.size / 1024).toFixed(1)} KB · Clique para substituir
            </p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 52, marginBottom: 14 }}>📤</div>
            <p style={{ fontWeight: 700, color: G.dark, margin: "0 0 6px", fontSize: 16 }}>Arraste o PDF aqui</p>
            <p style={{ fontSize: 13, color: G.muted, margin: "0 0 10px" }}>ou clique para seleccionar</p>
            <span
              style={{
                display: "inline-block" as const,
                padding: "4px 12px",
                borderRadius: 99,
                background: G.goldPale,
                fontSize: 11,
                color: G.gold,
                fontWeight: 700,
              }}
            >
              Suporta: BreatheLink IMT Suite PDF
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div
        style={{
          marginTop: 18,
          padding: "14px 18px",
          background: "#EFF6FF",
          borderRadius: 12,
          border: "1px solid #BFDBFE",
          display: "flex" as const,
          gap: 12,
        }}
      >
        <span style={{ fontSize: 16 }}>ℹ️</span>
        <div style={{ fontSize: 13, color: "#1E40AF", lineHeight: 1.7 }}>
          <strong>A IA extrai automaticamente:</strong> Nome · Idade · Peso · Altura · SIndex (máx e média) · PIF ·
          Volume Inspiratório · PNV · Data da sessão · Calcula % do PNV e classifica grau de fraqueza
        </div>
      </div>

      <button
        onClick={() => file && fileData && onFileReady(file, fileData)}
        disabled={!file}
        style={btn("primary", {
          width: "100%",
          marginTop: 24,
          padding: "14px 0",
          fontSize: 15,
          opacity: file ? 1 : 0.45,
          cursor: (file ? "pointer" : "not-allowed") as CSSProperties["cursor"],
        })}
      >
        Analisar com IA →
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 2 — ANÁLISE IA
═══════════════════════════════════════════════════════════════════════════ */
function StepIA({ file, fileData, onDone }) {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [items, setItems] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  const EXTRACTION_STEPS = [
    "A ler o PDF...",
    "A identificar dados do paciente...",
    "A extrair SIndex e parâmetros...",
    "A calcular percentagem do PNV...",
    "A classificar grau de fraqueza muscular...",
    "A gerar diagnóstico clínico...",
    "A definir plano terapêutico...",
    "A calcular cargas semanais...",
    "A redigir texto de mobilidade...",
    "Relatório pronto!",
  ];

  const [currentStep, setCurrentStep] = useState(0);

  const runIA = useCallback(async () => {
    setStatus("loading");
    setCurrentStep(0);

    // Animate steps visually
    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      stepIdx++;
      setCurrentStep(stepIdx);
      if (stepIdx >= EXTRACTION_STEPS.length - 1) clearInterval(stepInterval);
    }, 600);

    const systemPrompt = `És um fisioterapeuta respiratório especialista a analisar relatórios do BreatheLink IMT Suite (POWERbreathe).
Analisa o PDF e devolve EXCLUSIVAMENTE um JSON válido sem markdown, sem texto extra, sem \`\`\`json.
Campos obrigatórios (usa string vazia "" se não encontrado):
{
  "nome": "nome completo do paciente",
  "data": "data da sessão no formato dd/MM/yyyy",
  "idade": "idade em anos",
  "peso": "peso em kg",
  "altura": "altura em cm",
  "bmi": "IMC calculado ou extraído",
  "pnv": "PNV em cmH2O",
  "sindex_best": "SIndex máximo em cmH2O",
  "sindex_avg": "SIndex médio em cmH2O",
  "percentagem_pnv": "percentagem do SIndex best em relação ao PNV, ex: 58.7",
  "pif": "PIF em L/s",
  "volume": "Volume em litros",
  "grau_fraqueza": "Leve | Moderado | Severo baseado na percentagem do PNV (>70% normal, 50-70% leve, 30-50% moderado, <30% severo)",
  "diagnostico": "texto clínico completo do diagnóstico funcional respiratório, 3-4 frases profissionais",
  "observacao_clinica": "observação adicional sobre o esforço e comportamento durante o teste",
  "equipamento": "nome do equipamento usado",
  "frequencia": "frequência recomendada de sessões",
  "repeticoes": "número de repetições por sessão",
  "carga_inicial": "carga inicial recomendada baseada no SIndex (35-40% do SIndex best)",
  "tecnica": "descrição técnica do exercício",
  "meta_curto": "meta a 4 semanas baseada no SIndex atual e PNV",
  "meta_medio": "meta a médio prazo",
  "mobilidade": "descrição dos exercícios de mobilidade torácica e expansão costal recomendados",
  "fisioterapeuta": "nome da fisioterapeuta se presente",
  "cedula": "número de cédula profissional se presente",
  "progressao": [
    {"semana":"1","carga":"X-Y","criterio":"texto"},
    {"semana":"2","carga":"X-Y","criterio":"texto"},
    {"semana":"3","carga":"X-Y","criterio":"texto"},
    {"semana":"4","carga":"X-Y","criterio":"texto"},
    {"semana":"5","carga":"Ajuste pós-reavaliação","criterio":"texto sobre reavaliação"}
  ]
}
Calcula as cargas progressivas baseado na carga inicial: aumenta 2 cmH2O por semana.
Mantém linguagem clínica profissional em português europeu.`;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-respiratory-report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ pdfBase64: fileData }),
        }
      );

      clearInterval(stepInterval);
      setCurrentStep(EXTRACTION_STEPS.length - 1);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `API error: ${response.status}`);
      }
      const result = await response.json();
      const parsed = result.data;

      // Build display items
      setItems([
        { label: "Nome", value: parsed.nome, ok: !!parsed.nome },
        { label: "SIndex Máximo", value: `${parsed.sindex_best} cmH2O`, ok: !!parsed.sindex_best },
        { label: "% do PNV", value: `${parsed.percentagem_pnv}%`, ok: !!parsed.percentagem_pnv },
        { label: "Grau de Fraqueza", value: parsed.grau_fraqueza, ok: !!parsed.grau_fraqueza },
        { label: "Carga Inicial", value: parsed.carga_inicial, ok: !!parsed.carga_inicial },
        { label: "Diagnóstico", value: parsed.diagnostico?.slice(0, 60) + "...", ok: !!parsed.diagnostico },
        { label: "Plano Terapêutico", value: "Gerado ✓", ok: true },
      ]);

      setStatus("done");
      setTimeout(() => onDone(parsed), 800);
    } catch (err) {
      clearInterval(stepInterval);
      setErrorMsg(err.message);
      setStatus("error");
    }
  }, [fileData, onDone]);

  // Auto-run on mount
  useState(() => {
    runIA();
  });

  const progress = Math.round((currentStep / (EXTRACTION_STEPS.length - 1)) * 100);

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: G.dark, margin: "0 0 8px" }}>
        Análise com Inteligência Artificial
      </h2>
      <p style={{ color: G.muted, fontSize: 14, margin: "0 0 24px" }}>
        A IA está a processar <strong>{file?.name}</strong> e a gerar o conteúdo clínico.
      </p>

      {/* Progress */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex" as const, justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: G.muted }}>
            {EXTRACTION_STEPS[Math.min(currentStep, EXTRACTION_STEPS.length - 1)]}
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: G.gold }}>{progress}%</span>
        </div>
        <div style={{ height: 8, background: G.goldPale, borderRadius: 99, overflow: "hidden" as const }}>
          <div
            style={{
              height: "100%",
              borderRadius: 99,
              transition: "width 0.5s ease",
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${G.gold}, ${G.goldLight})`,
            }}
          />
        </div>
      </div>

      {/* Extracted items */}
      {items.length > 0 && (
        <div style={{ display: "flex" as const, flexDirection: "column" as const, gap: 8, marginBottom: 20 }}>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex" as const,
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: item.ok ? G.goldBg : "#fafafa",
                borderRadius: 10,
                border: `1px solid ${item.ok ? G.border : "#eee"}`,
              }}
            >
              <span style={{ fontSize: 15, minWidth: 20 }}>{item.ok ? "✅" : "⏳"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: G.muted, marginBottom: 1 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: G.dark }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <div
          style={{
            padding: 16,
            background: "#FEF2F2",
            borderRadius: 12,
            border: "1px solid #FCA5A5",
            color: G.error,
            fontSize: 13,
          }}
        >
          <strong>Erro ao processar:</strong> {errorMsg}
          <br />
          <button onClick={runIA} style={btn("ghost", { marginTop: 10, fontSize: 12 })}>
            Tentar novamente
          </button>
        </div>
      )}

      {status === "loading" && items.length === 0 && (
        <div style={{ textAlign: "center" as const, padding: "32px 0", color: G.muted, fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 2s linear infinite" }}>⚙️</div>A processar o
          PDF...
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 3 — EDITOR
═══════════════════════════════════════════════════════════════════════════ */
function StepEditor({ data, setData, secoes, setSocoes, onNext }) {
  const [tab, setTab] = useState("paciente");

  const tabs = [
    { id: "paciente", label: "👤 Paciente" },
    { id: "parametros", label: "📊 Parâmetros" },
    { id: "diagnostico", label: "🩺 Diagnóstico" },
    { id: "intervencao", label: "🎯 Intervenção" },
    { id: "progressao", label: "📈 Progressão" },
    { id: "secoes", label: "⚙️ Secções" },
  ];

  const Field = ({ label: lbl, fieldKey, type = "text", rows = 3 }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={label()}>{lbl}</label>
      {type === "textarea" ? (
        <textarea
          value={data[fieldKey] || ""}
          rows={rows}
          onChange={(e) => setData({ ...data, [fieldKey]: e.target.value })}
          style={{ ...input(), resize: "vertical" as const }}
        />
      ) : (
        <input
          type={type}
          value={data[fieldKey] || ""}
          onChange={(e) => setData({ ...data, [fieldKey]: e.target.value })}
          style={input()}
        />
      )}
    </div>
  );

  const updateProgressao = (i, field, value) => {
    const p = [...data.progressao];
    p[i] = { ...p[i], [field]: value };
    setData({ ...data, progressao: p });
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: G.dark, margin: "0 0 6px" }}>Editar Relatório</h2>
        <p style={{ color: G.muted, fontSize: 14, margin: 0 }}>
          Reveja e ajuste os dados extraídos pela IA antes de gerar o documento final.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex" as const, gap: 6, marginBottom: 20, flexWrap: "wrap" as const }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={btn(tab === t.id ? "primary" : "outline", { padding: "7px 14px", fontSize: 12, borderRadius: 99 })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ ...card(), padding: 24 }}>
        {tab === "paciente" && (
          <div style={{ display: "grid" as const, gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div style={{ gridColumn: "1/-1" }}>
              <Field label="Nome do Utente" fieldKey="nome" />
            </div>
            <Field label="Data da Avaliação" fieldKey="data" />
            <Field label="Idade (anos)" fieldKey="idade" />
            <Field label="Peso (kg)" fieldKey="peso" />
            <Field label="Altura (cm)" fieldKey="altura" />
            <Field label="IMC" fieldKey="bmi" />
            <Field label="Fisioterapeuta" fieldKey="fisioterapeuta" />
            <Field label="Cédula Profissional" fieldKey="cedula" />
          </div>
        )}

        {tab === "parametros" && (
          <div style={{ display: "grid" as const, gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Field label="SIndex Máximo (cmH2O)" fieldKey="sindex_best" />
            <Field label="SIndex Média (cmH2O)" fieldKey="sindex_avg" />
            <Field label="PNV (cmH2O)" fieldKey="pnv" />
            <Field label="% do PNV" fieldKey="percentagem_pnv" />
            <Field label="PIF (L/s)" fieldKey="pif" />
            <Field label="Volume Inspiratório (L)" fieldKey="volume" />
            <div style={{ gridColumn: "1/-1" }}>
              <Field label="Grau de Fraqueza" fieldKey="grau_fraqueza" />
            </div>
          </div>
        )}

        {tab === "diagnostico" && (
          <div>
            <Field label="Diagnóstico Funcional Respiratório" fieldKey="diagnostico" type="textarea" rows={5} />
            <Field label="Observação Clínica Adicional" fieldKey="observacao_clinica" type="textarea" rows={3} />
          </div>
        )}

        {tab === "intervencao" && (
          <div>
            <Field label="Equipamento" fieldKey="equipamento" />
            <div style={{ display: "grid" as const, gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <Field label="Frequência" fieldKey="frequencia" />
              <Field label="Repetições" fieldKey="repeticoes" />
              <Field label="Carga Inicial" fieldKey="carga_inicial" />
            </div>
            <Field label="Técnica de Execução" fieldKey="tecnica" type="textarea" rows={3} />
            <Field label="Meta Curto Prazo (4 semanas)" fieldKey="meta_curto" type="textarea" rows={2} />
            <Field label="Meta Médio Prazo" fieldKey="meta_medio" type="textarea" rows={2} />
            <Field label="Exercícios de Mobilidade" fieldKey="mobilidade" type="textarea" rows={3} />
          </div>
        )}

        {tab === "progressao" && (
          <div>
            <p style={{ fontSize: 13, color: G.muted, marginBottom: 16 }}>
              Edite a tabela de progressão semanal. Pode adicionar ou remover semanas.
            </p>
            {data.progressao.map((row, i) => (
              <div
                key={i}
                style={{
                  padding: "14px",
                  background: G.goldBg,
                  borderRadius: 10,
                  border: `1px solid ${G.borderLight}`,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "grid" as const,
                    gridTemplateColumns: "80px 120px 1fr 32px",
                    gap: 10,
                    alignItems: "start",
                  }}
                >
                  <div>
                    <label style={label()}>Semana</label>
                    <input
                      value={row.semana}
                      onChange={(e) => updateProgressao(i, "semana", e.target.value)}
                      style={input({ padding: "7px 10px" })}
                    />
                  </div>
                  <div>
                    <label style={label()}>Carga (cmH2O)</label>
                    <input
                      value={row.carga}
                      onChange={(e) => updateProgressao(i, "carga", e.target.value)}
                      style={input({ padding: "7px 10px" })}
                    />
                  </div>
                  <div>
                    <label style={label()}>Critério</label>
                    <input
                      value={row.criterio}
                      onChange={(e) => updateProgressao(i, "criterio", e.target.value)}
                      style={input({ padding: "7px 10px" })}
                    />
                  </div>
                  <div style={{ paddingTop: 20 }}>
                    <button
                      onClick={() => {
                        const p = data.progressao.filter((_, idx) => idx !== i);
                        setData({ ...data, progressao: p });
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer" as const,
                        fontSize: 16,
                        color: G.error,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={() =>
                setData({
                  ...data,
                  progressao: [
                    ...data.progressao,
                    { semana: String(data.progressao.length + 1), carga: "", criterio: "" },
                  ],
                })
              }
              style={btn("outline", { fontSize: 13, marginTop: 8 })}
            >
              + Adicionar semana
            </button>
          </div>
        )}

        {tab === "secoes" && (
          <div>
            <p style={{ fontSize: 13, color: G.muted, marginBottom: 18 }}>
              Seleccione as secções a incluir no relatório final:
            </p>
            {SECOES_CONFIG.map((s) => (
              <div
                key={s.id}
                onClick={() => setSocoes({ ...secoes, [s.id]: !secoes[s.id] })}
                style={{
                  display: "flex" as const,
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  background: secoes[s.id] ? G.goldBg : "#F9F9F9",
                  borderRadius: 12,
                  border: `1px solid ${secoes[s.id] ? G.border : "#EEE"}`,
                  marginBottom: 8,
                  cursor: "pointer" as const,
                  transition: "all 0.2s" as const,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: `2px solid ${secoes[s.id] ? G.gold : "#CCC"}`,
                    background: secoes[s.id] ? G.gold : G.white,
                    display: "flex" as const,
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s" as const,
                    flexShrink: 0,
                  }}
                >
                  {secoes[s.id] && <span style={{ color: G.white, fontSize: 13, fontWeight: 900 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: secoes[s.id] ? G.dark : G.muted }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: G.muted }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onNext}
        style={btn("primary", { width: "100%", marginTop: 24, padding: "14px 0", fontSize: 15 })}
      >
        Gerar Relatório Final →
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 4 — RELATÓRIO FINAL (PREVIEW + PRINT)
═══════════════════════════════════════════════════════════════════════════ */
function StepRelatorio({ data, secoes, onEdit }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Relatório Fisioterapia — ${data.nome}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'EB Garamond', Georgia, serif; font-size: 13px; color: #2D2D2D; background: white; }
  @page { margin: 20mm 18mm; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #E2D5A8; padding: 8px 12px; text-align: left; }
  th { background: #F9F5E8; font-weight: 700; }
  h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 15px; margin-bottom: 10px; color: #1C1C2E; }
  p { line-height: 1.8; margin-bottom: 10px; }
</style>
</head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 400);
  };

  const TabelaRow = ({ label: lbl, value }) => (
    <tr>
      <td
        style={{
          fontWeight: 700,
          background: "#F9F5E8",
          width: "32%",
          padding: "9px 12px",
          borderBottom: `1px solid ${G.border}`,
          border: `1px solid ${G.border}`,
          fontSize: 13,
        }}
      >
        {lbl}
      </td>
      <td
        style={{
          padding: "9px 12px",
          borderBottom: `1px solid ${G.border}`,
          border: `1px solid ${G.border}`,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {value}
      </td>
    </tr>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Action bar */}
      <div
        style={{ display: "flex" as const, justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}
      >
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: G.dark, margin: "0 0 4px" }}>Relatório Gerado</h2>
          <p style={{ color: G.muted, fontSize: 13, margin: 0 }}>Preview fiel ao layout final</p>
        </div>
        <div style={{ display: "flex" as const, gap: 10 }}>
          <button onClick={onEdit} style={btn("outline", { fontSize: 13 })}>
            ✏️ Editar
          </button>
          <button onClick={handlePrint} style={btn("primary", { fontSize: 13 })}>
            🖨️ Exportar / Imprimir
          </button>
        </div>
      </div>

      {/* Document */}
      <div
        ref={printRef}
        style={{
          background: G.white,
          fontFamily: "Georgia, 'Times New Roman', serif",
          border: `3px solid ${G.gold}`,
          borderRadius: 12,
          overflow: "hidden" as const,
          boxShadow: "0 12px 48px rgba(0,0,0,0.15)",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            background: `linear-gradient(135deg, ${G.dark} 0%, ${G.darkMid} 100%)`,
            padding: "28px 40px",
            textAlign: "center" as const,
            borderBottom: `4px solid ${G.gold}`,
          }}
        >
          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 34,
              fontWeight: 700,
              color: G.goldLight,
              margin: 0,
              letterSpacing: 3,
            }}
          >
            Respira & Desenvolve
          </h1>
        </div>

        <div style={{ padding: "30px 40px" }}>
          {/* Meta */}
          <div
            style={{
              display: "flex" as const,
              justifyContent: "space-between",
              marginBottom: 20,
              borderBottom: `1px solid ${G.borderLight}`,
              paddingBottom: 14,
            }}
          >
            <div style={{ fontSize: 14 }}>
              <span style={{ color: G.muted, fontSize: 12 }}>Nome do Utente: </span>
              <strong>{data.nome || "—"}</strong>
            </div>
            <div style={{ fontSize: 14 }}>
              <span style={{ color: G.muted, fontSize: 12 }}>Data da Avaliação: </span>
              <strong>{data.data || "—"}</strong>
            </div>
          </div>

          <h2
            style={{
              textAlign: "center" as const,
              fontSize: 17,
              fontWeight: 700,
              color: G.dark,
              marginBottom: 28,
              letterSpacing: 1,
            }}
          >
            Relatório Fisioterapia Respiratória
          </h2>

          {/* ── 1. Parâmetros ── */}
          {secoes.parametros && (
            <div style={{ marginBottom: 28 }}>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 14,
                  color: G.dark,
                  borderLeft: `4px solid ${G.gold}`,
                  paddingLeft: 12,
                }}
              >
                1. Análise dos Pilares da Função Respiratória
              </h3>
              <p style={{ fontSize: 13, color: G.ink, lineHeight: 1.8, marginBottom: 14 }}>
                A avaliação realizada a <strong>{data.data}</strong> revelou os seguintes parâmetros técnicos:
              </p>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <tbody>
                  <TabelaRow
                    label="SIndex Máximo"
                    value={`${data.sindex_best} cmH2O${data.percentagem_pnv ? ` (${data.percentagem_pnv}% do PNV previsto de ${data.pnv} cmH2O)` : ""}`}
                  />
                  <TabelaRow label="SIndex Médio" value={`${data.sindex_avg} cmH2O`} />
                  <TabelaRow label="PIF (Pico de Fluxo Inspiratório)" value={`${data.pif} L/s`} />
                  <TabelaRow label="Volume Inspiratório" value={`${data.volume} L`} />
                  <TabelaRow label="PNV (Valor Normal Previsto)" value={`${data.pnv} cmH2O`} />
                  {data.grau_fraqueza && <TabelaRow label="Grau de Fraqueza Muscular" value={data.grau_fraqueza} />}
                </tbody>
              </table>
            </div>
          )}

          {/* ── 2. Diagnóstico ── */}
          {secoes.diagnostico && (
            <div style={{ marginBottom: 28 }}>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 12,
                  color: G.dark,
                  borderLeft: `4px solid ${G.gold}`,
                  paddingLeft: 12,
                }}
              >
                2. Diagnóstico Funcional Respiratório (DFR)
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.9, textAlign: "justify" as const, color: G.ink }}>
                {data.diagnostico}
              </p>
              {data.observacao_clinica && (
                <p style={{ fontSize: 13, lineHeight: 1.9, textAlign: "justify" as const, color: G.ink, marginTop: 8 }}>
                  {data.observacao_clinica}
                </p>
              )}
            </div>
          )}

          {/* ── 3. Intervenção ── */}
          {secoes.intervencao && (
            <div style={{ marginBottom: 28 }}>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 12,
                  color: G.dark,
                  borderLeft: `4px solid ${G.gold}`,
                  paddingLeft: 12,
                }}
              >
                3. Proposta de Intervenção
              </h3>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <tbody>
                  {data.equipamento && <TabelaRow label="Equipamento" value={data.equipamento} />}
                  {data.frequencia && <TabelaRow label="Frequência" value={data.frequencia} />}
                  {data.repeticoes && <TabelaRow label="Repetições" value={data.repeticoes} />}
                  {data.carga_inicial && <TabelaRow label="Intensidade Inicial" value={data.carga_inicial} />}
                  {data.tecnica && <TabelaRow label="Técnica" value={data.tecnica} />}
                </tbody>
              </table>
            </div>
          )}

          {/* ── 4. Metas ── */}
          {secoes.metas && (data.meta_curto || data.meta_medio) && (
            <div style={{ marginBottom: 28 }}>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 12,
                  color: G.dark,
                  borderLeft: `4px solid ${G.gold}`,
                  paddingLeft: 12,
                }}
              >
                4. Metas Clínicas
              </h3>
              {data.meta_curto && (
                <p style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 8 }}>
                  <strong>• Curto Prazo (4 semanas):</strong> {data.meta_curto}
                </p>
              )}
              {data.meta_medio && (
                <p style={{ fontSize: 13, lineHeight: 1.8 }}>
                  <strong>• Médio Prazo:</strong> {data.meta_medio}
                </p>
              )}
            </div>
          )}

          {/* ── 5. Progressão ── */}
          {secoes.progressao && data.progressao?.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 12,
                  color: G.dark,
                  borderLeft: `4px solid ${G.gold}`,
                  paddingLeft: 12,
                }}
              >
                5. Tabela de Progressão Semanal
              </h3>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr style={{ background: "#F9F5E8" }}>
                    <th
                      style={{
                        padding: "10px 14px",
                        border: `1px solid ${G.border}`,
                        textAlign: "center" as const,
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      Semana
                    </th>
                    <th
                      style={{
                        padding: "10px 14px",
                        border: `1px solid ${G.border}`,
                        textAlign: "center" as const,
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      Carga (cmH2O)
                    </th>
                    <th
                      style={{ padding: "10px 14px", border: `1px solid ${G.border}`, fontWeight: 700, fontSize: 13 }}
                    >
                      Critério de Aumento
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.progressao.map((row, i) => (
                    <tr key={i}>
                      <td
                        style={{
                          padding: "9px 14px",
                          border: `1px solid ${G.border}`,
                          textAlign: "center" as const,
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {row.semana}
                      </td>
                      <td
                        style={{
                          padding: "9px 14px",
                          border: `1px solid ${G.border}`,
                          textAlign: "center" as const,
                          fontSize: 13,
                        }}
                      >
                        {row.carga}
                      </td>
                      <td
                        style={{ padding: "9px 14px", border: `1px solid ${G.border}`, fontSize: 13, lineHeight: 1.6 }}
                      >
                        {row.criterio}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── 6. Mobilidade ── */}
          {secoes.mobilidade && data.mobilidade && (
            <div style={{ marginBottom: 28 }}>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 12,
                  color: G.dark,
                  borderLeft: `4px solid ${G.gold}`,
                  paddingLeft: 12,
                }}
              >
                6. Exercícios de Mobilidade e Higiene
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.9, color: G.ink }}>{data.mobilidade}</p>
            </div>
          )}

          {/* ── Assinatura ── */}
          <div
            style={{
              borderTop: `2px solid ${G.borderLight}`,
              paddingTop: 24,
              textAlign: "center" as const,
              marginTop: 16,
            }}
          >
            <p style={{ fontSize: 12, color: G.muted, marginBottom: 6 }}>A Fisioterapeuta,</p>
            <p style={{ fontFamily: "cursive", fontSize: 22, color: G.dark, margin: "10px 0 6px" }}>
              {data.fisioterapeuta}
            </p>
            <p style={{ fontSize: 13, color: G.ink, fontWeight: 600 }}>{data.fisioterapeuta}</p>
            <p style={{ fontSize: 12, color: G.muted }}>(Cédula Profissional {data.cedula})</p>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            background: G.dark,
            padding: "12px 40px",
            textAlign: "center" as const,
            borderTop: `2px solid ${G.gold}`,
          }}
        >
          <span style={{ fontSize: 11, color: G.gold, letterSpacing: 2, fontWeight: 700 }}>
            RESPIRA & DESENVOLVE · FISIOTERAPIA RESPIRATÓRIA
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════════════════════════════════════ */
export default function RelatorioRespiratório() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [data, setData] = useState({ ...EMPTY_DATA });
  const [secoes, setSocoes] = useState(Object.fromEntries(SECOES_CONFIG.map((s) => [s.id, true])));

  const handleFileReady = (f, fd) => {
    setFile(f);
    setFileData(fd);
    setStep(2);
  };

  const handleIADone = (parsed) => {
    setData({ ...EMPTY_DATA, ...parsed, progressao: parsed.progressao || EMPTY_DATA.progressao });
    setStep(3);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(ellipse at 20% 20%, #FFF8E8 0%, #F5EDD0 40%, #EDE0B8 100%)`,
        fontFamily: "'Georgia', 'Times New Roman', serif",
        padding: "40px 20px 60px",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center" as const, marginBottom: 44 }}>
        <div
          style={{
            display: "inline-flex" as const,
            alignItems: "center",
            gap: 10,
            background: `linear-gradient(135deg, ${G.dark}, ${G.darkMid})`,
            borderRadius: 14,
            padding: "10px 24px",
            marginBottom: 16,
            border: `1px solid ${G.gold}`,
          }}
        >
          <span style={{ fontSize: 18 }}>🫁</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: G.goldLight,
              letterSpacing: 3,
              textTransform: "uppercase" as const,
            }}
          >
            Módulo de Relatórios · Fisioterapia Respiratória
          </span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: G.dark, margin: "0 0 8px", fontFamily: "Georgia, serif" }}>
          Gerador de Relatório com IA
        </h1>
        <p style={{ color: G.muted, fontSize: 14, margin: 0 }}>
          Upload BreatheLink PDF → Extracção automática → Edição → Exportação
        </p>
      </div>

      <Stepper current={step} />

      {/* Card principal */}
      <div
        style={{
          ...card({ maxWidth: 760, margin: "0 auto", padding: "36px 40px" }),
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
        }}
      >
        {step === 1 && <StepUpload onFileReady={handleFileReady} />}
        {step === 2 && <StepIA file={file} fileData={fileData} onDone={handleIADone} />}
        {step === 3 && (
          <StepEditor data={data} setData={setData} secoes={secoes} setSocoes={setSocoes} onNext={() => setStep(4)} />
        )}
        {step === 4 && <StepRelatorio data={data} secoes={secoes} onEdit={() => setStep(3)} />}
      </div>

      <p style={{ textAlign: "center" as const, marginTop: 20, fontSize: 12, color: "#B8A878" }}>
        Passo {step} de {STEPS.length} · {STEPS[step - 1]?.label}
      </p>
    </div>
  );
}
