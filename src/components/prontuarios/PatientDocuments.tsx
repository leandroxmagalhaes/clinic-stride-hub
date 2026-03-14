import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Camera,
  Video,
  Image,
  Play,
  ZoomIn,
  RotateCcw,
  SwitchCamera,
  Circle,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS
═══════════════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES
═══════════════════════════════════════════════════════════════════════════ */
const DOC_CATEGORIES = [
  { value: "exame_imagem", label: "Exame de Imagem", color: "bg-blue-100 text-blue-700" },
  { value: "exame_laboratorial", label: "Exame Laboratorial", color: "bg-purple-100 text-purple-700" },
  { value: "relatorio_medico", label: "Relatório Médico", color: "bg-green-100 text-green-700" },
  { value: "relatorio_outro", label: "Relatório de Outro Prof.", color: "bg-orange-100 text-orange-700" },
  { value: "prescricao", label: "Prescrição", color: "bg-red-100 text-red-700" },
  { value: "consentimento", label: "Consentimento Informado", color: "bg-yellow-100 text-yellow-700" },
  { value: "outro", label: "Outro", color: "bg-gray-100 text-gray-700" },
];

const MEDIA_CATEGORIES = [
  { value: "evolucao_clinica", label: "Evolução Clínica", color: "bg-teal-100 text-teal-700" },
  { value: "avaliacao_inicial", label: "Avaliação Inicial", color: "bg-cyan-100 text-cyan-700" },
  { value: "pos_tratamento", label: "Pós-Tratamento", color: "bg-emerald-100 text-emerald-700" },
  { value: "exercicio", label: "Exercício / Técnica", color: "bg-indigo-100 text-indigo-700" },
  { value: "outro", label: "Outro", color: "bg-gray-100 text-gray-700" },
];

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const ACCEPTED_DOCS = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";
const ACCEPTED_MEDIA = "image/*,video/*";

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITÁRIOS
═══════════════════════════════════════════════════════════════════════════ */
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function makeTimestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function isImage(type: string) {
  return type.startsWith("image/");
}
function isVideo(type: string) {
  return type.startsWith("video/");
}
function isMediaFile(type: string) {
  return isImage(type) || isVideo(type);
}

function getDocIcon(type: string) {
  if (isImage(type)) return <FileImage className="h-5 w-5 text-blue-500" />;
  if (type === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />;
  return <File className="h-5 w-5 text-gray-500" />;
}

function getCategoryInfo(value: string, isMedia: boolean) {
  const list = isMedia ? MEDIA_CATEGORIES : DOC_CATEGORIES;
  return list.find((c) => c.value === value) || list[list.length - 1];
}

/* ═══════════════════════════════════════════════════════════════════════════
   CÂMARA
═══════════════════════════════════════════════════════════════════════════ */
interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

function CameraModal({ open, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [recording, setRecording] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setReady(false);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: mode === "video",
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setReady(true);
      }
    } catch {
      setError("Não foi possível aceder à câmara. Verifique as permissões do browser.");
    }
  }, [facingMode, mode]);

  useEffect(() => {
    if (open) startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, startCamera]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new (File as any)([blob], `foto_${makeTimestamp()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, { mimeType: "video/webm;codecs=vp9,opus" });
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const file = new (File as any)([blob], `video_${makeTimestamp()}.webm`, { type: "video/webm" });
      onCapture(file);
      handleClose();
    };
    mr.start(200);
    mediaRecRef.current = mr;
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    mediaRecRef.current?.stop();
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClose = () => {
    if (recording) stopRecording();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setReady(false);
    onClose();
  };

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-black">
        <DialogHeader className="sr-only">
          <DialogTitle>Câmara</DialogTitle>
        </DialogHeader>

        <div className="relative aspect-[4/3] bg-black w-full">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6 gap-3">
              <Camera className="h-10 w-10 opacity-50" />
              <p className="text-sm">{error}</p>
              <Button size="sm" variant="outline" className="text-white border-white" onClick={startCamera}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          )}

          {recording && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-sm font-mono">{fmtTime(elapsed)}</span>
            </div>
          )}

          <button
            onClick={() => setFacingMode((f) => (f === "user" ? "environment" : "user"))}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>
        </div>

        <div className="bg-black p-4 space-y-3">
          {!recording && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setMode("photo")}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                  mode === "photo" ? "bg-white text-black" : "text-white/60",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <Image className="h-3.5 w-3.5" />
                  Foto
                </span>
              </button>
              <button
                onClick={() => setMode("video")}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                  mode === "video" ? "bg-white text-black" : "text-white/60",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5" />
                  Vídeo
                </span>
              </button>
            </div>
          )}

          <div className="flex items-center justify-center gap-6">
            <button onClick={handleClose} className="text-white/60 hover:text-white transition-colors">
              <X className="h-6 w-6" />
            </button>

            {mode === "photo" ? (
              <button
                onClick={capturePhoto}
                disabled={!ready}
                className="w-16 h-16 rounded-full bg-white disabled:opacity-40 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 rounded-full border-2 border-black/20" />
              </button>
            ) : (
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={!ready}
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-40",
                  recording ? "bg-red-500" : "bg-white",
                )}
              >
                {recording ? (
                  <Square className="h-6 w-6 text-white fill-white" />
                ) : (
                  <Circle className="h-8 w-8 text-red-500 fill-red-500" />
                )}
              </button>
            )}

            <div className="w-6 h-6" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PREVIEW MEDIA
═══════════════════════════════════════════════════════════════════════════ */
interface MediaPreviewProps {
  url: string;
  fileType: string;
  fileName: string;
  onClose: () => void;
}

function MediaPreview({ url, fileType, fileName, onClose }: MediaPreviewProps) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{fileName}</DialogTitle>
        </DialogHeader>
        <div className="relative bg-black flex items-center justify-center min-h-[300px]">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
          {isVideo(fileType) ? (
            <video src={url} controls autoPlay className="max-h-[70vh] max-w-full" />
          ) : (
            <img src={url} alt={fileName} className="max-h-[70vh] max-w-full object-contain" />
          )}
        </div>
        <div className="p-3 bg-background">
          <p className="text-sm font-medium truncate">{fileName}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════════════════════ */
export function PatientDocuments({ pacienteId, prontuarioId, clinicId }: PatientDocumentsProps) {
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<PatientDocument | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [category, setCategory] = useState("outro");
  const [description, setDescription] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("documentos");

  const docInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  /* ── Fetch ── */
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

  /* ── Filtros ── */
  const docList = documents.filter((d) => !isMediaFile(d.file_type));
  const mediaList = documents.filter((d) => isMediaFile(d.file_type));
  const photoList = mediaList.filter((d) => isImage(d.file_type));
  const videoList = mediaList.filter((d) => isVideo(d.file_type));

  /* ── Seleccionar ficheiro ── */
  const handleFileSelect = (file: File) => {
    const maxSize = isVideo(file.type) ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      toast.error(`Ficheiro demasiado grande. Máximo ${formatBytes(maxSize)}.`);
      return;
    }
    setPendingFile(file);
    setCategory(isMediaFile(file.type) ? "evolucao_clinica" : "outro");
    setDescription("");
    setShowForm(true);
  };

  /* ── Upload ── */
  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setProgress(10);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const safeName = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${clinicId}/${pacienteId}/${Date.now()}_${safeName}`;

      setProgress(30);
      const { error: storageError } = await supabase.storage
        .from("patient-documents")
        .upload(storagePath, pendingFile, { contentType: pendingFile.type, upsert: false });
      if (storageError) throw storageError;

      setProgress(70);
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
        await supabase.storage.from("patient-documents").remove([storagePath]);
        throw dbError;
      }

      setProgress(100);
      toast.success(isMediaFile(pendingFile.type) ? "Mídia guardada!" : "Documento carregado!");
      setPendingFile(null);
      setShowForm(false);
      await fetchDocuments();
    } catch (err: any) {
      toast.error("Erro ao carregar: " + (err.message || "Tente novamente"));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  /* ── Preview ── */
  const handlePreview = async (doc: PatientDocument) => {
    try {
      const { data, error } = await supabase.storage.from("patient-documents").createSignedUrl(doc.storage_path, 120);
      if (error) throw error;
      setPreviewFile(doc);
      setPreviewUrl(data.signedUrl);
    } catch {
      toast.error("Erro ao abrir ficheiro");
    }
  };

  /* ── Download ── */
  const handleDownload = async (doc: PatientDocument) => {
    try {
      const { data, error } = await supabase.storage.from("patient-documents").createSignedUrl(doc.storage_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Erro ao descarregar ficheiro");
    }
  };

  /* ── Apagar ── */
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
      toast.success("Eliminado com sucesso");
    } catch {
      toast.error("Erro ao eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Form ── */
  const isMediaPending = pendingFile ? isMediaFile(pendingFile.type) : false;
  const categoryOptions = isMediaPending ? MEDIA_CATEGORIES : DOC_CATEGORIES;

  const UploadForm = () => (
    <div className="border rounded-xl p-5 bg-muted/20 space-y-4 animate-fade-in mb-4">
      <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
        {pendingFile && isImage(pendingFile.type) ? (
          <img src={URL.createObjectURL(pendingFile)} alt="" className="h-10 w-10 object-cover rounded" />
        ) : pendingFile && isVideo(pendingFile.type) ? (
          <div className="h-10 w-10 rounded bg-black flex items-center justify-center flex-shrink-0">
            <Play className="h-4 w-4 text-white" />
          </div>
        ) : (
          getDocIcon(pendingFile?.type || "")
        )}
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

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Categoria *</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">
          Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          placeholder="Ex: Avaliação postural frontal — semana 3"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      {uploading && (
        <div className="space-y-1">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">{progress}% enviado...</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={uploading}
          onClick={() => {
            setPendingFile(null);
            setShowForm(false);
          }}
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
              Guardar
            </>
          )}
        </Button>
      </div>
    </div>
  );

  /* ── DocCard ── */
  const DocCard = ({ doc }: { doc: PatientDocument }) => {
    const catInfo = getCategoryInfo(doc.category, isMediaFile(doc.file_type));
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors group">
        {getDocIcon(doc.file_type)}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{doc.file_name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge className={cn("text-[10px] px-1.5 py-0 h-4 border-0", catInfo.color)}>{catInfo.label}</Badge>
            <span className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(doc.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
          {doc.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.description}</p>}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {isMediaFile(doc.file_type) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handlePreview(doc)}
              title="Visualizar"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handleDownload(doc)}
            title="Descarregar"
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
            {deletingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  };

  /* ── PhotoGrid ── */
  const PhotoGrid = ({ photos }: { photos: PatientDocument[] }) => {
    const [thumbs, setThumbs] = useState<Record<string, string>>({});

    useEffect(() => {
      photos.forEach(async (p) => {
        if (thumbs[p.id]) return;
        const { data } = await supabase.storage.from("patient-documents").createSignedUrl(p.storage_path, 300);
        if (data) setThumbs((prev) => ({ ...prev, [p.id]: data.signedUrl }));
      });
    }, [photos]);

    if (photos.length === 0)
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Image className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma foto registada</p>
        </div>
      );

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((p) => {
          const catInfo = getCategoryInfo(p.category, true);
          return (
            <div
              key={p.id}
              className="group relative rounded-lg overflow-hidden border bg-muted aspect-square cursor-pointer"
              onClick={() => handlePreview(p)}
            >
              {thumbs[p.id] ? (
                <img
                  src={thumbs[p.id]}
                  alt={p.file_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex flex-col justify-between p-2">
                <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(p.id);
                    }}
                    className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Badge className={cn("text-[9px] px-1.5 py-0 h-4 border-0", catInfo.color)}>{catInfo.label}</Badge>
                  <p className="text-white text-[10px] mt-0.5">
                    {format(new Date(p.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── VideoList ── */
  const VideoList = ({ videos }: { videos: PatientDocument[] }) => {
    if (videos.length === 0)
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Video className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum vídeo registado</p>
        </div>
      );

    return (
      <div className="space-y-2">
        {videos.map((v) => {
          const catInfo = getCategoryInfo(v.category, true);
          return (
            <div
              key={v.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors group cursor-pointer"
              onClick={() => handlePreview(v)}
            >
              <div className="h-12 w-20 rounded bg-black flex items-center justify-center flex-shrink-0">
                <Play className="h-5 w-5 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{v.file_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge className={cn("text-[10px] px-1.5 py-0 h-4 border-0", catInfo.color)}>{catInfo.label}</Badge>
                  <span className="text-xs text-muted-foreground">{formatBytes(v.file_size)}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(v.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {v.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{v.description}</p>}
              </div>
              <div
                className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDownload(v)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(v.id)}
                  disabled={deletingId === v.id}
                >
                  {deletingId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-4">
      <input
        ref={docInputRef}
        type="file"
        className="hidden"
        accept={ACCEPTED_DOCS}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileSelect(f);
          e.target.value = "";
        }}
      />
      <input
        ref={mediaInputRef}
        type="file"
        className="hidden"
        accept={ACCEPTED_MEDIA}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileSelect(f);
          e.target.value = "";
        }}
      />

      {showForm && <UploadForm />}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="documentos" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Documentos
              {docList.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                  {docList.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="fotos" className="gap-1.5 text-xs">
              <Image className="h-3.5 w-3.5" />
              Fotos
              {photoList.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                  {photoList.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1.5 text-xs">
              <Video className="h-3.5 w-3.5" />
              Vídeos
              {videoList.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                  {videoList.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {!showForm && (
            <div className="flex items-center gap-2">
              {(activeTab === "fotos" || activeTab === "videos") && (
                <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setCameraOpen(true)}>
                  <Camera className="h-3.5 w-3.5" />
                  Câmara
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => {
                  if (activeTab === "fotos" || activeTab === "videos") mediaInputRef.current?.click();
                  else docInputRef.current?.click();
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                {activeTab === "fotos"
                  ? "Adicionar foto"
                  : activeTab === "videos"
                    ? "Adicionar vídeo"
                    : "Adicionar documento"}
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="documentos" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : docList.length === 0 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFileSelect(f);
              }}
              onClick={() => docInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
              )}
            >
              <FolderOpen className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">Arraste ou clique para adicionar</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, imagens · Máx. 20MB</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docList.map((d) => (
                <DocCard key={d.id} doc={d} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="fotos" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <PhotoGrid photos={photoList} />
          )}
        </TabsContent>

        <TabsContent value="videos" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <VideoList videos={videoList} />
          )}
        </TabsContent>
      </Tabs>

      <CameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={async (file) => {
          setCameraOpen(false);
          setUploading(true);
          try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) throw new Error("Não autenticado");
            const storagePath = `${clinicId}/${pacienteId}/${Date.now()}_${file.name}`;
            const { error: storageError } = await supabase.storage
              .from("patient-documents")
              .upload(storagePath, file, { contentType: file.type, upsert: false });
            if (storageError) throw storageError;
            const { error: dbError } = await (supabase as any).from("patient_documents").insert({
              clinic_id: clinicId,
              paciente_id: pacienteId,
              prontuario_id: prontuarioId,
              uploaded_by: userData.user.id,
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
              storage_path: storagePath,
              category: "evolucao_clinica",
              description: null,
            });
            if (dbError) {
              await supabase.storage.from("patient-documents").remove([storagePath]);
              throw dbError;
            }
            toast.success("Foto capturada e guardada!");
            await fetchDocuments();
          } catch (err: any) {
            toast.error("Erro ao guardar foto: " + (err.message || "Tente novamente"));
          } finally {
            setUploading(false);
          }
        }}
      />

      {previewUrl && previewFile && (
        <MediaPreview
          url={previewUrl}
          fileType={previewFile.file_type}
          fileName={previewFile.file_name}
          onClose={() => {
            setPreviewUrl(null);
            setPreviewFile(null);
          }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar ficheiro?</AlertDialogTitle>
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
