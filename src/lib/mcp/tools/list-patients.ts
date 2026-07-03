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
  name: "list_patients",
  title: "Listar utentes",
  description:
    "Lista os utentes da clínica do utilizador autenticado. Devolve nome, telefone, email e data de nascimento.",
  inputSchema: {
    search: z
      .string()
      .trim()
      .optional()
      .describe("Texto opcional para filtrar por nome do utente (contém)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Número máximo de utentes a devolver (por omissão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let query = sb
      .from("pacientes")
      .select("id, nome, telefone, email, data_nascimento")
      .order("nome", { ascending: true })
      .limit(limit ?? 20);
    if (search) query = query.ilike("nome", `%${search}%`);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { patients: data ?? [] },
    };
  },
});
