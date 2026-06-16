// ai-copilot-agent v2 — Agente nativo Anthropic (Messages API)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { TOOLS, ACTION_TOOLS, runTool, todayInLisbon, ANTHROPIC_MODEL, MAX_ROUNDS, corsHeaders } from "./agent-core.ts";

function systemPrompt(currentPage: string): string {
  return `És o Copiloto, o assistente operacional de uma clínica de fisioterapia em Portugal. Hoje é ${todayInLisbon()} (fuso Europe/Lisbon).

PERSONA E ESTILO
- Responde SEMPRE em português de Portugal (utente, marcação, sessão).
- Direto e conciso. Frases curtas. Sem repetições nem floreados.
- Datas em formato legível (ex.: "segunda, 16 de Junho às 16:00").

COMO TRABALHAS
- Para localizar uma sessão, usa list_sessions (por dia) ou list_patient_sessions (por utente) e identifica-a pelo session_id. NUNCA peças nem assumas a hora exata para procurar — usa sempre o session_id devolvido pelas listas.
- Para qualquer nome de utente, se houver mais de um resultado, mostra as opções e pede para escolher.
- Usa o contexto da página atual (${currentPage}) para interpretar pedidos ("esta sessão", "este utente").

AÇÕES (create_session, update_session_status, register_payment, exempt_no_show)
- Fluxo obrigatório em 2 passos: 1) chama a ferramenta SEM confirm → recebes um "preview" com resumo; mostra-o e pergunta se confirma. 2) Só após o "sim" do utilizador, chama A MESMA ferramenta com confirm=true e os mesmos parâmetros (incluindo session_id).
- NUNCA declares que algo foi feito sem teres recebido {"success": true} de uma ferramenta. Se não recebeste, a ação não aconteceu — não inventes.
- Se uma ferramenta devolver "error", explica o erro de forma simples e sugere o próximo passo (ex.: localizar a sessão primeiro). Não finjas sucesso.
- Se devolver "needs_clarification", lista as opções. Se "needs_reason", pede o motivo.

REGRAS DE NEGÓCIO
- Faltas/cancelamentos após as 14h do dia anterior podem ser cobrados (consomem o pack). A ferramenta trata disso e diz-te se foi cobrado.
- Packs não têm especialidade: qualquer sessão do utente consome o pack ativo.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sse = (text: string) => {
    const enc = new TextEncoder();
    return new Response(new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\n`));
        c.enqueue(enc.encode("data: [DONE]\n\n"));
        c.close();
      },
    }), { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    if (!anthropicApiKey) {
      return sse("O motor de IA (Claude) não está configurado. Verifica a chave ANTHROPIC_API_KEY nas definições.");
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const db = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await db.from("profiles").select("clinic_id").eq("user_id", userId).maybeSingle();
    if (!profile?.clinic_id) return sse("Não encontrei a tua clínica. Verifica o teu perfil.");
    const clinicId = profile.clinic_id;

    const { messages = [], context = {}, file_upload } = await req.json();
    const currentPage = context.currentPage || "/";

    // Monta as mensagens no formato Anthropic
    const amsgs: any[] = [];
    for (const m of messages) {
      if (m.role !== "user" && m.role !== "assistant") continue;
      amsgs.push({ role: m.role, content: typeof m.content === "string" ? m.content : String(m.content ?? "") });
    }
    // Imagem anexada -> bloco multimodal na última mensagem do utilizador
    if (file_upload && /^image\//.test(file_upload.mime_type || "") && amsgs.length > 0) {
      const last = amsgs[amsgs.length - 1];
      if (last.role === "user") {
        last.content = [
          { type: "text", text: typeof last.content === "string" && last.content ? last.content : `Analisa a imagem "${file_upload.name}".` },
          { type: "image", source: { type: "base64", media_type: file_upload.mime_type, data: file_upload.base64 } },
        ];
      }
    } else if (file_upload && amsgs.length > 0) {
      const last = amsgs[amsgs.length - 1];
      if (last.role === "user" && typeof last.content === "string") {
        last.content += `\n\n[Ficheiro anexado: ${file_upload.name} (${file_upload.mime_type}). Nota: o processamento de ficheiros Excel/PDF para importação ainda não está disponível neste assistente.]`;
      }
    }
    if (amsgs.length === 0) return sse("Não recebi nenhuma mensagem.");

    const sys = systemPrompt(currentPage);
    let finalText = "";
    let actionOk = false;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const isLast = round === MAX_ROUNDS - 1;
      const body: any = {
        model: ANTHROPIC_MODEL,
        max_tokens: 1500,
        system: sys,
        messages: amsgs,
      };
      if (!isLast) body.tools = TOOLS;

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicApiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errTxt = await resp.text();
        console.error("Anthropic error:", resp.status, errTxt);
        if (resp.status === 429) return sse("Estou a receber muitos pedidos agora. Tenta novamente daqui a alguns segundos.");
        if (resp.status === 401) return sse("A chave da API (Claude) parece inválida. Verifica ANTHROPIC_API_KEY.");
        return sse("Tive um problema técnico ao falar com o motor de IA. Tenta novamente; se persistir, avisa.");
      }

      const data = await resp.json();
      const blocks: any[] = data.content || [];
      const toolUses = blocks.filter((b) => b.type === "tool_use");
      const textParts = blocks.filter((b) => b.type === "text").map((b) => b.text).join("");

      if (toolUses.length === 0 || data.stop_reason !== "tool_use") {
        finalText = textParts || finalText;
        break;
      }

      // Regista a vez do assistente (com os tool_use)
      amsgs.push({ role: "assistant", content: blocks });

      // Executa cada ferramenta e devolve tool_result
      const results: any[] = [];
      for (const tu of toolUses) {
        let out: any;
        try {
          out = await runTool(tu.name, tu.input || {}, db, clinicId, userId);
        } catch (e) {
          out = { error: e instanceof Error ? e.message : "Erro ao executar a ferramenta." };
        }
        if (out?.success === true && ACTION_TOOLS.has(tu.name)) actionOk = true;
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
      }
      amsgs.push({ role: "user", content: results });
    }

    if (!finalText) finalText = "Não consegui formular uma resposta. Podes reformular o pedido?";

    // Salvaguarda: nunca afirmar conclusão sem ação bem-sucedida
    if (!actionOk && /\b(feito|conclu[ií]|regist|agend|marqu|cancel|atualiz|paga|isent)\w*/i.test(finalText)) {
      // só intervém se o texto afirmar conclusão; perguntas ("confirmas?") passam
      if (!/confirm|\?/i.test(finalText)) {
        finalText = "Para concluir, preciso da tua confirmação. Confirmas a ação?";
      }
    }

    // Log de uso (best-effort)
    try {
      await db.from("ai_usage_logs").insert({
        clinic_id: clinicId, user_id: userId, feature: "copilot",
        action: file_upload ? "chat_file" : "chat", model: ANTHROPIC_MODEL,
      });
    } catch { /* ignore */ }

    return sse(finalText);
  } catch (e) {
    console.error("Copilot fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
