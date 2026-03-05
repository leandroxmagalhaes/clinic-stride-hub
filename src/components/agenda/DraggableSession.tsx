import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, AlertTriangle, Package } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import React from "react";
import { useData } from "@/contexts/DataContext";

interface Session {
  id: string;
  start_time: Date;
  end_time: Date;
  status: string;
  payment_status?: string;
  paciente?: {
    full_name: string;
    id?: string;
    birth_date?: string | null;
  };
  profissional?: { full_name: string };
  servico?: { name: string; color: string };
  pack_id?: string | null; // coluna real: package_id
  package_id?: string | null;
}

interface DraggableSessionProps {
  session: Session;
  onClick: (session: Session) => void;
  hasCredits?: boolean;
  displayTime?: string;
  positionStyle?: React.CSSProperties;
}

// ── Formata o nome do serviço: remove "Fisioterapia" e abrevia ──────────────
function formatServico(name: string): string {
  if (!name) return "";

  const abreviacoes: Record<string, string> = {
    neurodesenvolvimental: "Neurodes.",
    neurodesenvolvimento: "Neurodes.",
    neurodevelopmental: "Neurodes.",
  };

  let result = name.replace(/^fisioterapia\s+/i, "").trim();

  const lower = result.toLowerCase();
  if (abreviacoes[lower]) {
    return abreviacoes[lower];
  }

  return result;
}
// ───────────────────────────────────────────────────────────────────────────

export function DraggableSession({ session, onClick, hasCredits, displayTime, positionStyle }: DraggableSessionProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
    data: { session },
  });

  const isPendingPayment = session.payment_status === "pending" || hasCredits === false;
  const hasCreditAvailable = hasCredits === true;
  const isFalta = session.status === "falta" || session.status === "Falta" || session.status === "no-show";
  const isRealizado = session.status === "realizado" || session.status === "Realizado";
  const isPago = isRealizado && session.payment_status === "pago";
  const isPendentePagamento = isRealizado && session.payment_status === "pendente";

  // ── Pack alert — calculado depois de isCompact ───────────────────────────
  const { packs } = useData();
  const _packId = (session as any).package_id ?? session.pack_id;
  const sessionPack = _packId ? packs.find((p) => p.id === _packId) : null;
  const packAlert = sessionPack?.alert_status;
  // showPackWarning declarado após isCompact abaixo
  // ─────────────────────────────────────────────────────────────────────────

  // ── Idade do paciente ─────────────────────────────────────────────────────
  const isChild = (() => {
    const bd = session.paciente?.birth_date;
    if (!bd) return false;
    const birth = new Date(bd);
    const today = new Date();
    const age =
      today.getFullYear() -
      birth.getFullYear() -
      (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
    return age < 13;
  })();

  // ── Especialidade: Respiratório vs Motora/Outras ──────────────────────────
  const serviceName = (session.servico?.name || "").toLowerCase();
  const isRespiratorio = serviceName.includes("respir");

  // ── Cores do card por especialidade + idade ───────────────────────────────
  // Respiratório < 13: azul bebé · ≥ 13: azul médio
  // Motora/Outras < 13: lilás claro · ≥ 13: lilás médio
  const cardColors = (() => {
    if (isRespiratorio) {
      return isChild
        ? { bg: "#dbeafe", border: "#93c5fd" } // azul bebé
        : { bg: "#93c5fd", border: "#3b82f6" }; // azul médio
    } else {
      return isChild
        ? { bg: "#ede9fe", border: "#c4b5fd" } // lilás claro
        : { bg: "#c4b5fd", border: "#7c3aed" }; // lilás médio
    }
  })();
  // ─────────────────────────────────────────────────────────────────────────

  const isCompact = positionStyle?.height != null && parseFloat(String(positionStyle.height)) < 48;
  const showPackWarning = !isCompact && (packAlert === "ultima_sessao" || packAlert === "penultima_sessao");

  const servicoFormatado = formatServico(session.servico?.name ?? "");
  const profissionalNome = session.profissional?.full_name?.split(" ")?.[0] ?? "";
  const servicoLinha = profissionalNome ? `${servicoFormatado} (${profissionalNome})` : servicoFormatado;

  const internalStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    // Fundo por especialidade + idade
    backgroundColor: cardColors.bg,
    borderColor: cardColors.border,
    border: `1px solid ${cardColors.border}`,
    // Falta: sobrepõe com traço diagonal vermelho via backgroundImage
    backgroundImage: isFalta
      ? `repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(220,38,38,0.20) 5px, rgba(220,38,38,0.20) 7px)`
      : undefined,
    ...positionStyle,
    minHeight: isCompact ? undefined : "60px",
    height: positionStyle?.height ? `max(${positionStyle.height}, ${isCompact ? "24px" : "60px"})` : undefined,
  };

  if (transform) {
    internalStyle.transform = CSS.Translate.toString(transform);
  }

  return (
    <div
      ref={setNodeRef}
      style={internalStyle}
      className={cn(
        "rounded-md text-xs cursor-grab hover:opacity-90 transition-all hover:shadow-md group/session select-none relative",
        isDragging && "opacity-50 shadow-lg z-50 ring-2 ring-primary",
        isFalta && "ring-1 ring-red-400",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick(session);
      }}
    >
      {/* Círculo farol de pagamento — canto inferior direito */}
      {!isCompact && isPago && (
        <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-green-600 border border-white/70 shadow-sm z-10" />
      )}
      {!isCompact && isPendentePagamento && (
        <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-orange-500 border border-white/70 shadow-sm z-10" />
      )}

      {/* Pack a acabar — icone canto superior direito */}
      {showPackWarning && (
        <div
          className={cn(
            "absolute top-1 right-1 z-10 rounded-full p-0.5",
            packAlert === "ultima_sessao" ? "bg-red-500 text-white" : "bg-orange-400 text-white",
          )}
        >
          <Package className="h-2.5 w-2.5" />
        </div>
      )}

      {isCompact ? (
        /* ── Ultra-compacto: tudo numa linha ── */
        <div className="flex items-center gap-1 p-1 min-w-0">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0">
            <GripVertical className="h-3 w-3 text-muted-foreground opacity-60" />
          </div>
          {displayTime && (
            <span
              className={cn(
                "text-[10px] font-medium flex-shrink-0",
                isFalta ? "text-orange-600" : "text-muted-foreground",
              )}
            >
              {displayTime}
            </span>
          )}
          {/* Nome truncado numa linha no compacto */}
          <p
            className={cn(
              "font-semibold text-[10px] truncate leading-tight flex-1 min-w-0",
              isFalta ? "text-orange-700" : "text-foreground",
            )}
          >
            {session.paciente?.full_name ?? ""}
          </p>
          <StatusBadge status={session.status as any} className="scale-75 flex-shrink-0" />
        </div>
      ) : (
        /* ── Layout normal — 3 linhas fixas ── */
        <div className="p-2 flex flex-col gap-0.5">
          {/* Linha 1: Hora + Status */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
              >
                <GripVertical
                  className={cn(
                    "h-3 w-3 opacity-60 group-hover/session:opacity-100 transition-opacity flex-shrink-0",
                    isFalta ? "text-orange-400" : "text-muted-foreground",
                  )}
                />
              </div>
              {displayTime && (
                <span
                  className={cn(
                    "text-[10px] font-semibold flex-shrink-0",
                    isFalta ? "text-orange-600" : "text-muted-foreground",
                  )}
                >
                  {displayTime}
                </span>
              )}
            </div>
            <StatusBadge status={session.status as any} className="scale-90 flex-shrink-0" />
          </div>

          {/* Linha 2: Nome */}
          <p
            className={cn(
              "font-semibold text-[11px] leading-tight truncate w-full",
              isFalta ? "text-red-700 line-through opacity-80" : "text-foreground",
            )}
            title={session.paciente?.full_name ?? ""}
          >
            {session.paciente?.full_name ?? ""}
          </p>

          {/* Linha 3: Especialidade (Profissional) — UMA linha, truncado se necessário */}
          {servicoLinha && (
            <p
              className={cn(
                "text-[10px] leading-tight truncate w-full",
                isFalta ? "text-red-600 line-through opacity-70" : "text-muted-foreground",
              )}
            >
              {servicoLinha}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
