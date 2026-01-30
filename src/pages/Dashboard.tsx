import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Calendar, Users, Activity, TrendingUp, Clock } from "lucide-react";
import { format, isToday, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import { SessionService } from "@/services/SessionService";
import { NewSessionModal } from "@/components/agenda/NewSessionModal";
import { DashboardSkeleton } from "@/components/skeletons/PageSkeletons";

export default function Dashboard() {
  const { sessions, patients, professionals, services, addSession, getCreditBalance, isLoading } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state for new session modal
  const [selectedPaciente, setSelectedPaciente] = useState("");
  const [selectedProfissional, setSelectedProfissional] = useState("");
  const [selectedServico, setSelectedServico] = useState("");
  const [notes, setNotes] = useState("");

  // Filter upcoming sessions (today and future, not finished)
  const upcomingSessions = sessions
    .filter((s) => {
      const startTime = s.start_time instanceof Date ? s.start_time : new Date(s.start_time);
      return (isToday(startTime) || isFuture(startTime)) && s.status !== 'finalizado' && s.status !== 'cancelado';
    })
    .sort((a, b) => {
      const aTime = a.start_time instanceof Date ? a.start_time : new Date(a.start_time);
      const bTime = b.start_time instanceof Date ? b.start_time : new Date(b.start_time);
      return aTime.getTime() - bTime.getTime();
    })
    .slice(0, 5);

  // Recent patients
  const recentPatients = patients.slice(0, 4);

  // Dashboard stats from context data
  const todaysSessions = sessions.filter((s) => {
    const startTime = s.start_time instanceof Date ? s.start_time : new Date(s.start_time);
    return isToday(startTime);
  }).length;

  const activePatients = patients.filter(p => p.is_active).length;
  const weekSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.status === 'finalizado').length;
  const attendanceRate = sessions.length > 0 ? Math.round((completedSessions / sessions.length) * 100) : 0;

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPaciente("");
    setSelectedProfissional("");
    setSelectedServico("");
    setNotes("");
  };

  const handleSubmitSession = async (data: {
    pacienteId: string;
    profissionalId: string;
    servicoId: string;
    notes: string;
  }) => {
    try {
      const now = new Date();
      const selectedService = services.find(s => s.id === data.servicoId);
      
      // Determine payment_status BEFORE creating session (no credit consumption on scheduling)
      const balance = getCreditBalance(data.pacienteId);
      const serviceConsumesCredit = selectedService?.consumes_credit ?? true;
      const paymentStatus = (serviceConsumesCredit && balance > 0) ? "reservado" : "pendente";

      const newSession = SessionService.create(
        {
          pacienteId: data.pacienteId,
          profissionalId: data.profissionalId,
          servicoId: data.servicoId,
          date: now,
          hour: now.getHours(),
          notes: data.notes,
        },
        sessions,
        'clinic-id', // Will be set properly by backend
        {
          services: services.map(s => ({
            id: s.id,
            name: s.name,
            color: s.color || '#10B981',
            duration_minutes: s.duration_minutes,
            price: Number(s.price),
            consumes_credit: s.consumes_credit,
          })),
          patients: patients.map(p => ({ id: p.id, full_name: p.full_name })),
          professionals: professionals.map(p => ({ id: p.id, full_name: p.full_name })),
        }
      );

      // Set payment_status before insert (NO credit deduction on scheduling)
      newSession.payment_status = paymentStatus;

      await addSession(newSession);
      toast.success(
        paymentStatus === "pendente"
          ? "Sessão agendada com pagamento pendente"
          : "Sessão agendada com sucesso!"
      );
      handleCloseModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao agendar sessão");
    }
  };

  // Show skeleton while loading
  if (isLoading) {
    return (
      <AppLayout 
        title="Dashboard" 
        subtitle={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
      >
        <DashboardSkeleton />
      </AppLayout>
    );
  }

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
            value={todaysSessions}
            icon={Calendar}
            trend={{ value: 12, positive: true }}
          />
          <StatCard
            title="Pacientes Ativos"
            value={activePatients}
            icon={Users}
          />
          <StatCard
            title="Sessões na Semana"
            value={weekSessions}
            icon={Activity}
          />
          <StatCard
            title="Taxa de Comparecimento"
            value={`${attendanceRate}%`}
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
                  {upcomingSessions.map((session) => {
                    const startTime = session.start_time instanceof Date ? session.start_time : new Date(session.start_time);
                    return (
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
                            {format(startTime, "HH:mm")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isToday(startTime) ? "Hoje" : format(startTime, "dd/MM")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
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
                      <p className="text-xs text-muted-foreground truncate">{patient.phone}</p>
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
            <CardTitle className="font-display text-lg font-semibold">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button 
                variant="outline" 
                className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/30"
                onClick={() => setIsModalOpen(true)}
              >
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Nova Sessão</span>
              </Button>
              <Link to="/pacientes" className="w-full">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/30">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">Novo Paciente</span>
                </Button>
              </Link>
              <Link to="/prontuarios" className="w-full">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/30">
                  <Activity className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">Nova Evolução</span>
                </Button>
              </Link>
              <Link to="/profissionais" className="w-full">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/30">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">Ver Relatórios</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Session Modal */}
      <NewSessionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        selectedSlot={{ date: new Date(), hour: new Date().getHours() }}
        patients={patients}
        professionals={professionals}
        services={services}
        selectedPaciente={selectedPaciente}
        setSelectedPaciente={setSelectedPaciente}
        selectedProfissional={selectedProfissional}
        setSelectedProfissional={setSelectedProfissional}
        selectedServico={selectedServico}
        setSelectedServico={setSelectedServico}
        notes={notes}
        setNotes={setNotes}
        onSubmit={handleSubmitSession}
        getCreditBalance={getCreditBalance}
      />
    </AppLayout>
  );
}
