import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cake,
  AlertTriangle,
  FileText,
  Calendar,
  CalendarClock,
  CheckCircle2,
  UserX,
  UserPlus,
  BookOpen,
  MessageCircle,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
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
  remarcacao: CalendarClock,
  confirmacao: CheckCircle2,
  confirmacao_pendente: AlertCircle,
  solicitacao_vaga: ClipboardList,
};

// Bubble color per type (background + icon color pair)
const typeBubbleStyles: Record<NotificationType, string> = {
  birthday: 'bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300',
  report_expired: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  report_expiring: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  sessions_today: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
  inactive_patient: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  new_patient: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  diary_entry: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  diary_reply: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  remarcacao: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300',
  confirmacao: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  confirmacao_pendente: 'bg-red-100 text-red-500 dark:bg-red-500/15 dark:text-red-300',
  solicitacao_vaga: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
};

// Left priority bar
const priorityBarStyles: Record<string, string> = {
  high: 'before:bg-red-500',
  medium: 'before:bg-amber-500',
  low: 'before:bg-muted-foreground/40',
};

export const NotificationItem = memo(function NotificationItem({
  notification,
  onClose,
  onMarkAsRead,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const Icon = iconMap[notification.type] || Calendar;
  const bubble = typeBubbleStyles[notification.type] || 'bg-muted text-muted-foreground';
  const isUnread = notification.isDbNotification && !notification.read;

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
        "relative w-full text-left pl-4 pr-3 py-2.5 rounded-lg transition-all duration-150",
        "before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full",
        priorityBarStyles[notification.priority],
        "hover:bg-accent/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
        isUnread ? 'bg-accent/30' : 'bg-transparent',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            bubble,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className="font-semibold text-sm text-foreground leading-tight flex-1 min-w-0 truncate">
              {notification.title}
              {notification.count && notification.count > 1 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({notification.count})
                </span>
              )}
            </p>
            {isUnread && (
              <span
                aria-label="Não lida"
                className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
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
