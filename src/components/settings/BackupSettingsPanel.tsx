import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, FileArchive, Clock, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function BackupSettingsPanel() {
  const [isExporting, setIsExporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const handleExportData = async () => {
    setIsExporting(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        toast.error("Sessão expirada. Faça login novamente.");
        setIsExporting(false);
        return;
      }

      const response = await supabase.functions.invoke("export-clinic-data", {
        body: {},
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao exportar dados");
      }

      // The response contains base64-encoded ZIP data
      const { zipBase64, filename } = response.data;

      if (!zipBase64) {
        throw new Error("Resposta inválida do servidor");
      }

      // Convert base64 to blob
      const byteCharacters = atob(zipBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/zip" });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `backup_${new Date().toISOString().slice(0, 16).replace(/[:-]/g, "")}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setLastBackup(new Date().toLocaleString("pt-PT"));
      toast.success("Backup exportado com sucesso!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao exportar dados");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileArchive className="h-5 w-5" />
          Backup e Exportação
        </CardTitle>
        <CardDescription>
          Exporte os dados da sua clínica em formato CSV compactado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warning Alert */}
        <Alert className="border-warning/50 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            <strong>Recomendação:</strong> Faça backup dos seus dados semanalmente para 
            garantir a segurança das informações.
          </AlertDescription>
        </Alert>

        {/* What will be exported */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">O que será exportado:</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span><strong>pacientes.csv</strong> - Lista completa de pacientes</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span><strong>sessoes.csv</strong> - Histórico de agendamentos</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span><strong>transacoes_credito.csv</strong> - Movimentação de créditos</span>
            </li>
          </ul>
        </div>

        {/* Last backup info */}
        {lastBackup && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Último backup: {lastBackup}</span>
          </div>
        )}

        {/* Export Button */}
        <Button 
          onClick={handleExportData} 
          disabled={isExporting}
          className="w-full sm:w-auto gap-2"
          size="lg"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Exportar Dados
            </>
          )}
        </Button>

        {/* Additional info */}
        <p className="text-xs text-muted-foreground">
          O arquivo ZIP será gerado com a data e hora no nome do ficheiro para fácil identificação.
          Os dados são exportados em formato CSV, compatível com Excel e outras ferramentas de análise.
        </p>
      </CardContent>
    </Card>
  );
}
