import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Palette, Save, ImageIcon, Check, Sun, Moon, Monitor, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  appearanceSettingsSchema,
  type AppearanceSettingsFormData,
  type ClinicSettings,
} from '@/types/settings';
import {
  PREMIUM_COLORS,
  PREMIUM_FAMILIES,
  applyPrimaryColor,
  applyThemeMode,
  applyGradients,
  getStoredMode,
  getStoredGradient,
  type ThemeMode,
} from '@/lib/theme';

interface AppearanceSettingsFormProps {
  settings: ClinicSettings | null | undefined;
  isLoading: boolean;
  isSaving: boolean;
  onSave: (data: AppearanceSettingsFormData) => void;
}

export function AppearanceSettingsForm({
  settings,
  isLoading,
  isSaving,
  onSave,
}: AppearanceSettingsFormProps) {
  const [customColor, setCustomColor] = useState(false);
  const [mode, setMode] = useState<ThemeMode>(getStoredMode());
  const [gradients, setGradients] = useState<boolean>(getStoredGradient());

  const form = useForm<AppearanceSettingsFormData>({
    resolver: zodResolver(appearanceSettingsSchema),
    defaultValues: {
      logo_url: '',
      primary_color: '#2563eb',
    },
  });

  const watchedColor = form.watch('primary_color');

  // Live preview as user picks colors
  useEffect(() => {
    if (watchedColor && /^#[0-9a-fA-F]{6}$/.test(watchedColor)) {
      applyPrimaryColor(watchedColor);
    }
  }, [watchedColor]);

  useEffect(() => {
    if (settings) {
      form.reset({
        logo_url: settings.logo_url || '',
        primary_color: settings.primary_color || '#2563eb',
      });
      const isPreset = PREMIUM_COLORS.some(p => p.hex.toLowerCase() === (settings.primary_color || '').toLowerCase());
      setCustomColor(!isPreset);
    }
  }, [settings, form]);

  const handleMode = (m: ThemeMode) => {
    setMode(m);
    applyThemeMode(m);
  };
  const handleGradients = (v: boolean) => {
    setGradients(v);
    applyGradients(v);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Aparência & Branding
          </CardTitle>
          <CardDescription>
            Personalize a identidade visual do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
              <FormField
                control={form.control}
                name="logo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      URL do Logotipo
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://exemplo.com/logo.png" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormDescription>Recomendado: 200x50px</FormDescription>
                    <FormMessage />
                    {field.value && (
                      <div className="mt-2 p-4 border rounded-lg bg-muted/50">
                        <img src={field.value} alt="Logo preview" className="max-h-12 object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      </div>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="primary_color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor Principal</FormLabel>

                    <div className="space-y-5 mt-2">
                      {PREMIUM_FAMILIES.map((family) => (
                        <div key={family}>
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{family}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {PREMIUM_COLORS.filter(c => c.family === family).map((preset) => {
                              const selected = field.value?.toLowerCase() === preset.hex.toLowerCase();
                              return (
                                <button
                                  key={preset.hex}
                                  type="button"
                                  onClick={() => { field.onChange(preset.hex); setCustomColor(false); }}
                                  className={cn(
                                    "group relative rounded-xl border-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
                                    selected ? "border-foreground shadow-md" : "border-border"
                                  )}
                                >
                                  <div
                                    className="h-10 w-full rounded-md mb-2 shadow-sm"
                                    style={{ backgroundImage: `linear-gradient(135deg, ${preset.light}, ${preset.dark})` }}
                                  />
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-medium truncate">{preset.name}</span>
                                    {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground font-mono">{preset.hex}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <Button type="button" variant={customColor ? "default" : "outline"} size="sm"
                        onClick={() => setCustomColor(!customColor)}>
                        Cor personalizada
                      </Button>
                      {customColor && (
                        <div className="flex items-center gap-2">
                          <input type="color" value={watchedColor}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="w-10 h-10 rounded cursor-pointer border-0" />
                          <FormControl>
                            <Input {...field} placeholder="#2563eb" className="w-28 font-mono" />
                          </FormControl>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 p-4 border rounded-lg space-y-2">
                      <p className="text-xs text-muted-foreground">Preview em tempo real:</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Button type="button" size="sm">Botão primário</Button>
                        <span className="text-sm font-medium underline" style={{ color: watchedColor }}>Link exemplo</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium text-primary-foreground bg-primary">Badge</span>
                      </div>
                    </div>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSaving || !form.formState.isDirty} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Modo & Efeitos
          </CardTitle>
          <CardDescription>
            Estas preferências são guardadas neste dispositivo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-2 block">Modo de visualização</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'light', label: 'Claro', Icon: Sun },
                { v: 'dark', label: 'Escuro', Icon: Moon },
                { v: 'system', label: 'Automático', Icon: Monitor },
              ] as const).map(({ v, label, Icon }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleMode(v)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all",
                    mode === v ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Gradientes subtis
              </Label>
              <p className="text-xs text-muted-foreground">
                Aplica um leve degradê nos botões primários para um aspecto mais refinado.
              </p>
            </div>
            <Switch checked={gradients} onCheckedChange={handleGradients} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
