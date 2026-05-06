/**
 * @deprecated A página /mensagens foi descontinuada. Toda a conversação
 * acontece agora dentro do prontuário do utente (aba "Mensagens") ou via
 * o atalho flutuante no canto inferior direito. Este componente apenas
 * redireciona para o dashboard com toast informativo, ficando preservado
 * para o caso de querermos restaurar a vista no futuro.
 */
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

export default function Mensagens() {
  useEffect(() => {
    toast.info(
      "A página de Mensagens foi movida para dentro do prontuário do utente.",
    );
  }, []);
  return <Navigate to="/" replace />;
}
