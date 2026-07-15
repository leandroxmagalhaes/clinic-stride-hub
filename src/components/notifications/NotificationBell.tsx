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

        <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/30">
          <Button
            variant={filter === 'unread' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setFilter('unread')}
          >
            Não lidas
          </Button>
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setFilter('all')}
          >
            Todas
          </Button>
        </div>
        
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              A carregar...
            </div>
          ) : !hasNotifications ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
                <Bell className="h-5 w-5 text-muted-foreground/70" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {filter === 'unread' ? 'Tudo em dia!' : 'Sem notificações'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {filter === 'unread'
                  ? 'Não há alertas por ler neste momento.'
                  : 'Ainda não há alertas para mostrar.'}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {highPriority.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
                    <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                      Urgente
                    </p>
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-semibold">
                      {highPriority.length}
                    </span>
                  </div>
                  {highPriority.map(notification => (
                    <div
                      key={notification.id}
                      className={cn(
                        "transition-opacity",
                        notification.read && "opacity-60"
                      )}
                    >
                      <NotificationItem
                        notification={notification}
                        onClose={handleClose}
                        onMarkAsRead={handleMarkAsRead}
                      />
                    </div>
                  ))}
                </div>
              )}

              {mediumPriority.length > 0 && (
                <div className="space-y-1">
                  {highPriority.length > 0 && <Separator className="my-1" />}
                  <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
                    <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Atenção
                    </p>
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                      {mediumPriority.length}
                    </span>
                  </div>
                  {mediumPriority.map(notification => (
                    <div
                      key={notification.id}
                      className={cn(
                        "transition-opacity",
                        notification.read && "opacity-60"
                      )}
                    >
                      <NotificationItem
                        notification={notification}
                        onClose={handleClose}
                        onMarkAsRead={handleMarkAsRead}
                      />
                    </div>
                  ))}
                </div>
              )}

              {lowPriority.length > 0 && (
                <div className="space-y-1">
                  {(highPriority.length > 0 || mediumPriority.length > 0) && <Separator className="my-1" />}
                  <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Informativo
                    </p>
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">
                      {lowPriority.length}
                    </span>
                  </div>
                  {lowPriority.map(notification => (
                    <div
                      key={notification.id}
                      className={cn(
                        "transition-opacity",
                        notification.read && "opacity-60"
                      )}
                    >
                      <NotificationItem
                        notification={notification}
                        onClose={handleClose}
                        onMarkAsRead={handleMarkAsRead}
                      />
                    </div>
                  ))}
                </div>
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
