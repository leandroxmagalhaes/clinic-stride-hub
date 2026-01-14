import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Calendar, Users, Activity, TrendingUp, Clock } from "lucide-react";
import { mockDashboardStats, mockSessoes, mockPacientes } from "@/lib/mock-data";
import { format, isToday, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  // Filter upcoming sessions (today and future, not finished)
  const upcomingSessions = mockSessoes
    .filter((s) => (isToday(s.start_time) || isFuture(s.start_time)) && s.status !== 'finalizado' && s.status !== 'cancelado')
    .sort((a, b) => a.start_time.getTime() - b.start_time.getTime())
    .slice(0, 5);

  // Recent patients
  const recentPatients = mockPacientes.slice(0, 4);

  return (
    <AppLayout 
      title="Dashboard" 
      subtitle={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Atendimentos Hoje"
            value={mockDashboardStats.atendimentosHoje}
            icon={Calendar}
            trend={{ value: 12, positive: true }}
          />
          <StatCard
            title="Pacientes Ativos"
            value={mockDashboardStats.pacientesAtivos}
            icon={Users}
          />
          <StatCard
            title="Sessões na Semana"
            value={mockDashboardStats.sessoesSemana}
            icon={Activity}
          />
          <StatCard
            title="Taxa de Comparecimento"
            value={`${mockDashboardStats.taxaComparecimento}%`}
            icon={TrendingUp}
            trend={{ value: 3, positive: true }}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Sessions */}
          <Card className="lg:col-span-2 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-display text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Próximos Agendamentos
              </CardTitle>
              <Link to="/agenda">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  Ver todos
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-2">
              {upcomingSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum agendamento próximo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className="w-1 h-12 rounded-full"
                        style={{ backgroundColor: session.servico?.color || '#10B981' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm truncate">
                            {session.paciente?.full_name}
                          </p>
                          <StatusBadge status={session.status as any} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {session.servico?.name} • {session.profissional?.full_name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">
                          {format(session.start_time, "HH:mm")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isToday(session.start_time) 
                            ? "Hoje" 
                            : format(session.start_time, "dd/MM")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Patients */}
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-display text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Pacientes Recentes
              </CardTitle>
              <Link to="/pacientes">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  Ver todos
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-3">
                {recentPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {patient.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{patient.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {patient.phone}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg font-semibold">
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link to="/agenda">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/30">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">Nova Sessão</span>
                </Button>
              </Link>
              <Link to="/pacientes">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/30">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">Novo Paciente</span>
                </Button>
              </Link>
              <Link to="/prontuarios">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/30">
                  <Activity className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">Nova Evolução</span>
                </Button>
              </Link>
              <Link to="/profissionais">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/30">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">Ver Relatórios</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
