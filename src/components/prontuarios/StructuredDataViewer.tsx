// StructuredDataViewer - Displays structured evolution data in a readable format
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SpecialtyService, type SectionSchema, type StructuredData } from "@/services/SpecialtyService";

interface StructuredDataViewerProps {
  schema: SectionSchema[];
  data: StructuredData;
  specialtyName?: string;
  compact?: boolean;
}

export function StructuredDataViewer({
  schema,
  data,
  specialtyName,
  compact = false,
}: StructuredDataViewerProps) {
  const formattedData = SpecialtyService.formatStructuredDataForDisplay(schema, data);

  if (formattedData.length === 0) {
    return null;
  }

  if (compact) {
    // Compact view: inline format for evolution list
    return (
      <div className="space-y-2">
        {specialtyName && (
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
            {specialtyName}
          </Badge>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {formattedData.flatMap((section) =>
            section.items.map((item, idx) => (
              <span key={`${section.section}-${idx}`} className="text-muted-foreground">
                <span className="font-medium text-foreground">{item.label}:</span>{" "}
                {item.value}
              </span>
            ))
          )}
        </div>
      </div>
    );
  }

  // Full view: organized by sections
  return (
    <div className="space-y-4">
      {specialtyName && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {specialtyName}
          </Badge>
          <span className="text-xs text-muted-foreground">Avaliação Especializada</span>
        </div>
      )}

      {formattedData.map((section, sectionIdx) => (
        <div key={sectionIdx}>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {section.section}
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {section.items.map((item, itemIdx) => (
              <div
                key={itemIdx}
                className="flex items-start gap-2 text-sm bg-muted/30 rounded-md px-3 py-2"
              >
                <span className="text-muted-foreground whitespace-nowrap">
                  {item.label}:
                </span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
          {sectionIdx < formattedData.length - 1 && (
            <Separator className="mt-3" />
          )}
        </div>
      ))}
    </div>
  );
}
