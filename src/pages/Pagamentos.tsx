// /pagamentos — vista de pendentes com realtime
import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Banknote, Copy, MessageCircle, Smartphone, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PaymentModal } from "@/components/PaymentModal";

interface PendingRow {
  id: string;
  session_id: string;
  patient_id: string;
  clinic_id: string;
  patient_name: string;
  patient_phone: string | null;
  amount: number;
  method: string | null;
  mb_entity: string | null;
  mb_reference: string | null;
  created_at: string;
}

export default function Pagamentos() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ sessionId: string; patientId: string; amount: number; name: string; phone?: string } | null>(null);

  const fetchRows = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("v_pending_payments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setRows((data || []) as PendingRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
    const ch = supabase
      .channel("payments-pending")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => fetchRows())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchRows]);

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  const markPaidCash = async (row: PendingRow) => {
    setBusyId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          session_id: row.session_id,
          patient_id: row.patient_id,
          amount: Number(row.amount),
          method: "dinheiro",
        },
      });
      if (error || !data?.ok) throw new Error(error?.message || data?.error || "Erro");
      toast.success("Marcado como pago");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const generateMbway = (row: PendingRow) => {
    setModal({
      sessionId: row.session_id,
      patientId: row.patient_id,
      amount: Number(row.amount),
      name: row.patient_name,
      phone: row.patient_phone || undefined,
    });
  };

  const copyRef = (row: PendingRow) => {
    if (!row.mb_entity || !row.mb_reference) {
      toast.error("Sem referência MB gerada");
      return;
    }
    const txt = `Entidade: ${row.mb_entity}\nReferência: ${row.mb_reference}\nValor: ${Number(row.amount).toFixed(2)}€`;
    navigator.clipboard.writeText(txt);
    toast.success("Referência copiada");
  };

  const sendWhatsApp = (row: PendingRow) => {
    const tel = (row.patient_phone || "").replace(/\D/g, "");
    let msg = `Olá ${row.patient_name.split(" ")[0]}! Lembrete: pagamento pendente de ${Number(row.amount).toFixed(2)}€.`;
    if (row.mb_entity && row.mb_reference) {
      msg += `\n\nEntidade: ${row.mb_entity}\nReferência: ${row.mb_reference}\nValor: ${Number(row.amount).toFixed(2)}€`;
    }
    const url = tel
      ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <AppLayout title="Pagamentos" subtitle="Contas a receber em tempo real">
      <div className="space-y-4 animate-fade-in">
        <Card className="p-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Pendente</div>
            <div className="text-3xl font-bold text-orange-600">{total.toFixed(2)}€</div>
          </div>
          <Badge variant="outline" className="text-base px-3 py-1">
            {rows.length} pagamento(s)
          </Badge>
        </Card>

        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-600" />
              Tudo pago. Nada pendente.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="hidden md:table-cell">Método</TableHead>
                    <TableHead className="hidden lg:table-cell">Referência</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.patient_name}</div>
                        {r.patient_phone && (
                          <div className="text-xs text-muted-foreground">{r.patient_phone}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">{Number(r.amount).toFixed(2)}€</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {r.method ? <Badge variant="outline">{r.method}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs font-mono">
                        {r.mb_entity && r.mb_reference ? `${r.mb_entity} / ${r.mb_reference}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1 flex-wrap justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 bg-green-600 hover:bg-green-700 text-white border-green-600"
                            disabled={busyId === r.id}
                            onClick={() => markPaidCash(r)}
                          >
                            <Banknote className="h-3.5 w-3.5" /> Dinheiro
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => generateMbway(r)}>
                            <Smartphone className="h-3.5 w-3.5" /> MB Way
                          </Button>
                          {r.mb_reference && (
                            <Button size="sm" variant="ghost" className="gap-1" onClick={() => copyRef(r)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => sendWhatsApp(r)}>
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <PaymentModal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        sessionId={modal?.sessionId || null}
        patientId={modal?.patientId || null}
        patientName={modal?.name}
        patientPhone={modal?.phone}
        amount={modal?.amount || 0}
        onPaid={fetchRows}
      />
    </AppLayout>
  );
}
