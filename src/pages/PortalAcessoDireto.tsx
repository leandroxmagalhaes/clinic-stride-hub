import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import PortalErrorScreen from "@/components/portal/PortalErrorScreen";

export default function PortalAcessoDireto() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!token) {
        setErrorMessage("Link inválido.");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await supabase.auth.signOut();
      } catch { /* ignore */ }

      try {
        const { data, error } = await supabase.functions.invoke("portal-direct-access", {
          body: { token },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);

        if (data?.access_token && data?.refresh_token) {
          await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
        }

        if (!cancelled) navigate("/portal/onboarding", { replace: true });
      } catch (err: any) {
        const msg = (err?.message || "").toLowerCase();
        if (msg.includes("expirou")) setErrorMessage("expired");
        else if (msg.includes("inválido")) setErrorMessage("not_found");
        else setErrorMessage(err?.message || "Erro ao abrir o portal");
      }
    };

    run();
    return () => { cancelled = true; };
  }, [token, navigate]);

  if (errorMessage) {
    return <PortalErrorScreen reason={errorMessage} onLogin={() => navigate("/portal/login")} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">A abrir o seu portal...</p>
    </div>
  );
}
