import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Plus, ClipboardList, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { FullQuestionnaireView } from "@/components/patient-portal/FullQuestionnaireView";
import {
  QuestionnaireTemplateService,
  type QuestionnaireTemplate,
} from "@/services/QuestionnaireTemplateService";

interface Props {
  pacienteId: string;
  birthDate?: string | null;
}

interface QuestionarioRow {
  id: string;
  template_id: string | null;
  perfil_tipo: string | null;
  completo: boolean | null;
  updated_at: string | null;
  created_at: string | null;
}

/**
 * Multi-anamnese view: shows a selector when the patient has one or more filled
 * questionnaires (one per template) and lets the professional add another
 * questionnaire from a different model without erasing the existing ones.
 *
 * Backward compat: patients that still have exactly one questionnaire continue
 * to see the same experience — the selector just lists that single entry.
 */
export function QuestionnaireHealthSummary({ pacienteId, birthDate }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [questionarios, setQuestionarios] = useState<QuestionarioRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<QuestionnaireTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [chosenTemplateId, setChosenTemplateId] = useState<string>("");
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false);
  const [addingAnother, setAddingAnother] = useState(false);
  const [professionalName, setProfessionalName] = useState("Profissional");
  const [canEditDynamic, setCanEditDynamic] = useState(false);

  const loadQuestionarios = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("portal_questionario")
        .select("id, template_id, perfil_tipo, completo, updated_at, created_at")
        .eq("paciente_id", pacienteId)
        .order("updated_at", { ascending: false });
      const rows: QuestionarioRow[] = data || [];
      setQuestionarios(rows);
      // Keep current selection if still present, otherwise pick the most recent.
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (err) {
      console.error("Failed to load questionarios list", err);
      setQuestionarios([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    void loadQuestionarios();
  }, [loadQuestionarios]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (p?.full_name) setProfessionalName(p.full_name);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roleSet = new Set((roles || []).map((r: any) => r.role));
      const isAdmin = roleSet.has("admin");
      const isProfessional = roleSet.has("professional");
      const isSecretary = roleSet.has("secretary");
      setCanEditDynamic((isAdmin || isProfessional) && !isSecretary);
    })();
  }, [user, pacienteId]);

  const loadTemplates = useCallback(async () => {
    if (templatesLoaded) return;
    setTemplatesLoading(true);
    try {
      const list = await QuestionnaireTemplateService.list();
      setTemplates(list);
      setTemplatesLoaded(true);
    } catch (e) {
      console.warn("Failed to load templates", e);
      toast.error("Erro ao carregar modelos de questionário");
    } finally {
      setTemplatesLoading(false);
    }
  }, [templatesLoaded]);

  const templateById = (id: string | null | undefined) =>
    id ? templates.find((t) => t.id === id) || null : null;

  const templateLabel = (row: QuestionarioRow): string => {
    const t = templateById(row.template_id);
    if (t?.name) return t.name;
    // Legacy row without template_id — show a stable fallback.
    if (row.perfil_tipo) return `Questionário (${row.perfil_tipo})`;
    return "Questionário de saúde";
  };

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("pt-PT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";

  // Load templates lazily whenever we might need to render labels or the picker.
  useEffect(() => {
    if (questionarios.length > 0 && !templatesLoaded) {
      void loadTemplates();
    }
  }, [questionarios, templatesLoaded, loadTemplates]);

  const suggestedInitialTemplateId = useCallback(async (): Promise<string | null> => {
    // Prefer the most recent portal invite template, otherwise age-based suggestion.
    try {
      const { data: inv } = await (supabase as any)
        .from("portal_convites")
        .select("template_id")
        .eq("paciente_id", pacienteId)
        .not("template_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (inv?.template_id && templates.some((t) => t.id === inv.template_id)) {
        return inv.template_id;
      }
    } catch {
      /* ignore */
    }
    const suggested = QuestionnaireTemplateService.suggestIdentifierByAge(birthDate);
    const match =
      templates.find((t) => t.identifier === suggested) || templates[0];
    return match?.id ?? null;
  }, [pacienteId, templates, birthDate]);

  const openInitialPicker = useCallback(async () => {
    await loadTemplates();
    const initial = await suggestedInitialTemplateId();
    if (initial) setChosenTemplateId(initial);
  }, [loadTemplates, suggestedInitialTemplateId]);

  const openAddAnother = useCallback(async () => {
    await loadTemplates();
    setChosenTemplateId("");
    setAddingAnother(true);
  }, [loadTemplates]);

  // Templates the patient does NOT yet have (used by "Adicionar outra anamnese").
  const usedTemplateIds = new Set(
    questionarios.map((q) => q.template_id).filter(Boolean) as string[]
  );
  const availableTemplates = templates.filter((t) => !usedTemplateIds.has(t.id));

  const createQuestionarioFromTemplate = async (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setCreatingFromTemplate(true);
    try {
      const { data: created, error } = await (supabase as any)
        .from("portal_questionario")
        .insert({
          paciente_id: pacienteId,
          template_id: tpl.id,
          perfil_tipo: tpl.identifier,
          respostas: {},
          completo: false,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      const newId: string | null = created?.id ?? null;
      await loadQuestionarios();
      if (newId) setSelectedId(newId);
      setAddingAnother(false);
      setChosenTemplateId("");
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "";
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
        toast.error("Este utente já tem uma anamnese deste modelo.");
      } else {
        toast.error("Erro ao iniciar questionário: " + (msg || "desconhecido"));
      }
    } finally {
      setCreatingFromTemplate(false);
    }
  };

  if (loading) return <Skeleton className="h-24 w-full" />;

  // ─────────────────────────────────────────────────────────────────────────
  // No questionnaires yet — original "pick a template and start" flow.
  // ─────────────────────────────────────────────────────────────────────────
  if (questionarios.length === 0) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="py-6 space-y-4">
          <div className="text-center space-y-2">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              O utente ainda não preencheu nenhum questionário de saúde.
            </p>
            <p className="text-xs text-muted-foreground">
              Selecione qual modelo pretende preencher manualmente:
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <Select
              value={chosenTemplateId || "__none__"}
              onValueChange={(v) =>
                setChosenTemplateId(v === "__none__" ? "" : v)
              }
              onOpenChange={(open) => {
                if (open) void openInitialPicker();
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue
                  placeholder={
                    templatesLoading
                      ? "A carregar modelos..."
                      : "Escolher modelo de questionário"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 && !templatesLoading && (
                  <SelectItem value="__none__" disabled>
                    Sem modelos disponíveis
                  </SelectItem>
                )}
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                      {t.name}
                      {t.is_system && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          sistema
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {chosenTemplateId &&
              (() => {
                const tpl = templates.find((t) => t.id === chosenTemplateId);
                if (!tpl) return null;
                return (
                  <p className="text-xs text-muted-foreground">
                    {tpl.description || "Modelo dinâmico"}
                    {tpl.estimated_minutes
                      ? ` · ~${tpl.estimated_minutes} min`
                      : ""}
                  </p>
                );
              })()}

            <div className="flex justify-center pt-1">
              <Button
                size="sm"
                onClick={() =>
                  chosenTemplateId &&
                  createQuestionarioFromTemplate(chosenTemplateId)
                }
                disabled={
                  !chosenTemplateId ||
                  creatingFromTemplate ||
                  !canEditDynamic
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                {creatingFromTemplate ? "A iniciar..." : "Preencher manualmente"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // One or more questionnaires — selector + FullQuestionnaireView of the
  // selected one + "Adicionar outra anamnese".
  // ─────────────────────────────────────────────────────────────────────────
  const selected = questionarios.find((q) => q.id === selectedId) || questionarios[0];

  return (
    <div className="space-y-3">
      {/* Selector */}
      <div className="flex flex-wrap items-center gap-2">
        {questionarios.length > 1 ? (
          <>
            <p className="text-xs text-muted-foreground">Anamnese:</p>
            <div className="flex flex-wrap gap-1.5">
              {questionarios.map((q) => {
                const active = q.id === selected.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setSelectedId(q.id)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                      active
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    <span className="font-medium">{templateLabel(q)}</span>
                    <span className="ml-1.5 text-[10px] opacity-70">
                      · {formatDate(q.updated_at)}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{templateLabel(selected)}</span>
            <span className="ml-1 opacity-70">
              · atualizado em {formatDate(selected.updated_at)}
            </span>
          </p>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {canEditDynamic && !addingAnother && (
            <Button
              variant="outline"
              size="sm"
              onClick={openAddAnother}
              disabled={templatesLoading}
              className="h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar outra anamnese
            </Button>
          )}
        </div>
      </div>

      {/* "Adicionar outra anamnese" inline picker */}
      {addingAnother && (
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Escolha o modelo para a nova anamnese</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAddingAnother(false);
                  setChosenTemplateId("");
                }}
                className="h-8 w-8 p-0"
                aria-label="Cancelar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {availableTemplates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {templatesLoading
                  ? "A carregar modelos..."
                  : "Este utente já tem uma anamnese de todos os modelos disponíveis."}
              </p>
            ) : (
              <div className="space-y-2 max-w-md">
                <Select
                  value={chosenTemplateId || "__none__"}
                  onValueChange={(v) =>
                    setChosenTemplateId(v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Escolher modelo de questionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                          {t.name}
                          {t.is_system && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                            >
                              sistema
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {chosenTemplateId &&
                  (() => {
                    const tpl = availableTemplates.find(
                      (t) => t.id === chosenTemplateId
                    );
                    if (!tpl) return null;
                    return (
                      <p className="text-xs text-muted-foreground">
                        {tpl.description || "Modelo dinâmico"}
                        {tpl.estimated_minutes
                          ? ` · ~${tpl.estimated_minutes} min`
                          : ""}
                      </p>
                    );
                  })()}

                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={() =>
                      chosenTemplateId &&
                      createQuestionarioFromTemplate(chosenTemplateId)
                    }
                    disabled={!chosenTemplateId || creatingFromTemplate}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {creatingFromTemplate ? "A iniciar..." : "Adicionar"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Selected questionnaire */}
      <FullQuestionnaireView
        key={selected.id}
        pacienteId={pacienteId}
        questionarioId={selected.id}
        alteradoPor={professionalName}
        authorRole="profissional"
        canEdit={canEditDynamic}
        title="Resumo de Saúde"
        onDeleted={() => {
          // Refresh the list; selector will auto-pick another (or return to picker).
          void loadQuestionarios();
        }}
      />
    </div>
  );
}
