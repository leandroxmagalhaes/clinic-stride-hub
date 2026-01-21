// DynamicFormRenderer - Renders form fields dynamically based on specialty template schema
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SectionSchema, StructuredData } from "@/services/SpecialtyService";

interface DynamicFormRendererProps {
  schema: SectionSchema[];
  value: StructuredData;
  onChange: (data: StructuredData) => void;
  disabled?: boolean;
}

export function DynamicFormRenderer({
  schema,
  value,
  onChange,
  disabled = false,
}: DynamicFormRendererProps) {
  const updateField = (key: string, fieldValue: string | number | string[] | null) => {
    onChange({ ...value, [key]: fieldValue });
  };

  const toggleTag = (key: string, option: string) => {
    const current = (value[key] as string[]) || [];
    const updated = current.includes(option)
      ? current.filter((t) => t !== option)
      : [...current, option];
    updateField(key, updated);
  };

  const toggleMultiselect = (key: string, option: string, checked: boolean) => {
    const current = (value[key] as string[]) || [];
    const updated = checked
      ? [...current, option]
      : current.filter((t) => t !== option);
    updateField(key, updated);
  };

  if (!schema || schema.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {schema.map((section, sectionIndex) => (
        <div key={sectionIndex} className="space-y-4">
          {/* Section Header */}
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-primary" />
            <h4 className="font-medium text-sm text-foreground">
              {section.section}
            </h4>
          </div>

          {/* Section Fields */}
          <div className="space-y-4 pl-3 border-l-2 border-muted">
            {section.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">
                  {field.label}
                </Label>

                {/* Select Field */}
                {field.type === "select" && field.options && (
                  <Select
                    value={(value[field.key] as string) || ""}
                    onValueChange={(v) => updateField(field.key, v)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Range/Slider Field */}
                {field.type === "range" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {field.min ?? 0}
                      </span>
                      <span className="font-semibold text-primary">
                        {value[field.key] ?? field.min ?? 0}/{field.max ?? 10}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {field.max ?? 10}
                      </span>
                    </div>
                    <Slider
                      value={[Number(value[field.key] ?? field.min ?? 0)]}
                      onValueChange={([v]) => updateField(field.key, v)}
                      min={field.min ?? 0}
                      max={field.max ?? 10}
                      step={1}
                      disabled={disabled}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Tags Field (single or multi-select as chips) */}
                {field.type === "tags" && field.options && (
                  <div className="flex flex-wrap gap-2">
                    {field.options.map((option) => {
                      const isSelected = ((value[field.key] as string[]) || []).includes(option);
                      return (
                        <Badge
                          key={option}
                          variant={isSelected ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer transition-all hover:scale-105",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-primary/10",
                            disabled && "opacity-50 cursor-not-allowed"
                          )}
                          onClick={() => !disabled && toggleTag(field.key, option)}
                        >
                          {option}
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* Multiselect Field (checkboxes) */}
                {field.type === "multiselect" && field.options && (
                  <div className="grid grid-cols-2 gap-2">
                    {field.options.map((option) => {
                      const isChecked = ((value[field.key] as string[]) || []).includes(option);
                      return (
                        <div key={option} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${field.key}-${option}`}
                            checked={isChecked}
                            onCheckedChange={(checked) =>
                              toggleMultiselect(field.key, option, !!checked)
                            }
                            disabled={disabled}
                          />
                          <label
                            htmlFor={`${field.key}-${option}`}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {option}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
