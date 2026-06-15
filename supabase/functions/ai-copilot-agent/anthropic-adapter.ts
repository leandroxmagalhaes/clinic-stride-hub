// anthropic-adapter.ts — Conversão entre o formato OpenAI (usado no agente) e a
// Messages API nativa da Anthropic (/v1/messages). Mantém o resto do código igual:
// o agente continua a "pensar" em formato OpenAI; aqui traduzimos só na fronteira.

interface OpenAITool {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

// Converte tools do formato OpenAI -> Anthropic
export function toAnthropicTools(openaiTools: OpenAITool[]) {
  return openaiTools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

// Converte a lista de mensagens (formato OpenAI) -> { system, messages } da Anthropic
export function toAnthropicMessages(messages: any[]): { system: string; messages: any[] } {
  const systemParts: string[] = [];
  const out: any[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      // Anthropic recebe o system num campo à parte
      if (typeof m.content === "string") systemParts.push(m.content);
      continue;
    }

    if (m.role === "assistant") {
      const blocks: any[] = [];
      if (m.content && typeof m.content === "string" && m.content.trim()) {
        blocks.push({ type: "text", text: m.content });
      }
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          let input: any = {};
          try {
            input = typeof tc.function.arguments === "string"
              ? JSON.parse(tc.function.arguments || "{}")
              : (tc.function.arguments || {});
          } catch { input = {}; }
          blocks.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
        }
      }
      out.push({ role: "assistant", content: blocks.length ? blocks : [{ type: "text", text: "" }] });
      continue;
    }

    if (m.role === "tool") {
      // Resultado de ferramenta -> bloco tool_result numa mensagem do utilizador
      out.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: String(m.content ?? "") }],
      });
      continue;
    }

    // role === "user"
    if (Array.isArray(m.content)) {
      // multimodal (texto + imagem) -> converter image_url para o formato Anthropic
      const blocks = m.content.map((part: any) => {
        if (part.type === "image_url") {
          const url: string = part.image_url?.url || "";
          const match = url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
          }
          return { type: "text", text: "[imagem não suportada]" };
        }
        return { type: "text", text: part.text || "" };
      });
      out.push({ role: "user", content: blocks });
    } else {
      out.push({ role: "user", content: String(m.content ?? "") });
    }
  }

  // Anthropic exige que a 1ª mensagem seja do utilizador; se a conversa começar com
  // tool_result órfão (não deve acontecer), garantimos pelo menos uma mensagem válida.
  return { system: systemParts.join("\n\n"), messages: out };
}

// Converte a resposta da Anthropic -> formato OpenAI que o loop do agente já trata
export function fromAnthropicResponse(data: any): {
  choices: { finish_reason: string; message: { content: string; tool_calls?: any[] } }[];
  usage?: { total_tokens?: number };
} {
  const contentBlocks: any[] = data?.content || [];
  let text = "";
  const toolCalls: any[] = [];

  for (const block of contentBlocks) {
    if (block.type === "text") {
      text += block.text || "";
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: { name: block.name, arguments: JSON.stringify(block.input || {}) },
      });
    }
  }

  const stopReason = data?.stop_reason;
  const finishReason = stopReason === "tool_use" || toolCalls.length > 0 ? "tool_calls" : "stop";

  const usage = data?.usage
    ? { total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0) }
    : undefined;

  return {
    choices: [{
      finish_reason: finishReason,
      message: { content: text, tool_calls: toolCalls.length ? toolCalls : undefined },
    }],
    usage,
  };
}
