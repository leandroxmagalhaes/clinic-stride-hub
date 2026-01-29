import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface StatementLine {
  date: Date;
  time: string;
  type: string;
  description: string;
  professional: string | null;
  service: string | null;
  credits: number | null;
  monetaryValue: number | null;
}

const STATUS_LABELS: Record<string, string> = {
  'agendado': 'Agendamento',
  'confirmado': 'Confirmação',
  'em_atendimento': 'Em Atendimento',
  'finalizado': 'Consulta Finalizada',
  'realizado': 'Consulta Realizada',
  'cancelado': 'Cancelamento',
  'faltou': 'Falta',
  'falta': 'Falta',
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
  'agendado': 'Sessão agendada',
  'confirmado': 'Sessão confirmada',
  'em_atendimento': 'Sessão em andamento',
  'finalizado': 'Sessão realizada',
  'realizado': 'Sessão realizada',
  'cancelado': 'Sessão cancelada',
  'faltou': 'Paciente não compareceu',
  'falta': 'Paciente não compareceu',
};

const TRANSACTION_LABELS: Record<string, string> = {
  'purchase': 'Compra de Créditos',
  'usage': 'Uso de Crédito',
  'refund': 'Reembolso',
  'adjustment': 'Ajuste de Créditos',
};

export class PatientStatementService {
  static async generateStatement(patientId: string): Promise<StatementLine[]> {
    const lines: StatementLine[] = [];

    // Fetch all sessions for this patient
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessoes')
      .select(`
        id, start_time, end_time, status, notes, price,
        payment_method, payment_status,
        profissional:profiles!profissional_id(full_name),
        servico:servicos!servico_id(name)
      `)
      .eq('paciente_id', patientId)
      .order('start_time', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      throw new Error('Erro ao buscar sessões');
    }

    // Process sessions
    if (sessions) {
      for (const session of sessions) {
        const startDate = new Date(session.start_time);
        const professional = (session.profissional as any)?.full_name || null;
        const service = (session.servico as any)?.name || null;
        
        let description = STATUS_DESCRIPTIONS[session.status] || 'Sessão';
        if (session.status === 'cancelado' && session.notes) {
          description = `Cancelado: ${session.notes}`;
        }

        // Check if this session consumed credits (finalizado/falta)
        let credits: number | null = null;
        if (['finalizado', 'realizado', 'faltou', 'falta'].includes(session.status)) {
          credits = -1;
        }

        lines.push({
          date: startDate,
          time: format(startDate, 'HH:mm'),
          type: STATUS_LABELS[session.status] || session.status,
          description,
          professional,
          service,
          credits,
          monetaryValue: session.price || null,
        });
      }
    }

    // Fetch all credit transactions for this patient
    const { data: transactions, error: transactionsError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      throw new Error('Erro ao buscar transações');
    }

    // Process transactions
    if (transactions) {
      for (const tx of transactions) {
        const txDate = new Date(tx.created_at);
        
        lines.push({
          date: txDate,
          time: format(txDate, 'HH:mm'),
          type: TRANSACTION_LABELS[tx.transaction_type] || tx.transaction_type,
          description: tx.description || TRANSACTION_LABELS[tx.transaction_type] || 'Transação',
          professional: null,
          service: null,
          credits: tx.amount,
          monetaryValue: tx.monetary_value ? Number(tx.monetary_value) : null,
        });
      }
    }

    // Sort all lines by date (most recent first)
    lines.sort((a, b) => b.date.getTime() - a.date.getTime());

    return lines;
  }

  static formatAsCSV(lines: StatementLine[]): string {
    const headers = [
      'Data', 'Hora', 'Tipo', 'Descrição', 
      'Profissional', 'Serviço', 'Créditos', 'Valor (€)'
    ];
    
    const rows = lines.map(line => [
      format(line.date, 'dd/MM/yyyy'),
      line.time,
      line.type,
      line.description,
      line.professional || '',
      line.service || '',
      line.credits !== null ? (line.credits > 0 ? `+${line.credits}` : String(line.credits)) : '',
      line.monetaryValue !== null ? line.monetaryValue.toFixed(2).replace('.', ',') : '',
    ]);
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  static downloadCSV(csv: string, patientName: string): void {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
    const safeName = patientName.replace(/[^a-zA-Z0-9]/g, '_');
    
    link.href = url;
    link.download = `extrato_${safeName}_${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  static async downloadStatement(patientId: string, patientName: string): Promise<void> {
    const lines = await this.generateStatement(patientId);
    
    if (lines.length === 0) {
      throw new Error('Nenhum registo encontrado para este paciente');
    }
    
    const csv = this.formatAsCSV(lines);
    this.downloadCSV(csv, patientName);
  }
}
