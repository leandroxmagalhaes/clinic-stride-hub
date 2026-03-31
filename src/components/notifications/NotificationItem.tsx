import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cake, AlertTriangle, FileText, Calendar, UserX, UserPlus, BookOpen, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { AppNotification, NotificationType } from '@/services/NotificationService';

interface NotificationItemProps {
  notification: AppNotification;
  onClose: () => void;
  onMarkAsRead?: (id: string) => void;
}

const iconMap: Record<NotificationType, React.ElementType> = {
  birthday: Cake,
  report_expired: AlertTriangle,
  report_expiring: FileText,
  sessions_today: Calendar,
  inactive_patient: UserX,
  new_patient: UserPlus,
  diary_entry: BookOpen,
  diary_reply: MessageCircle,
};

const priorityStyles: Record<string, string> = {
  high: 'border-l-destructive bg-destructive/5',
  medium: 'border-l-warning bg-warning/5',
  low: 'border-l-muted-foreground bg-muted/30',
};

const iconStyles: Record<string, string> = {
  high: 'text-destructive',
  medium: 'text-warning',
  low: 'text-muted-foreground',
};

export const NotificationItem = memo(function NotificationItem({ 
  notification, 
  onClose,
  onMarkAsRead,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const Icon = iconMap[notification.type];

  const handleClick = () => {
    if (notification.isDbNotification && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      onClose();
    }
  };

  const timeAgo = formatDistanceToNow(notification.createdAt, {
    addSuffix: true,
    locale: pt,
  });

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full text-left p-3 border-l-4 rounded-r-md transition-colors",
        "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
        priorityStyles[notification.priority]
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "mt-0.5 p-1.5 rounded-full bg-background",
          iconStyles[notification.priority]
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">
            {notification.title}
            {notification.count && notification.count > 1 && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({notification.count})
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            {timeAgo}
          </p>
        </div>
      </div>
    </button>
  );
});
