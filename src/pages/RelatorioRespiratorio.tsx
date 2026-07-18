import React, { useState, useCallback, useRef, useEffect, useMemo, CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAuthContext } from "@/lib/auth-helpers";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";

/* Converte string com virgula/ponto e unidades coladas em numero. Devolve null se nao houver digitos. */
function parseNumeric(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const m = s.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return isFinite(n) ? n : null;
}

const COMPARE_PARAMS: { key: string; label: string }[] = [
  { key: "pnv", label: "PNV" },
  { key: "sindex_best", label: "S-Index (melhor)" },
  { key: "sindex_avg", label: "S-Index (médio)" },
  { key: "percentagem_pnv", label: "% do PNV" },
  { key: "pif", label: "PIF" },
  { key: "volume", label: "Volume" },
  { key: "respiracoes", label: "Respirações" },
  { key: "carga_alvo", label: "Carga alvo" },
  { key: "peso", label: "Peso" },
  { key: "sindex_session_avg", label: "S-Index (média sessão)" },
  { key: "pif_session_avg", label: "PIF (média sessão)" },
  { key: "volume_session_avg", label: "Volume (média sessão)" },
];

/* Converte dd/mm/aaaa para aaaa-mm-dd; passa-through se ja ISO; senao devolve hoje. */
function toIsoDate(valor?: string): string {
  const v = (valor ?? "").trim();
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return new Date().toISOString().slice(0, 10);
}

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
  respiracoes: "",
  carga_alvo: "",
  tipo_sessao: "",
  sindex_session_avg: "",
  pif_session_avg: "",
  volume_session_avg: "",
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

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/relatorio-respiratorio-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ pdfBase64: fileData }),
        },
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

/* ─── Memoized Field component (outside StepEditor to preserve identity) ── */
const EditorField = React.memo(function EditorField({
  label: lbl,
  fieldKey,
  data,
  setData,
  type = "text",
  rows = 3,
}: {
  label: string;
  fieldKey: string;
  data: any;
  setData: React.Dispatch<React.SetStateAction<any>>;
  type?: string;
  rows?: number;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const val = e.target.value;
      setData((prev: any) => ({ ...prev, [fieldKey]: val }));
    },
    [fieldKey, setData]
  );

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={label()}>{lbl}</label>
      {type === "textarea" ? (
        <textarea
          value={data[fieldKey] || ""}
          rows={rows}
          onChange={handleChange}
          style={{ ...input(), resize: "vertical" as const }}
        />
      ) : (
        <input
          type={type}
          value={data[fieldKey] || ""}
          onChange={handleChange}
          style={input()}
        />
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 3 — EDITOR
═══════════════════════════════════════════════════════════════════════════ */
function StepEditor({ data, setData, secoes, setSocoes, onNext, extraActions = null }) {
  const [tab, setTab] = useState("paciente");

  const tabs = [
    { id: "paciente", label: "👤 Paciente" },
    { id: "parametros", label: "📊 Parâmetros" },
    { id: "diagnostico", label: "🩺 Diagnóstico" },
    { id: "intervencao", label: "🎯 Intervenção" },
    { id: "progressao", label: "📈 Progressão" },
    { id: "secoes", label: "⚙️ Secções" },
  ];

  // Field wrapper removed — use EditorField directly to preserve input focus

  const updateProgressao = useCallback((i, field, value) => {
    setData((prev: any) => {
      const p = [...prev.progressao];
      p[i] = { ...p[i], [field]: value };
      return { ...prev, progressao: p };
    });
  }, [setData]);

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
              <EditorField label="Nome do Utente" fieldKey="nome" data={data} setData={setData} />
            </div>
            <EditorField label="Data da Avaliação" fieldKey="data" data={data} setData={setData} />
            <EditorField label="Idade (anos)" fieldKey="idade" data={data} setData={setData} />
            <EditorField label="Peso (kg)" fieldKey="peso" data={data} setData={setData} />
            <EditorField label="Altura (cm)" fieldKey="altura" data={data} setData={setData} />
            <EditorField label="IMC" fieldKey="bmi" data={data} setData={setData} />
            <EditorField label="Fisioterapeuta" fieldKey="fisioterapeuta" data={data} setData={setData} />
            <EditorField label="Cédula Profissional" fieldKey="cedula" data={data} setData={setData} />
          </div>
        )}

        {tab === "parametros" && (
          <div style={{ display: "grid" as const, gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <EditorField label="SIndex Máximo (cmH2O)" fieldKey="sindex_best" data={data} setData={setData} />
            <EditorField label="SIndex Média (cmH2O)" fieldKey="sindex_avg" data={data} setData={setData} />
            <EditorField label="PNV (cmH2O)" fieldKey="pnv" data={data} setData={setData} />
            <EditorField label="% do PNV" fieldKey="percentagem_pnv" data={data} setData={setData} />
            <EditorField label="PIF (L/s)" fieldKey="pif" data={data} setData={setData} />
            <EditorField label="Volume Inspiratório (L)" fieldKey="volume" data={data} setData={setData} />
            <div style={{ gridColumn: "1/-1", borderTop: `1px solid ${G.borderLight}`, margin: "10px 0 14px", paddingTop: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: G.gold, textTransform: "uppercase" as const, letterSpacing: "0.8px" }}>
                Dados da Sessão (Session Detail)
              </span>
            </div>
            <EditorField label="Tipo de Sessão" fieldKey="tipo_sessao" data={data} setData={setData} />
            <EditorField label="Respirações (Realizadas/Propostas)" fieldKey="respiracoes" data={data} setData={setData} />
            <EditorField label="Carga Alvo (cmH2O)" fieldKey="carga_alvo" data={data} setData={setData} />
            <EditorField label="SIndex Média de Sessão" fieldKey="sindex_session_avg" data={data} setData={setData} />
            <EditorField label="PIF Média de Sessão (L/s)" fieldKey="pif_session_avg" data={data} setData={setData} />
            <EditorField label="Volume Médio de Sessão (L)" fieldKey="volume_session_avg" data={data} setData={setData} />
            <div style={{ gridColumn: "1/-1" }}>
              <EditorField label="Grau de Fraqueza" fieldKey="grau_fraqueza" data={data} setData={setData} />
            </div>
          </div>
        )}

        {tab === "diagnostico" && (
          <div>
            <EditorField label="Diagnóstico Funcional Respiratório" fieldKey="diagnostico" data={data} setData={setData} type="textarea" rows={5} />
            <EditorField label="Observação Clínica Adicional" fieldKey="observacao_clinica" data={data} setData={setData} type="textarea" rows={3} />
          </div>
        )}

        {tab === "intervencao" && (
          <div>
            <EditorField label="Equipamento" fieldKey="equipamento" data={data} setData={setData} />
            <div style={{ display: "grid" as const, gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <EditorField label="Frequência" fieldKey="frequencia" data={data} setData={setData} />
              <EditorField label="Repetições" fieldKey="repeticoes" data={data} setData={setData} />
              <EditorField label="Carga Inicial" fieldKey="carga_inicial" data={data} setData={setData} />
            </div>
            <EditorField label="Técnica de Execução" fieldKey="tecnica" data={data} setData={setData} type="textarea" rows={3} />
            <EditorField label="Meta Curto Prazo (4 semanas)" fieldKey="meta_curto" data={data} setData={setData} type="textarea" rows={2} />
            <EditorField label="Meta Médio Prazo" fieldKey="meta_medio" data={data} setData={setData} type="textarea" rows={2} />
            <EditorField label="Exercícios de Mobilidade" fieldKey="mobilidade" data={data} setData={setData} type="textarea" rows={3} />
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
                        setData((prev: any) => ({
                          ...prev,
                          progressao: prev.progressao.filter((_, idx) => idx !== i),
                        }));
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
                setData((prev: any) => ({
                  ...prev,
                  progressao: [
                    ...prev.progressao,
                    { semana: String(prev.progressao.length + 1), carga: "", criterio: "" },
                  ],
                }))
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

      <div style={{ display: "flex" as const, gap: 10, marginTop: 24 }}>
        {extraActions}
        <button onClick={onNext} style={btn("primary", { flex: 1, padding: "14px 0", fontSize: 15 })}>
          Gerar Relatório Final →
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 4 — RELATÓRIO FINAL (PREVIEW + PRINT)
═══════════════════════════════════════════════════════════════════════════ */
function StepRelatorio({ data, secoes, onEdit, onSave = null }) {
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
          {onSave && (
            <button onClick={onSave} style={btn("outline", { fontSize: 13, color: G.success, borderColor: G.success })}>
              💾 Guardar
            </button>
          )}
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
/* ─── Histórico ──────────────────────────────────────────────────────────── */

function HistoricoRelatorios({ onOpen, onNew, onPreview, patientName, pacienteId }: { onOpen: (r: any) => void; onNew: () => void; onPreview: (r: any) => void; patientName?: string; pacienteId?: string }) {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "compare">("list");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("respiratory_reports")
      .select("id, patient_name, report_date, data, created_at, patient_id")
      .order("created_at", { ascending: false });
    if (pacienteId) {
      query = query.eq("patient_id", pacienteId);
    }
    const { data, error } = await query;
    if (error) {
      console.error("Erro ao carregar relatórios:", error);
      toast.error("Erro ao carregar histórico de relatórios");
    }
    if (data) setReports(data);
    setLoading(false);
  }, [pacienteId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleDelete = async (id: string) => {
    if (!confirm("Apagar este relatório? Esta acção não pode ser desfeita.")) return;
    setDeleting(id);
    try {
      const { error } = await (supabase as any).from("respiratory_reports").delete().eq("id", id);
      if (error) throw error;
      setReports((r) => r.filter((x) => x.id !== id));
    } catch (err) {
      console.error("Erro ao apagar relatório:", err);
      toast.error("Erro ao apagar relatório");
    } finally {
      setDeleting(null);
    }
  };

  // Filtro por paciente actual: se pacienteId existir, a query ja filtrou por patient_id;
  // adicionalmente inclui relatorios legacy (patient_id nulo) cujo nome bate com patientName.
  // Como .eq restringe demasiado, refazemos filtragem em memoria quando ha pacienteId.
  const scoped = pacienteId
    ? reports.filter((r) => r.patient_id === pacienteId || (r.patient_id == null && patientName && (r.patient_name || "").toLowerCase().includes(patientName.toLowerCase())))
    : patientName
      ? reports.filter((r) => (r.patient_name || "").toLowerCase().includes(patientName.toLowerCase()))
      : reports;
  const filtered = scoped.filter((r) => (r.patient_name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {/* Topo */}
      <div
        style={{
          display: "flex" as const,
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap" as const,
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: G.dark, margin: "0 0 4px" }}>
            📋 Histórico de Relatórios
          </h2>
          <p style={{ color: G.muted, fontSize: 13, margin: 0 }}>
            {scoped.length} relatório{scoped.length !== 1 ? "s" : ""} guardado{scoped.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={onNew} style={btn("primary", { fontSize: 14 })}>
          ➕ Novo Relatório
        </button>
      </div>

      {/* Pesquisa */}
      <input
        type="text"
        placeholder="🔍  Pesquisar por paciente..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={input({ marginBottom: 20, fontSize: 14 })}
      />

      {/* Lista */}
      {loading ? (
        <p style={{ textAlign: "center" as const, color: G.muted, padding: 40 }}>A carregar...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center" as const, padding: "48px 20px", color: G.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🫁</div>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            {search ? "Nenhum resultado encontrado" : "Ainda não há relatórios"}
          </p>
          <p style={{ fontSize: 13 }}>{search ? "Tente outro nome" : "Clique em 'Novo Relatório' para começar"}</p>
        </div>
      ) : (
        <div style={{ display: "flex" as const, flexDirection: "column" as const, gap: 10 }}>
          {filtered.map((r) => (
            <div
              key={r.id}
              style={{
                ...card({ padding: "16px 20px" }),
                display: "flex" as const,
                alignItems: "center",
                gap: 16,
                transition: "box-shadow 0.15s" as const,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${G.gold}, ${G.goldLight})`,
                  display: "flex" as const,
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                🫁
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: G.dark,
                    margin: "0 0 3px",
                    whiteSpace: "nowrap" as const,
                    overflow: "hidden" as const,
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.patient_name}
                </p>
                <p style={{ fontSize: 12, color: G.muted, margin: 0 }}>
                  📅{" "}
                  {new Date(r.report_date).toLocaleDateString("pt-PT", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                  {r.data?.grau_fraqueza && (
                    <span style={{ marginLeft: 10, color: G.gold }}>· {r.data.grau_fraqueza}</span>
                  )}
                </p>
              </div>

              <div style={{ display: "flex" as const, gap: 8, flexShrink: 0 }}>
                <button onClick={() => onPreview(r)} style={btn("outline", { padding: "7px 14px", fontSize: 12 })}>
                  📄 Gerar novamente
                </button>
                <button onClick={() => onOpen(r)} style={btn("outline", { padding: "7px 14px", fontSize: 12 })}>
                  ✏️ Editar
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  disabled={deleting === r.id}
                  style={btn("ghost", {
                    padding: "7px 14px",
                    fontSize: 12,
                    color: "#C0392B",
                    border: "1px solid #FFCCCC",
                  })}
                >
                  🗑️ Apagar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Componente Principal ───────────────────────────────────────────────── */
export default function RelatorioRespiratório({ pacienteId, patientName }: { pacienteId?: string; patientName?: string } = {}) {
  const [view, setView] = useState<"history" | "new">("history");
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [data, setData] = useState({ ...EMPTY_DATA, nome: patientName || "" });
  const [secoes, setSocoes] = useState(Object.fromEntries(SECOES_CONFIG.map((s) => [s.id, true])));
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFileReady = (f, fd) => {
    setFile(f);
    setFileData(fd);
    setStep(2);
  };

  const handleIADone = (parsed) => {
    setData({ ...EMPTY_DATA, nome: patientName || "", ...parsed, progressao: parsed.progressao || EMPTY_DATA.progressao });
    setStep(3);
  };

  const handleOpenReport = (r: any) => {
    setData({ ...EMPTY_DATA, ...r.data });
    setEditingId(r.id);
    setStep(3);
    setView("new");
  };

  const handleNew = () => {
    setData({ ...EMPTY_DATA, nome: patientName || "" });
    setEditingId(null);
    setStep(1);
    setView("new");
  };

  const handleSaveAndReturn = async () => {
    try {
      const { userId, clinicId } = await getAuthContext();
      if (!clinicId) {
        toast.error("Clínica não encontrada. Faça login novamente.");
        return;
      }
      const reportData = {
        patient_name: data.nome || "Sem nome",
        report_date: toIsoDate(data.data),
        data: data,
        created_by: userId,
        clinic_id: clinicId,
        patient_id: pacienteId || null,
      };
      if (editingId) {
        const { error } = await (supabase as any).from("respiratory_reports").update(reportData).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: saved, error } = await (supabase as any).from("respiratory_reports").insert(reportData).select().single();
        if (error) throw error;
        if (saved) setEditingId(saved.id);
      }
      toast.success("Relatório guardado com sucesso");
      setView("history");
    } catch (err) {
      console.error("Erro ao guardar relatório:", err);
      toast.error("Erro ao guardar relatório. Verifique a consola para mais detalhes.");
    }
  };

  const bgStyle: CSSProperties = {
    minHeight: "100vh",
    background: `radial-gradient(ellipse at 20% 20%, #FFF8E8 0%, #F5EDD0 40%, #EDE0B8 100%)`,
    fontFamily: "'Georgia', 'Times New Roman', serif",
    padding: "40px 20px 60px",
  };

  /* ── Vista: Histórico ── */
  if (view === "history") {
    return (
      <div style={bgStyle}>
        <div style={{ textAlign: "center" as const, marginBottom: 36 }}>
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
        </div>
        <div
          style={{
            ...card({ maxWidth: 760, margin: "0 auto", padding: "36px 40px" }),
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)",
          }}
        >
          <HistoricoRelatorios pacienteId={pacienteId} patientName={patientName} onOpen={handleOpenReport} onNew={handleNew} onPreview={(r) => {
            setData({ ...EMPTY_DATA, ...r.data });
            setEditingId(r.id);
            setStep(4);
            setView("new");
          }} />

        </div>
      </div>
    );
  }

  /* ── Vista: Novo / Editar ── */
  return (
    <div style={bgStyle}>
      {/* Header com botão voltar */}
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
          {editingId ? "Editar Relatório" : "Gerador de Relatório com IA"}
        </h1>
        <p style={{ color: G.muted, fontSize: 14, margin: "0 0 16px" }}>
          {editingId
            ? "Edite e guarde as alterações"
            : "Upload BreatheLink PDF → Extracção automática → Edição → Exportação"}
        </p>
        <button onClick={() => setView("history")} style={btn("ghost", { fontSize: 13 })}>
          ← Voltar ao Histórico
        </button>
      </div>

      {!editingId && <Stepper current={step} />}

      <div
        style={{
          ...card({ maxWidth: 760, margin: "0 auto", padding: "36px 40px" }),
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
        }}
      >
        {!editingId && step === 1 && <StepUpload onFileReady={handleFileReady} />}
        {!editingId && step === 2 && <StepIA file={file} fileData={fileData} onDone={handleIADone} />}
        {(editingId || step === 3) && step !== 4 && (
          <StepEditor
            data={data}
            setData={setData}
            secoes={secoes}
            setSocoes={setSocoes}
            onNext={() => setStep(4)}
            extraActions={
              <button onClick={handleSaveAndReturn} style={btn("outline", { fontSize: 13 })}>
                💾 Guardar e Fechar
              </button>
            }
          />
        )}
        {!editingId && step === 4 && (
          <StepRelatorio data={data} secoes={secoes} onEdit={() => setStep(3)} onSave={handleSaveAndReturn} />
        )}
        {editingId && step === 4 && (
          <StepRelatorio data={data} secoes={secoes} onEdit={() => setStep(3)} onSave={handleSaveAndReturn} />
        )}
      </div>

      {!editingId && (
        <p style={{ textAlign: "center" as const, marginTop: 20, fontSize: 12, color: "#B8A878" }}>
          Passo {step} de {STEPS.length} · {STEPS[step - 1]?.label}
        </p>
      )}
    </div>
  );
}
