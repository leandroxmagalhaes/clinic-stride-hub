import { memo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { NotificationItem } from './NotificationItem';
import { NotificationService, type AppNotification } from '@/services/NotificationService';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const NotificationBell = memo(function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'unread' | 'all'>('unread');
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async (includeRead: boolean = false) => {
    try {
      setLoading(true);
      const data = await NotificationService.getNotifications(includeRead);
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(filter === 'all');
    const interval = setInterval(() => fetchNotifications(filter === 'all'), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications, filter]);

  // Realtime subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', session.user.id)
        .single();

      if (!profile?.clinic_id) return;

      channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `clinic_id=eq.${profile.clinic_id}`,
          },
          (payload) => {
            const n = payload.new as any;
            const newNotification: AppNotification = {
              id: n.id,
              type: n.type,
              title: n.title,
              message: n.message,
              priority: 'high',
              link: n.patient_id ? `/pacientes?id=${n.patient_id}&edit=true` : undefined,
              createdAt: new Date(n.created_at),
              patientId: n.patient_id,
              isDbNotification: true,
              read: false,
            };

            setNotifications(prev => [newNotification, ...prev]);

            // Show toast
            toast({
              title: `🔔 ${n.title}`,
              description: n.message,
              action: n.patient_id ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/pacientes?id=${n.patient_id}&edit=true`)}
                >
                  Ver ficha →
                </Button>
              ) : undefined,
            });
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [navigate]);

  const highPriorityCount = NotificationService.getHighPriorityCount(notifications);
  const hasNotifications = notifications.length > 0;

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleMarkAsRead = useCallback(async (id: string) => {
    await NotificationService.markAsRead(id);
    if (filter === 'all') {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } else {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  }, [filter]);

  const handleMarkAllAsRead = useCallback(async () => {
    await NotificationService.markAllAsRead();
    if (filter === 'all') {
      setNotifications(prev => prev.map(n => n.isDbNotification ? { ...n, read: true } : n));
    } else {
      setNotifications(prev => prev.filter(n => !n.isDbNotification));
    }
  }, [filter]);

  // Group notifications by priority
  const highPriority = notifications.filter(n => n.priority === 'high');
  const mediumPriority = notifications.filter(n => n.priority === 'medium');
  const lowPriority = notifications.filter(n => n.priority === 'low');

  const hasDbNotifications = notifications.some(n => n.isDbNotification);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          aria-label={`Notificações${highPriorityCount > 0 ? ` (${highPriorityCount} importantes)` : ''}`}
        >
          <Bell className={cn(
            "h-4 w-4 transition-colors",
            highPriorityCount > 0 && "text-destructive"
          )} />
          {highPriorityCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                {highPriorityCount > 9 ? '9+' : highPriorityCount}
              </span>
            </span>
          )}
          {highPriorityCount === 0 && hasNotifications && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notificações</h3>
          {hasNotifications && (
            <span className="text-xs text-muted-foreground">
              {notifications.length} {notifications.length === 1 ? 'alerta' : 'alertas'}
            </span>
          )}
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              A carregar...
            </div>
          ) : !hasNotifications ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Sem notificações
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {highPriority.length > 0 && (
                <>
                  <p className="px-2 py-1 text-xs font-medium text-destructive uppercase tracking-wide">
                    Urgente
                  </p>
                  {highPriority.map(notification => (
                    <NotificationItem 
                      key={notification.id} 
                      notification={notification}
                      onClose={handleClose}
                      onMarkAsRead={handleMarkAsRead}
                    />
                  ))}
                </>
              )}
              
              {mediumPriority.length > 0 && (
                <>
                  {highPriority.length > 0 && <Separator className="my-2" />}
                  <p className="px-2 py-1 text-xs font-medium text-warning uppercase tracking-wide">
                    Atenção
                  </p>
                  {mediumPriority.map(notification => (
                    <NotificationItem 
                      key={notification.id} 
                      notification={notification}
                      onClose={handleClose}
                      onMarkAsRead={handleMarkAsRead}
                    />
                  ))}
                </>
              )}
              
              {lowPriority.length > 0 && (
                <>
                  {(highPriority.length > 0 || mediumPriority.length > 0) && <Separator className="my-2" />}
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Informação
                  </p>
                  {lowPriority.map(notification => (
                    <NotificationItem 
                      key={notification.id} 
                      notification={notification}
                      onClose={handleClose}
                      onMarkAsRead={handleMarkAsRead}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>

        {hasDbNotifications && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={handleMarkAllAsRead}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                Marcar todas como lidas
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
});
