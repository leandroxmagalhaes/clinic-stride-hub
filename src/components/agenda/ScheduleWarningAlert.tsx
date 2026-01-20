import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScheduleWarning } from "@/services/HealthTagService";
import { cn } from "@/lib/utils";

interface ScheduleWarningAlertProps {
  warnings: ScheduleWarning[];
  className?: string;
}

export function ScheduleWarningAlert({ warnings, className }: ScheduleWarningAlertProps) {
  if (!warnings || warnings.length === 0) return null;

  const getIcon = (severity: ScheduleWarning['severity']) => {
    switch (severity) {
      case 'high':
        return AlertCircle;
      case 'medium':
        return AlertTriangle;
      default:
        return Info;
    }
  };

  const getAlertVariant = (severity: ScheduleWarning['severity']) => {
    switch (severity) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      default:
        return 'default';
    }
  };

  const getAlertStyles = (severity: ScheduleWarning['severity']) => {
    switch (severity) {
      case 'high':
        return 'border-destructive/50 bg-destructive/10 text-destructive';
      case 'medium':
        return 'border-amber-500/50 bg-amber-500/10 text-amber-700';
      default:
        return 'border-blue-500/50 bg-blue-500/10 text-blue-700';
    }
  };

  // Group by severity
  const highPriority = warnings.filter(w => w.severity === 'high');
  const mediumPriority = warnings.filter(w => w.severity === 'medium');
  const lowPriority = warnings.filter(w => w.severity === 'low');

  const renderWarningGroup = (warningList: ScheduleWarning[]) => {
    if (warningList.length === 0) return null;

    const severity = warningList[0].severity;
    const Icon = getIcon(severity);

    return (
      <Alert 
        key={severity}
        className={cn(
          "py-2 px-3",
          getAlertStyles(severity)
        )}
      >
        <div className="flex items-start gap-2">
          <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <AlertDescription className="text-xs">
            <ul className="space-y-0.5">
              {warningList.map((warning, index) => (
                <li key={`${warning.tag}-${index}`}>
                  {warning.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </div>
      </Alert>
    );
  };

  return (
    <div className={cn("space-y-2", className)}>
      {renderWarningGroup(highPriority)}
      {renderWarningGroup(mediumPriority)}
      {renderWarningGroup(lowPriority)}
    </div>
  );
}
