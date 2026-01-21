import { SalesLead, LeadService } from "@/services/LeadService";
import { StatCard } from "@/components/ui/stat-card";
import { TrendingUp, Users, Euro } from "lucide-react";

interface CRMDashboardProps {
  leads: SalesLead[];
}

export function CRMDashboard({ leads }: CRMDashboardProps) {
  const pipelineValue = LeadService.calculatePipelineValue(leads);
  const conversionRate = LeadService.calculateConversionRate(leads);
  const wonValue = LeadService.calculateWonValue(leads);

  const activeLeads = leads.filter(l => 
    ['novo', 'agendado', 'proposta'].includes(l.status)
  ).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        title="Pipeline Ativo"
        value={`€ ${pipelineValue.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`}
        subtitle={`${activeLeads} leads em negociação`}
        icon={Euro}
      />
      <StatCard
        title="Taxa de Conversão"
        value={`${conversionRate.toFixed(1)}%`}
        subtitle={`${leads.filter(l => l.status === 'ganho').length} de ${leads.length} leads`}
        icon={TrendingUp}
        trend={conversionRate > 0 ? { value: conversionRate, positive: true } : undefined}
      />
      <StatCard
        title="Valor Fechado"
        value={`€ ${wonValue.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`}
        subtitle="Total de vendas realizadas"
        icon={Users}
      />
    </div>
  );
}
