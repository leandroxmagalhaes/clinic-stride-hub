import { cn } from "@/lib/utils";
import { HealthTag, HealthTagService, HEALTH_TAG_CONFIG } from "@/services/HealthTagService";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HealthTagBadgeProps {
  tag: HealthTag;
  showTooltip?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function HealthTagBadge({ 
  tag, 
  showTooltip = true, 
  className,
  size = 'md' 
}: HealthTagBadgeProps) {
  const config = HEALTH_TAG_CONFIG[tag];
  if (!config) return null;

  const style = HealthTagService.getTagBadgeStyle(tag);

  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium border-0 transition-colors",
        size === 'sm' ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5",
        className
      )}
      style={{
        backgroundColor: style.backgroundColor,
        color: style.color,
      }}
    >
      {config.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="text-xs">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface HealthTagListProps {
  tags: HealthTag[];
  maxVisible?: number;
  showTooltip?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function HealthTagList({ 
  tags, 
  maxVisible = 3, 
  showTooltip = true,
  size = 'md',
  className 
}: HealthTagListProps) {
  if (!tags || tags.length === 0) return null;

  const sortedTags = HealthTagService.sortTagsByPriority(tags);
  const visibleTags = sortedTags.slice(0, maxVisible);
  const hiddenCount = sortedTags.length - maxVisible;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {visibleTags.map((tag) => (
        <HealthTagBadge key={tag} tag={tag} showTooltip={showTooltip} size={size} />
      ))}
      {hiddenCount > 0 && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className={cn(
                  "font-medium bg-muted text-muted-foreground",
                  size === 'sm' ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"
                )}
              >
                +{hiddenCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <div className="flex flex-wrap gap-1">
                {sortedTags.slice(maxVisible).map((tag) => (
                  <HealthTagBadge key={tag} tag={tag} showTooltip={false} size="sm" />
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
