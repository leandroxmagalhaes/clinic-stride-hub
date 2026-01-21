import { Pencil, Trash2, MessageCircle, Mail, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AutomationFlow, AutomationService } from "@/services/AutomationService";

interface FlowCardProps {
  flow: AutomationFlow;
  onToggle: (id: string, isActive: boolean) => void;
  onEdit: (flow: AutomationFlow) => void;
  onDelete: (id: string) => void;
}

export function FlowCard({ flow, onToggle, onEdit, onDelete }: FlowCardProps) {
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageCircle className="h-3 w-3" />;
      case 'sms':
        return <Smartphone className="h-3 w-3" />;
      case 'email':
        return <Mail className="h-3 w-3" />;
      default:
        return <MessageCircle className="h-3 w-3" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'sms':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'email':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-foreground truncate">{flow.name}</h3>
              <Badge 
                variant={flow.is_active ? "default" : "secondary"}
                className={flow.is_active ? "bg-emerald-500 hover:bg-emerald-600" : ""}
              >
                {flow.is_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              {AutomationService.getTriggerLabel(flow.trigger_type)}
            </p>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${getChannelColor(flow.channel)} border-0`}>
                {getChannelIcon(flow.channel)}
                <span className="ml-1 capitalize">{flow.channel}</span>
              </Badge>
            </div>

            {flow.message_template && (
              <p className="mt-3 text-xs text-muted-foreground line-clamp-2 bg-muted/50 rounded p-2">
                {flow.message_template}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-3">
            <Switch
              checked={flow.is_active}
              onCheckedChange={(checked) => onToggle(flow.id, checked)}
            />

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(flow)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(flow.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
