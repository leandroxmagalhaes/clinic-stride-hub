import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

type ProfileType = "baby" | "child" | "adult" | "elderly";

interface DiaryNewEntryFormProps {
  perfilTipo: ProfileType;
  patientName: string;
  onSubmit: (data: {
    humor: string;
    categoria: string;
    texto: string;
    nivel_dor: number | null;
    foto_file: File | null;
  }) => Promise<void>;
  isSubmitting: boolean;
  onCancel: () => void;
}

const MOODS = [
  { key: "great", emoji: "😄", label: "Muito bem" },
  { key: "good", emoji: "🙂", label: "Bem" },
  { key: "neutral", emoji: "😐", label: "Normal" },
  { key: "bad", emoji: "😟", label: "Mal" },
  { key: "terrible", emoji: "😢", label: "Muito mal" },
];

const CATEGORIES_BY_PROFILE: Record<ProfileType, { key: string; emoji: string; label: string }[]> = {
  baby: [
    { key: "improvement", emoji: "📈", label: "Melhora" },
    { key: "worsening", emoji: "📉", label: "Piora" },
    { key: "milestone", emoji: "⭐", label: "Marco" },
    { key: "observation", emoji: "👀", label: "Observação" },
  ],
  child: [
    { key: "improvement", emoji: "📈", label: "Melhora" },
    { key: "worsening", emoji: "📉", label: "Piora" },
    { key: "running", emoji: "🏃", label: "Exercícios" },
    { key: "school", emoji: "🎒", label: "Escola" },
    { key: "observation", emoji: "👀", label: "Observação" },
  ],
  adult: [
    { key: "improvement", emoji: "📈", label: "Melhora" },
    { key: "worsening", emoji: "📉", label: "Piora" },
    { key: "pain", emoji: "🔥", label: "Dor" },
    { key: "exercise", emoji: "💪", label: "Exercícios" },
    { key: "observation", emoji: "👀", label: "Observação" },
  ],
  elderly: [
    { key: "improvement", emoji: "📈", label: "Melhora" },
    { key: "worsening", emoji: "📉", label: "Piora" },
    { key: "pain", emoji: "🔥", label: "Dor" },
    { key: "fall", emoji: "⚡", label: "Queda" },
    { key: "gait", emoji: "🚶", label: "Marcha" },
    { key: "observation", emoji: "👀", label: "Observação" },
  ],
};

const PLACEHOLDER_BY_PROFILE: Record<ProfileType, string> = {
  baby: "Descreva o que observou hoje... (movimentos, alimentação, sono, marcos...)",
  child: "Como correu o dia... (exercícios, escola, coordenação...)",
  adult: "Como se sentiu hoje... (dor, mobilidade, exercícios...)",
  elderly: "Como correu o dia... (equilíbrio, marcha, quedas, disposição...)",
};

const QUESTION_BY_PROFILE = (name: string, perfil: ProfileType) => {
  const firstName = name.split(" ")[0];
  if (perfil === "adult") return "Como se sente hoje?";
  return `Como está o/a ${firstName} hoje?`;
};

export function DiaryNewEntryForm({ perfilTipo, patientName, onSubmit, isSubmitting, onCancel }: DiaryNewEntryFormProps) {
  const [humor, setHumor] = useState("");
  const [categoria, setCategoria] = useState("observation");
  const [texto, setTexto] = useState("");
  const [nivelDor, setNivelDor] = useState<number | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  const showPainScale = perfilTipo === "adult" || perfilTipo === "elderly";
  const categories = CATEGORIES_BY_PROFILE[perfilTipo] || CATEGORIES_BY_PROFILE.adult;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim() || !humor) return;
    await onSubmit({ humor, categoria, texto: texto.trim(), nivel_dor: nivelDor, foto_file: fotoFile });
  };

  return (
    <Card className="shadow-lg border-2">
      <CardHeader className="pb-3 text-center">
        <CardTitle className="text-xl font-display">
          {QUESTION_BY_PROFILE(patientName, perfilTipo)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mood */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Como se sente?</Label>
            <div className="flex justify-center gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setHumor(m.key)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-xl transition-all border-2",
                    humor === m.key
                      ? "border-primary bg-primary/10 scale-110"
                      : "border-transparent hover:bg-muted"
                  )}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pain Scale */}
          {showPainScale && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nível de dor (opcional)</Label>
              <div className="flex gap-1 justify-center flex-wrap">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNivelDor(nivelDor === n ? null : n)}
                    className={cn(
                      "h-9 w-9 rounded-lg text-sm font-bold transition-all border-2",
                      nivelDor === n ? "scale-110 ring-2 ring-offset-1" : "",
                      n <= 3
                        ? nivelDor === n ? "bg-green-500 text-white border-green-600 ring-green-400" : "bg-green-100 text-green-800 border-green-200 hover:bg-green-200"
                        : n <= 6
                        ? nivelDor === n ? "bg-yellow-500 text-white border-yellow-600 ring-yellow-400" : "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200"
                        : nivelDor === n ? "bg-red-500 text-white border-red-600 ring-red-400" : "bg-red-100 text-red-800 border-red-200 hover:bg-red-200"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>Sem dor</span>
                <span>Dor máxima</span>
              </div>
            </div>
          )}

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Categoria</Label>
            <div className="flex flex-wrap gap-2 justify-center">
              {categories.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategoria(c.key)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm transition-all border-2",
                    categoria === c.key
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-muted hover:border-primary/30 hover:bg-muted"
                  )}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Descrição *</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={PLACEHOLDER_BY_PROFILE[perfilTipo]}
              className="min-h-[100px] text-sm resize-none"
              maxLength={2000}
              required
            />
            <p className="text-[10px] text-muted-foreground text-right">{texto.length}/2000</p>
          </div>

          {/* Photo upload */}
          <div>
            <Label
              htmlFor="diary-photo"
              className={cn(
                "flex items-center gap-2 cursor-pointer text-sm px-4 py-2.5 rounded-lg border-2 border-dashed transition-colors",
                fotoFile ? "border-primary bg-primary/5" : "border-muted hover:border-primary/30"
              )}
            >
              <Camera className="h-4 w-4" />
              {fotoFile ? fotoFile.name : "📷 Adicionar foto ou vídeo"}
            </Label>
            <input
              id="diary-photo"
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1 h-12 font-semibold"
              disabled={isSubmitting || !texto.trim() || !humor}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Guardar</>
              )}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} className="h-12">
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
