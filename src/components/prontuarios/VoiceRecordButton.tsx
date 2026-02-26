import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Extend Window for webkitSpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

type VoiceStatus = "idle" | "recording" | "transcribing" | "structuring";

interface VoiceRecordButtonProps {
  onTranscriptionComplete: (rawText: string) => void;
  onStructuringStart: () => void;
  disabled?: boolean;
}

export function VoiceRecordButton({
  onTranscriptionComplete,
  onStructuringStart,
  disabled = false,
}: VoiceRecordButtonProps) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startRecording = useCallback(() => {
    if (!isSupported) {
      toast.error("Reconhecimento de voz não suportado neste navegador");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;

    finalTranscriptRef.current = "";
    setInterimText("");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      if (final) {
        finalTranscriptRef.current += final;
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "aborted") {
        toast.error("Erro no reconhecimento de voz");
      }
      setStatus("idle");
      setInterimText("");
    };

    recognition.onend = () => {
      const text = finalTranscriptRef.current.trim();
      if (text) {
        setStatus("structuring");
        onStructuringStart();
        onTranscriptionComplete(text);
      } else {
        setStatus("idle");
        toast.info("Nenhum áudio detectado. Tente novamente.");
      }
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setStatus("recording");
  }, [isSupported, onTranscriptionComplete, onStructuringStart]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setStatus("transcribing");
    }
  }, []);

  const handleClick = () => {
    if (status === "recording") {
      stopRecording();
    } else if (status === "idle") {
      startRecording();
    }
  };

  // Reset to idle (called externally after structuring completes)
  const resetStatus = useCallback(() => {
    setStatus("idle");
  }, []);

  // Expose reset via a data attribute trick or just let parent manage
  // Actually let's use an imperative handle pattern - but simpler: just expose via prop
  // We'll reset in the parent after AI response

  if (!isSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled
              className="h-8 w-8 text-muted-foreground"
            >
              <MicOff className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reconhecimento de voz não suportado neste navegador</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const getButtonContent = () => {
    switch (status) {
      case "recording":
        return <Square className="h-4 w-4" />;
      case "transcribing":
      case "structuring":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      default:
        return <Mic className="h-4 w-4" />;
    }
  };

  const getTooltipText = () => {
    switch (status) {
      case "recording":
        return "Clique para parar a gravação";
      case "transcribing":
        return "A transcrever...";
      case "structuring":
        return "A estruturar com IA...";
      default:
        return "Ditar evolução por voz";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={status === "recording" ? "destructive" : "ghost"}
              size="icon"
              onClick={handleClick}
              disabled={disabled || status === "transcribing" || status === "structuring"}
              className={cn(
                "h-8 w-8 transition-all",
                status === "recording" && "animate-pulse shadow-lg"
              )}
            >
              {getButtonContent()}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipText()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {status === "recording" && interimText && (
        <span className="text-xs text-muted-foreground italic max-w-[200px] truncate">
          {interimText}
        </span>
      )}
      {status === "recording" && (
        <span className="flex items-center gap-1 text-xs text-destructive font-medium">
          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          A gravar...
        </span>
      )}
    </div>
  );
}
