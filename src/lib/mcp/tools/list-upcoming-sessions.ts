/// <reference path="../mcp-env.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_upcoming_sessions",
  title: "Próximas sessões",
  description:
    "Lista as próximas sessões agendadas na clínica do utilizador (a partir de agora), ordenadas por data.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Número máximo de sessões a devolver (por omissão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const nowIso = new Date().toISOString();
    const { data, error } = await sb
      .from("sessoes")
      .select("id, data_hora, status, paciente_id, profissional_id, servico_id")
      .gte("data_hora", nowIso)
      .order("data_hora", { ascending: true })
      .limit(limit ?? 20);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { sessions: data ?? [] },
    };
  },
});
