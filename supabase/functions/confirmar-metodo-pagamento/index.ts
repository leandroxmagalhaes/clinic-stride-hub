import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_BASE = "https://physione.app";

function redirectTo(path: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${APP_BASE}${path}`, ...corsHeaders },
  });
}

function isUuid(s: string | null): s is string {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const metodo = url.searchParams.get("metodo");

    if (!isUuid(token) || (metodo !== "numerario" && metodo !== "mbway_transferencia")) {
      return redirectTo("/r?e=erro");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: session, error } = await supabase
      .from("sessoes")
      .select("id")
      .eq("confirmation_token", token)
      .maybeSingle();

    if (error || !session) return redirectTo("/r?e=erro");

    const { error: updErr } = await supabase
      .from("sessoes")
      .update({ metodo_pagamento_previsto: metodo })
      .eq("id", (session as any).id);

    if (updErr) return redirectTo("/r?e=erro");

    return redirectTo("/r?e=metodo-registado");
  } catch (_e) {
    return redirectTo("/r?e=erro");
  }
});
