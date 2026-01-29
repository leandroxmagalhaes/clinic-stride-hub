import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  PatientImportService,
  ImportRow,
  ValidationResult,
} from '@/services/PatientImportService';
import { cn } from '@/lib/utils';

interface ImportPatientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicId: string;
  onImportComplete: () => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

export function ImportPatientsModal({
  isOpen,
  onClose,
  clinicId,
  onImportComplete,
}: ImportPatientsModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validCount = validationResults.filter((r) => r.valid).length;
  const invalidCount = validationResults.filter((r) => !r.valid).length;

  const resetState = useCallback(() => {
    setStep('upload');
    setValidationResults([]);
    setImportResult(null);
    setIsDragging(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const processFile = useCallback(async (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    
    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    
    if (!validTypes.includes(file.type) && !hasValidExtension) {
      toast.error('Formato inválido. Use ficheiros .xlsx, .xls ou .csv');
      return;
    }

    try {
      const rows = await PatientImportService.parseFile(file);
      
      if (rows.length === 0) {
        toast.error('O ficheiro está vazio ou não contém dados válidos');
        return;
      }
      
      const results = PatientImportService.validateRows(rows);
      setValidationResults(results);
      setStep('preview');
    } catch (error) {
      console.error('Erro ao processar ficheiro:', error);
      toast.error('Erro ao processar o ficheiro. Verifique o formato.');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [processFile]
  );

  const handleDownloadTemplate = useCallback(() => {
    PatientImportService.downloadTemplate();
    toast.success('Modelo descarregado!');
  }, []);

  const handleImport = useCallback(async () => {
    if (validCount === 0) {
      toast.error('Não há pacientes válidos para importar');
      return;
    }

    setStep('importing');

    try {
      const result = await PatientImportService.importPatients(
        validationResults,
        clinicId
      );
      
      setImportResult({
        success: result.success,
        failed: result.failed,
      });
      setStep('complete');
      
      if (result.success > 0) {
        onImportComplete();
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error('Erro ao importar pacientes');
      setStep('preview');
    }
  }, [validCount, validationResults, clinicId, onImportComplete]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Pacientes
          </DialogTitle>
          <DialogDescription>
            Importe múltiplos pacientes a partir de uma planilha Excel ou CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drag & Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                )}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium mb-1">
                  Arraste o ficheiro aqui ou clique para selecionar
                </p>
                <p className="text-sm text-muted-foreground">
                  Formatos suportados: .xlsx, .xls, .csv
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Download Template Button */}
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                className="w-full gap-2"
              >
                <Download className="h-4 w-4" />
                Descarregar modelo de planilha
              </Button>

              {/* Instructions */}
              <div className="rounded-lg bg-muted/50 p-4 text-sm">
                <p className="font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Campos obrigatórios:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li><strong>nome</strong> - Nome completo (mínimo 3 caracteres)</li>
                  <li><strong>nif</strong> - Número de Identificação Fiscal</li>
                </ul>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="font-medium">{validCount} válidos</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="font-medium">{invalidCount} com erros</span>
                  </div>
                )}
              </div>

              {/* Preview Table */}
              <ScrollArea className="h-[350px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>NIF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResults.map((result) => (
                      <TableRow
                        key={result.row}
                        className={cn(
                          !result.valid && 'bg-destructive/5'
                        )}
                      >
                        <TableCell className="font-mono text-xs">
                          {result.row}
                        </TableCell>
                        <TableCell className="font-medium max-w-[150px] truncate">
                          {result.originalData.nome || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {result.originalData.nif || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {result.originalData.telefone || '-'}
                        </TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate">
                          {result.originalData.email || '-'}
                        </TableCell>
                        <TableCell>
                          {result.valid ? (
                            <Badge
                              variant="secondary"
                              className="bg-success/10 text-success gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Válido
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-destructive/10 text-destructive gap-1"
                              title={result.errors.join('\n')}
                            >
                              <XCircle className="h-3 w-3" />
                              {result.errors[0]}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Importing Step */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="font-medium">A importar {validCount} pacientes...</p>
              <p className="text-sm text-muted-foreground">
                Por favor, aguarde
              </p>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && importResult && (
            <div className="flex flex-col items-center justify-center py-12">
              {importResult.success > 0 ? (
                <>
                  <CheckCircle2 className="h-16 w-16 text-success mb-4" />
                  <p className="text-xl font-semibold mb-2">
                    Importação concluída!
                  </p>
                  <p className="text-muted-foreground mb-4">
                    {importResult.success} pacientes importados com sucesso
                  </p>
                  {importResult.failed > 0 && (
                    <p className="text-sm text-warning">
                      {importResult.failed} linhas ignoradas por erros
                    </p>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="h-16 w-16 text-destructive mb-4" />
                  <p className="text-xl font-semibold mb-2">
                    Falha na importação
                  </p>
                  <p className="text-muted-foreground">
                    Nenhum paciente foi importado
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={resetState}>
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Importar {validCount} paciente{validCount !== 1 ? 's' : ''}
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
