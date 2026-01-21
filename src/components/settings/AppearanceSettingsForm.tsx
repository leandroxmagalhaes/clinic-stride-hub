import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Palette, Save, ImageIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  appearanceSettingsSchema, 
  type AppearanceSettingsFormData,
  type ClinicSettings,
  BRAND_COLOR_PRESETS,
} from '@/types/settings';

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

  const form = useForm<AppearanceSettingsFormData>({
    resolver: zodResolver(appearanceSettingsSchema),
    defaultValues: {
      logo_url: '',
      primary_color: '#10B981',
    },
  });

  const watchedColor = form.watch('primary_color');

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      form.reset({
        logo_url: settings.logo_url || '',
        primary_color: settings.primary_color || '#10B981',
      });
      
      // Check if color is a preset or custom
      const isPreset = BRAND_COLOR_PRESETS.some(p => p.value === settings.primary_color);
      setCustomColor(!isPreset);
    }
  }, [settings, form]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
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
                    <Input 
                      placeholder="https://exemplo.com/logo.png" 
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Imagem que aparece no topo do sistema (recomendado: 200x50px)
                  </FormDescription>
                  <FormMessage />
                  
                  {/* Logo preview */}
                  {field.value && (
                    <div className="mt-2 p-4 border rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                      <img 
                        src={field.value} 
                        alt="Logo preview" 
                        className="max-h-12 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
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
                  
                  {/* Preset colors grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
                    {BRAND_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => {
                          field.onChange(preset.value);
                          setCustomColor(false);
                        }}
                        className={cn(
                          "w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center",
                          field.value === preset.value 
                            ? "border-foreground scale-110 shadow-lg" 
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: preset.value }}
                        title={preset.label}
                      >
                        {field.value === preset.value && (
                          <Check className="h-5 w-5 text-white drop-shadow-md" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Custom color toggle */}
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant={customColor ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCustomColor(!customColor)}
                    >
                      Cor personalizada
                    </Button>
                    
                    {customColor && (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={watchedColor}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="w-10 h-10 rounded cursor-pointer border-0"
                        />
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="#10B981"
                            className="w-28 font-mono"
                          />
                        </FormControl>
                      </div>
                    )}
                  </div>

                  <FormDescription>
                    Esta cor será usada em botões, links e destaques
                  </FormDescription>
                  <FormMessage />

                  {/* Color preview */}
                  <div className="mt-3 p-4 border rounded-lg space-y-2">
                    <p className="text-xs text-muted-foreground">Preview da cor:</p>
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-20 h-8 rounded-md shadow-sm" 
                        style={{ backgroundColor: watchedColor }}
                      />
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-md text-white text-sm font-medium"
                        style={{ backgroundColor: watchedColor }}
                      >
                        Botão exemplo
                      </button>
                      <span 
                        className="text-sm font-medium underline"
                        style={{ color: watchedColor }}
                      >
                        Link exemplo
                      </span>
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={isSaving || !form.formState.isDirty}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
