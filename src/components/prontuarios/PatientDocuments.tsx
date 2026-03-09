import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  FileText,
  FileImage,
  File,
  Download,
  Trash2,
  Loader2,
  FolderOpen,
  X,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

/* ─── Tipos ─────────────────────────────────────────────────────────────── */
interface PatientDocument {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  category: string;
  description: string | null;
  created_at: string;
}

interface PatientDocumentsProps {
  pacienteId: string;
  prontuarioId: string;
  clinicId: string;
}

/* ─── Constantes ─────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { value: "exame_imagem", label: "Exame de Imagem", color: "bg-blue-100 text-blue-700" },
  { value: "exame_laboratorial", label: "Exame Laboratorial", color: "bg-purple-100 text-purple-700" },
  { value: "relatorio_medico", label: "Relatório Médico", color: "bg-green-100 text-green-700" },
  { value: "relatorio_outro", label: "Relatório de Outro Prof.", color: "bg-orange-100 text-orange-700" },
  { value: "prescricao", label: "Prescrição", color: "bg-red-100 text-red-700" },
  { value: "consentimento", label: "Consentimento Informado", color: "bg-yellow-100 text-yellow-700" },
  { value: "outro", label: "Outro", color: "bg-gray-100 text-gray-700" },
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/* ─── Utilitários ────────────────────────────────────────────────────────── */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return <FileImage className="h-5 w-5 text-blue-500" />;
  if (fileType === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />;
  return <File className="h-5 w-5 text-gray-500" />;
}

function getCategoryInfo(value: string) {
  return CATEGORIES.find((c) => c.value === value) || CATEGORIES[CATEGORIES.length - 1];
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════════════════════ */
export function PatientDocuments({ pacienteId, prontuarioId, clinicId }: PatientDocumentsProps) {
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form upload
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [category, setCategory] = useState("outro");
  const [description, setDescription] = useState("");
  const [showForm, setShowForm] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Fetch ──────────────────────────────────────────────────────────────── */
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("patient_documents")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false });
    if (!error && data) setDocuments(data);
    setLoading(false);
  }, [pacienteId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  /* ── Validar ficheiro ───────────────────────────────────────────────────── */
  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) return "Tipo de ficheiro não suportado. Use PDF, imagens, Word ou Excel.";
    if (file.size > MAX_FILE_SIZE) return `Ficheiro demasiado grande. Máximo ${formatBytes(MAX_FILE_SIZE)}.`;
    return null;
  };

  /* ── Seleccionar ficheiro ───────────────────────────────────────────────── */
  const handleFileSelect = (file: File) => {
    const err = validateFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setPendingFile(file);
    setShowForm(true);
    setCategory("outro");
    setDescription("");
  };

  /* ── Upload ─────────────────────────────────────────────────────────────── */
  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setUploadProgress(10);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const ext = pendingFile.name.split(".").pop();
      const safeName = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${clinicId}/${pacienteId}/${Date.now()}_${safeName}`;

      setUploadProgress(30);

      const { error: storageError } = await supabase.storage
        .from("patient-documents")
        .upload(storagePath, pendingFile, { contentType: pendingFile.type, upsert: false });

      if (storageError) throw storageError;

      setUploadProgress(70);

      const { error: dbError } = await (supabase as any).from("patient_documents").insert({
        clinic_id: clinicId,
        paciente_id: pacienteId,
        prontuario_id: prontuarioId,
        uploaded_by: userData.user.id,
        file_name: pendingFile.name,
        file_type: pendingFile.type,
        file_size: pendingFile.size,
        storage_path: storagePath,
        category,
        description: description.trim() || null,
      });

      if (dbError) {
        // Limpar storage se DB falhou
        await supabase.storage.from("patient-documents").remove([storagePath]);
        throw dbError;
      }

      setUploadProgress(100);
      toast.success("Documento carregado com sucesso!");
      setPendingFile(null);
      setShowForm(false);
      setDescription("");
      setCategory("outro");
      await fetchDocuments();
    } catch (err: any) {
      toast.error("Erro ao carregar: " + (err.message || "Tente novamente"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  /* ── Download / Visualizar ──────────────────────────────────────────────── */
  const handleDownload = async (doc: PatientDocument) => {
    try {
      const { data, error } = await supabase.storage.from("patient-documents").createSignedUrl(doc.storage_path, 60); // 60 segundos
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      toast.error("Erro ao abrir documento");
    }
  };

  /* ── Apagar ─────────────────────────────────────────────────────────────── */
  const handleDelete = async () => {
    if (!deleteId) return;
    const doc = documents.find((d) => d.id === deleteId);
    if (!doc) return;
    setDeletingId(deleteId);
    setDeleteId(null);
    try {
      await supabase.storage.from("patient-documents").remove([doc.storage_path]);
      await (supabase as any).from("patient_documents").delete().eq("id", doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success("Documento eliminado");
    } catch (err: any) {
      toast.error("Erro ao eliminar documento");
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* ── Zona de upload ── */}
      {!showForm ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200",
            dragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Arraste um ficheiro ou clique para seleccionar</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, imagens, Word, Excel · Máx. 20MB</p>
            </div>
          </div>
        </div>
      ) : (
        /* ── Formulário antes do upload ── */
        <div className="border rounded-xl p-5 bg-muted/20 space-y-4 animate-fade-in">
          {/* Ficheiro seleccionado */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
            {pendingFile && getFileIcon(pendingFile.type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{pendingFile?.name}</p>
              <p className="text-xs text-muted-foreground">{pendingFile && formatBytes(pendingFile.size)}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                setPendingFile(null);
                setShowForm(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Categoria *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="min-h-[40px]">
                <SelectValue placeholder="Seleccione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              placeholder="Ex: Radiografia tórax — 08/03/2026"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Barra de progresso */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">{uploadProgress}% enviado...</p>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setPendingFile(null);
                setShowForm(false);
              }}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button className="flex-1 gap-2" onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />A enviar...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Carregar
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Lista de documentos ── */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhum documento carregado</p>
          <p className="text-xs mt-1">Adicione exames, relatórios e outros ficheiros clínicos</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {documents.length} documento{documents.length !== 1 ? "s" : ""}
          </p>
          {documents.map((doc) => {
            const catInfo = getCategoryInfo(doc.category);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors group"
              >
                {/* Ícone */}
                <div className="flex-shrink-0">{getFileIcon(doc.file_type)}</div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge className={cn("text-[10px] px-1.5 py-0 h-4 border-0", catInfo.color)}>{catInfo.label}</Badge>
                    <span className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(doc.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  {doc.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.description}</p>
                  )}
                </div>

                {/* Acções */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleDownload(doc)}
                    title="Abrir / Descarregar"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(doc.id)}
                    disabled={deletingId === doc.id}
                    title="Eliminar"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Confirmar eliminação ── */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acção é irreversível. O ficheiro será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
