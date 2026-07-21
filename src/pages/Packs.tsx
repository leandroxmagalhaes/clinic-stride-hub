// Packs — Painel global de packs por paciente
import { useMemo, useState } from "react";
import { useData, Pack } from "@/contexts/DataContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, differenceInDays, parseISO } from "date-fns";
import { Package as PackageIcon, Search, AlertTriangle, CircleDollarSign } from "lucide-react";
import { PackManagerModal } from "@/components/agenda/PackManagerModal";

type Filter = "ativos" | "a_expirar" | "pagamento_pendente" | "todos";

export default function Packs() {
  const { packs, patients } = useData();
  const [filter, setFilter] = useState<Filter>("ativos");
  const [query, setQuery] = useState("");
  const [openPatient, setOpenPatient] = useState<{ id: string; name: string } | null>(null);

  const patientName = (id: string) => patients.find((p) => p.id === id)?.full_name || "—";

  const filtered = useMemo(() => {
    const today = new Date();
    return packs
      .filter((p) => {
        if (filter === "ativos" && p.status !== "ativo") return false;
        if (filter === "a_expirar") {
          if (p.status !== "ativo") return false;
          const days = differenceInDays(parseISO(p.data_validade), today);
          if (days < 0 || days > 30) return false;
        }
        if (filter === "pagamento_pendente" && p.payment_status === "pago") return false;
        if (query) {
          const name = patientName(p.paciente_id).toLowerCase();
          if (!name.includes(query.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = parseISO(a.data_validade).getTime();
        const db = parseISO(b.data_validade).getTime();
        return da - db;
      });
  }, [packs, filter, query, patients]);

  const statusBadge = (p: Pack) => {
    if (p.status === "concluido") return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Concluído</Badge>;
    if (p.status === "expirado") return <Badge className="bg-gray-100 text-gray-600 border-gray-300">Expirado</Badge>;
    if (p.status === "cancelado") return <Badge variant="outline">Cancelado</Badge>;
    if (p.alert_status === "esgotado") return <Badge className="bg-gray-100 text-gray-600 border-gray-300">Esgotado</Badge>;
    if (p.alert_status === "ultima_sessao") return <Badge className="bg-red-50 text-red-700 border-red-300">Última sessão</Badge>;
    if (p.alert_status === "penultima_sessao") return <Badge className="bg-orange-50 text-orange-700 border-orange-300">Penúltima</Badge>;
    return <Badge className="bg-green-50 text-green-700 border-green-300">Activo</Badge>;
  };

  const paymentBadge = (p: Pack) => {
    if (p.payment_status === "pago")
      return <Badge className="bg-green-100 text-green-700 border-green-200">Pago</Badge>;
    if (p.payment_status === "parcial")
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Parcial</Badge>;
    return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Pendente</Badge>;
  };

  return (
    <PersistentLayout>
      <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PackageIcon className="h-6 w-6 text-primary" />
              Packs
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestão de packs de sessões — {packs.length} total
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por utente..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="ativos">Activos</TabsTrigger>
            <TabsTrigger value="a_expirar">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" /> A expirar (30d)
            </TabsTrigger>
            <TabsTrigger value="pagamento_pendente">
              <CircleDollarSign className="h-3.5 w-3.5 mr-1" /> Pagamento pendente
            </TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utente</TableHead>
                  <TableHead>Pack nº</TableHead>
                  <TableHead>Usadas/Total</TableHead>
                  <TableHead>Restantes</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      Nenhum pack encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const name = patientName(p.paciente_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell>#{p.numero_pack}</TableCell>
                        <TableCell>{p.sessoes_usadas} / {p.total_sessoes}</TableCell>
                        <TableCell>{p.sessoes_restantes}</TableCell>
                        <TableCell>{format(parseISO(p.data_validade), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{statusBadge(p)}</TableCell>
                        <TableCell>{paymentBadge(p)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setOpenPatient({ id: p.paciente_id, name })}
                          >
                            Gerir
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {openPatient && (
        <PackManagerModal
          isOpen={!!openPatient}
          onClose={() => setOpenPatient(null)}
          pacienteId={openPatient.id}
          pacienteNome={openPatient.name}
        />
      )}
    </PersistentLayout>
  );
}
