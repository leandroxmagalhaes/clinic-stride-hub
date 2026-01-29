import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { PatientStatementService } from "@/services/PatientStatementService";
import { toast } from "sonner";

interface PatientStatementButtonProps {
  patientId: string;
  patientName: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function PatientStatementButton({
  patientId,
  patientName,
  variant = "outline",
  size = "default",
}: PatientStatementButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      await PatientStatementService.downloadStatement(patientId, patientName);
      toast.success("Extrato descarregado com sucesso!");
    } catch (error) {
      console.error("Error downloading statement:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao gerar extrato");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={isLoading}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4" />
      )}
      Extrato
    </Button>
  );
}
