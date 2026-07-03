import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPatientsTool from "./tools/list-patients";
import listUpcomingSessionsTool from "./tools/list-upcoming-sessions";

// Direct Supabase host — required for OAuth issuer discovery.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "physione-mcp",
  title: "PhysioNE MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas para a plataforma PhysioNE. Consulta utentes e próximas sessões da clínica do utilizador autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listPatientsTool, listUpcomingSessionsTool],
});
