import React, { memo, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  UserCog,
  Settings,
  Briefcase,
  TrendingUp,
  DollarSign,
  Heart,import React, { memo, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  UserCog,
  Settings,
  Briefcase,
  TrendingUp,
  DollarSign,
  Heart,
  LogOut,
  ChevronDown,
  Globe,
  Wind,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useLocale } from "@/contexts/LocaleContext";
import { usePermissions, PermissionModule } from "@/hooks/usePermissions";
import { useClinicInfo } from "@/hooks/useClinicInfo";
import { LOCALE_CONFIGS, Locale } from "@/lib/i18n";
import { toast } from "sonner";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  disabled?: boolean;
  badge?: string;
  module?: PermissionModule;
}

interface NavItemProps {
  item: NavItem;
  isActive: boolean;
}

const NavItem = memo(function NavItem({ item, isActive }: NavItemProps) {
  const Icon = item.icon;
  const { setOpenMobile, isMobile } = useSidebar();

  const handleClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild={!item.disabled}
        isActive={isActive}
        disabled={item.disabled}
        className={cn(
          "transition-all duration-200",
          item.disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {item.disabled ? (
          <div className="flex items-center gap-3 w-full">
            <Icon className="h-4 w-4" />
            <span className="flex-1">{item.title}</span>
            {item.badge && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-sidebar-accent text-sidebar-muted">
                {item.badge}
              </Badge>
            )}
          </div>
        ) : (
          <Link to={item.url} onClick={handleClick} className="flex items-center gap-3 w-full">
            <Icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});

const mainNavItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
  { title: "Agenda", url: "/agenda", icon: Calendar, module: "agenda" },
  { title: "Pacientes", url: "/pacientes", icon: Users, module: "pacientes" },
  { title: "Prontuários", url: "/prontuarios", icon: FileText, module: "prontuarios" },
  { title: "Profissionais", url: "/profissionais", icon: UserCog, module: "profissionais" },
];

const managementNavItems: NavItem[] = [
  { title: "Serviços", url: "/servicos", icon: Briefcase, module: "servicos" },
  { title: "Comercial", url: "/comercial", icon: TrendingUp, module: "comercial" },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign, module: "financeiro" },
  { title: "Engajamento", url: "/engajamento", icon: Heart, module: "engajamento" },
];

const clinicNavItems: NavItem[] = [
  { title: "Rel. Respiratórios", url: "/relatorios-respiratorios", icon: Wind },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { locale, setLocale } = useLocale();
  const { canAccessModule, getRolesLabels, isLoading: permissionsLoading } = usePermissions();
  const { data: clinicInfo } = useClinicInfo();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Erro ao sair', { description: error.message });
      return;
    }
    toast.success('Logout realizado com sucesso!');
    navigate('/login');
  };

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    toast.success(`Região alterada para ${LOCALE_CONFIGS[newLocale].countryName}`);
  };

  const userInfo = useMemo(() => {
    const userEmail = user?.email || '';
    const userName = user?.user_metadata?.full_name || userEmail.split('@')[0] || 'Usuário';
    const userRoles = getRolesLabels();
    const userInitials = userName
      .split(' ')
      .map((n: string) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return { userEmail, userName, userRoles, userInitials };
  }, [user?.email, user?.user_metadata?.full_name, getRolesLabels]);

  const visibleItems = useMemo(() => ({
    main: permissionsLoading ? mainNavItems : mainNavItems.filter(item => !item.module || canAccessModule(item.module)),
    management: permissionsLoading ? managementNavItems : managementNavItems.filter(item => !item.module || canAccessModule(item.module)),
  }), [canAccessModule, permissionsLoading]);

  const currentPath = location.pathname;

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
            <span className="text-primary-foreground font-bold text-lg font-display">P</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-base text-sidebar-primary-foreground">
              Physione
            </span>
            <span className="text-[10px] text-sidebar-muted leading-none">
              {clinicInfo?.name || 'Gestão de Clínicas'}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        {visibleItems.main.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider font-medium">
              Principal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.main.map((item) => (
                  <NavItem key={item.title} item={item} isActive={currentPath === item.url} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleItems.management.length > 0 && (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider font-medium">
              Gestão
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.management.map((item) => (
                  <NavItem key={item.title} item={item} isActive={currentPath === item.url} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ── Clínica ────────────────────────────────────────────── */}
        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider font-medium">
            Clínica
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {clinicNavItems.map((item) => (
                <NavItem key={item.title} item={item} isActive={currentPath === item.url} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer">
              <Avatar className="h-8 w-8">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                  {userInfo.userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-primary-foreground truncate">
                  {userInfo.userName}
                </p>
                <p className="text-[10px] text-sidebar-muted truncate">
                  {userInfo.userRoles.length > 0 ? userInfo.userRoles.join(' • ') : userInfo.userEmail}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-sidebar-muted shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Globe className="mr-2 h-4 w-4" />
                <span className="flex-1">Região</span>
                <span className="ml-2 text-muted-foreground">
                  {LOCALE_CONFIGS[locale].flag}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-popover">
                <DropdownMenuRadioGroup value={locale} onValueChange={(value) => handleLocaleChange(value as Locale)}>
                  <DropdownMenuRadioItem value="pt-PT">
                    <span className="mr-2">🇵🇹</span>
                    Portugal (€)
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="pt-BR">
                    <span className="mr-2">🇧🇷</span>
                    Brasil (R$)
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem asChild>
              <Link to="/configuracoes" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
  LogOut,
  ChevronDown,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useLocale } from "@/contexts/LocaleContext";
import { usePermissions, PermissionModule } from "@/hooks/usePermissions";
import { useClinicInfo } from "@/hooks/useClinicInfo";
import { LOCALE_CONFIGS, Locale } from "@/lib/i18n";
import { toast } from "sonner";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  disabled?: boolean;
  badge?: string;
  module?: PermissionModule;
}

interface NavItemProps {
  item: NavItem;
  isActive: boolean;
}

// Memoized NavItem component - extracted outside AppSidebar to prevent recreation
const NavItem = memo(function NavItem({ item, isActive }: NavItemProps) {
  const Icon = item.icon;
  const { setOpenMobile, isMobile } = useSidebar();

  const handleClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild={!item.disabled}
        isActive={isActive}
        disabled={item.disabled}
        className={cn(
          "transition-all duration-200",
          item.disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {item.disabled ? (
          <div className="flex items-center gap-3 w-full">
            <Icon className="h-4 w-4" />
            <span className="flex-1">{item.title}</span>
            {item.badge && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-sidebar-accent text-sidebar-muted">
                {item.badge}
              </Badge>
            )}
          </div>
        ) : (
          <Link to={item.url} onClick={handleClick} className="flex items-center gap-3 w-full">
            <Icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});

const mainNavItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
  { title: "Agenda", url: "/agenda", icon: Calendar, module: "agenda" },
  { title: "Pacientes", url: "/pacientes", icon: Users, module: "pacientes" },
  { title: "Prontuários", url: "/prontuarios", icon: FileText, module: "prontuarios" },
  { title: "Profissionais", url: "/profissionais", icon: UserCog, module: "profissionais" },
];

const managementNavItems: NavItem[] = [
  { title: "Serviços", url: "/servicos", icon: Briefcase, module: "servicos" },
  { title: "Comercial", url: "/comercial", icon: TrendingUp, module: "comercial" },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign, module: "financeiro" },
  { title: "Engajamento", url: "/engajamento", icon: Heart, module: "engajamento" },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { locale, setLocale } = useLocale();
  const { canAccessModule, getRolesLabels, isLoading: permissionsLoading } = usePermissions();
  const { data: clinicInfo } = useClinicInfo();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Erro ao sair', { description: error.message });
      return;
    }
    toast.success('Logout realizado com sucesso!');
    navigate('/login');
  };

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    toast.success(`Região alterada para ${LOCALE_CONFIGS[newLocale].countryName}`);
  };

  // Memoize user display info
  const userInfo = useMemo(() => {
    const userEmail = user?.email || '';
    const userName = user?.user_metadata?.full_name || userEmail.split('@')[0] || 'Usuário';
    const userRoles = getRolesLabels();
    const userInitials = userName
      .split(' ')
      .map((n: string) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return { userEmail, userName, userRoles, userInitials };
  }, [user?.email, user?.user_metadata?.full_name, getRolesLabels]);

  // Memoize visible items based on permissions - calculated once
  const visibleItems = useMemo(() => ({
    main: permissionsLoading ? mainNavItems : mainNavItems.filter(item => !item.module || canAccessModule(item.module)),
    management: permissionsLoading ? managementNavItems : managementNavItems.filter(item => !item.module || canAccessModule(item.module)),
  }), [canAccessModule, permissionsLoading]);

  // Memoize current path for active state
  const currentPath = location.pathname;

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
            <span className="text-primary-foreground font-bold text-lg font-display">P</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-base text-sidebar-primary-foreground">
              Physione
            </span>
            <span className="text-[10px] text-sidebar-muted leading-none">
              {clinicInfo?.name || 'Gestão de Clínicas'}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        {visibleItems.main.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider font-medium">
              Principal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.main.map((item) => (
                  <NavItem 
                    key={item.title} 
                    item={item} 
                    isActive={currentPath === item.url}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleItems.management.length > 0 && (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider font-medium">
              Gestão
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.management.map((item) => (
                  <NavItem 
                    key={item.title} 
                    item={item} 
                    isActive={currentPath === item.url}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer">
              <Avatar className="h-8 w-8">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                  {userInfo.userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-primary-foreground truncate">
                  {userInfo.userName}
                </p>
                <p className="text-[10px] text-sidebar-muted truncate">
                  {userInfo.userRoles.length > 0 ? userInfo.userRoles.join(' • ') : userInfo.userEmail}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-sidebar-muted shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Globe className="mr-2 h-4 w-4" />
                <span className="flex-1">Região</span>
                <span className="ml-2 text-muted-foreground">
                  {LOCALE_CONFIGS[locale].flag}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-popover">
                <DropdownMenuRadioGroup value={locale} onValueChange={(value) => handleLocaleChange(value as Locale)}>
                  <DropdownMenuRadioItem value="pt-PT">
                    <span className="mr-2">🇵🇹</span>
                    Portugal (€)
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="pt-BR">
                    <span className="mr-2">🇧🇷</span>
                    Brasil (R$)
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem asChild>
              <Link to="/configuracoes" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
