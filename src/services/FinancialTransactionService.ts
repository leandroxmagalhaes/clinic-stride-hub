// FinancialTransactionService - Entradas avulsas e despesas em localStorage
// Complementa os dados de packs que vêm do Supabase

export type TransactionKind = "entrada" | "saida";

export type TransactionCategory =
  // Entradas
  | "consulta_avulsa"
  | "produto"
  | "outro_entrada"
  // Saídas
  | "renda"
  | "material"
  | "salario"
  | "equipamento"
  | "marketing"
  | "outro_saida";

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  consulta_avulsa: "Consulta avulsa",
  produto: "Produto",
  outro_entrada: "Outra entrada",
  renda: "Renda",
  material: "Material",
  salario: "Salário",
  equipamento: "Equipamento",
  marketing: "Marketing",
  outro_saida: "Outra saída",
};

export const ENTRY_CATEGORIES: TransactionCategory[] = ["consulta_avulsa", "produto", "outro_entrada"];

export const EXIT_CATEGORIES: TransactionCategory[] = [
  "renda",
  "material",
  "salario",
  "equipamento",
  "marketing",
  "outro_saida",
];

export interface LocalTransaction {
  id: string;
  kind: TransactionKind;
  category: TransactionCategory;
  description: string;
  amount: number; // sempre positivo
  date: string; // "YYYY-MM-DD"
  payment_method?: string;
  recorrente: boolean;
  recorrente_dia?: number; // dia do mês para recorrentes
  created_at: string;
}

export interface CreateLocalTransactionData {
  kind: TransactionKind;
  category: TransactionCategory;
  description: string;
  amount: number;
  date: string;
  payment_method?: string;
  recorrente: boolean;
  recorrente_dia?: number;
}

const STORAGE_KEY = "physione_financial_transactions";

function loadAll(): LocalTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalTransaction[];
  } catch {
    return [];
  }
}

function saveAll(transactions: LocalTransaction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch {
    console.error("localStorage indisponível");
  }
}

export const FinancialTransactionService = {
  getAll(): LocalTransaction[] {
    return loadAll();
  },

  // Retorna transacções dentro de um intervalo de datas
  // Inclui recorrentes expandidas para o período
  getForPeriod(startDate: Date, endDate: Date): LocalTransaction[] {
    const all = loadAll();
    const results: LocalTransaction[] = [];

    for (const tx of all) {
      if (!tx.recorrente) {
        // Transacção normal — verifica se está no período
        const d = new Date(tx.date + "T12:00:00");
        if (d >= startDate && d <= endDate) {
          results.push(tx);
        }
      } else {
        // Recorrente — gera uma ocorrência por mês no período
        const txStart = new Date(tx.date + "T12:00:00");
        const dia = tx.recorrente_dia || new Date(tx.date + "T12:00:00").getDate();

        // Itera mês a mês
        const cursor = new Date(startDate);
        cursor.setDate(1);

        while (cursor <= endDate) {
          const year = cursor.getFullYear();
          const month = cursor.getMonth();
          const maxDay = new Date(year, month + 1, 0).getDate();
          const occDay = Math.min(dia, maxDay);
          const occ = new Date(year, month, occDay, 12, 0, 0);

          if (occ >= txStart && occ >= startDate && occ <= endDate) {
            results.push({
              ...tx,
              id: `${tx.id}_${year}_${month}`,
              date: `${year}-${String(month + 1).padStart(2, "0")}-${String(occDay).padStart(2, "0")}`,
            });
          }

          cursor.setMonth(cursor.getMonth() + 1);
        }
      }
    }

    return results.sort((a, b) => b.date.localeCompare(a.date));
  },

  create(data: CreateLocalTransactionData): LocalTransaction {
    const all = loadAll();
    const tx: LocalTransaction = {
      id: `ltx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...data,
      created_at: new Date().toISOString(),
    };
    all.push(tx);
    saveAll(all);
    return tx;
  },

  update(id: string, data: Partial<CreateLocalTransactionData>): LocalTransaction | null {
    const all = loadAll();
    const idx = all.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const updated = { ...all[idx], ...data };
    all[idx] = updated;
    saveAll(all);
    return updated;
  },

  delete(id: string): void {
    const all = loadAll().filter((t) => t.id !== id);
    saveAll(all);
  },

  // Estatísticas para um período
  getStats(startDate: Date, endDate: Date, packRevenue: number = 0) {
    const txs = this.getForPeriod(startDate, endDate);
    const entradas = txs.filter((t) => t.kind === "entrada").reduce((s, t) => s + t.amount, 0);
    const saidas = txs.filter((t) => t.kind === "saida").reduce((s, t) => s + t.amount, 0);
    const totalEntradas = entradas + packRevenue;
    const saldo = totalEntradas - saidas;
    return { entradas, saidas, totalEntradas, saldo, count: txs.length };
  },

  // Dados para gráfico dos últimos N meses
  getMonthlyChartData(months: number = 12, packRevenueByMonth: Record<string, number> = {}) {
    const result = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });

      const txs = this.getForPeriod(start, end);
      const entradas = txs.filter((t) => t.kind === "entrada").reduce((s, t) => s + t.amount, 0);
      const saidas = txs.filter((t) => t.kind === "saida").reduce((s, t) => s + t.amount, 0);
      const packs = packRevenueByMonth[key] || 0;

      result.push({
        key,
        label,
        entradas: entradas + packs,
        saidas,
        saldo: entradas + packs - saidas,
      });
    }

    return result;
  },
};
