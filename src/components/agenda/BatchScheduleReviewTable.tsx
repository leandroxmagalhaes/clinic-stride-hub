import { useState } from "react";
import { BatchRow } from "@/services/BatchSchedulingService";
import { Patient } from "@/services/PatientService";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CheckCircle, AlertTriangle, XCircle, Search } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  rows: BatchRow[];
  patients: Patient[];
  onRowUpdate: (id: string, updates: Partial<BatchRow>) => void;
  onToggleAll: (approved: boolean) => void;
}

export function BatchScheduleReviewTable({ rows, patients, onRowUpdate, onToggleAll }: Props) {
  const [patientSearch, setPatientSearch] = useState<Record<string, string>>({});

  const getStatusIcon = (row: BatchRow) => {
    if (row.parseError) return <XCircle className="h-4 w-4 text-destructive" />;
    if (row.conflict) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (row.matchStatus === "exact") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (row.matchStatus === "suggestion") return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const getMatchBadge = (row: BatchRow) => {
    if (row.parseError) return <Badge variant="destructive" className="text-xs">{row.parseError}</Badge>;
    if (row.conflict) return <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">{row.conflictInfo}</Badge>;
    if (row.matchStatus === "exact") return <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">{row.matchScore}%</Badge>;
    if (row.matchStatus === "suggestion") return <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">{row.matchScore}%</Badge>;
    return <Badge variant="destructive" className="text-xs">Sem match</Badge>;
  };

  const approvedCount = rows.filter(r => r.approved).length;

  const getFilteredPatients = (rowId: string) => {
    const search = patientSearch[rowId] || "";
    if (!search) return patients.slice(0, 20);
    const norm = search.toLowerCase();
    return patients.filter(p => p.full_name.toLowerCase().includes(norm)).slice(0, 20);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {approvedCount} de {rows.length} selecionados para agendar
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onToggleAll(true)}>Selecionar Todos</Button>
          <Button variant="outline" size="sm" onClick={() => onToggleAll(false)}>Desmarcar Todos</Button>
        </div>
      </div>

      <ScrollArea className="h-[400px] border rounded-md">
        <div className="min-w-[700px]">
          {/* Header */}
          <div className="grid grid-cols-[40px_90px_70px_150px_1fr_100px_80px] gap-2 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground sticky top-0 z-10">
            <div>✓</div>
            <div>Data</div>
            <div>Hora</div>
            <div>Nome (Planilha)</div>
            <div>Paciente</div>
            <div>Match</div>
            <div>Status</div>
          </div>

          {/* Rows */}
          {rows.map(row => (
            <div
              key={row.id}
              className={`grid grid-cols-[40px_90px_70px_150px_1fr_100px_80px] gap-2 px-3 py-2 border-b items-center text-sm ${
                row.approved ? "bg-green-50/50 dark:bg-green-950/10" : row.parseError ? "bg-red-50/50 dark:bg-red-950/10" : ""
              }`}
            >
              {/* Checkbox */}
              <div>
                <Checkbox
                  checked={row.approved}
                  disabled={!!row.parseError}
                  onCheckedChange={(checked) => onRowUpdate(row.id, { approved: !!checked })}
                />
              </div>

              {/* Date */}
              <div className="text-xs">
                {row.date ? format(row.date, "dd/MM/yyyy") : "—"}
              </div>

              {/* Time */}
              <div className="text-xs">
                {String(row.startHour).padStart(2, "0")}:{String(row.startMinute).padStart(2, "0")}
              </div>

              {/* Original name */}
              <div className="text-xs font-medium truncate" title={row.name}>
                {row.name}
              </div>

              {/* Patient selector */}
              <div>
                {row.matchCandidates.length > 0 || row.matchedPatient ? (
                  <Select
                    value={row.matchedPatient?.id || "__none__"}
                    onValueChange={(val) => {
                      if (val === "__none__") {
                        onRowUpdate(row.id, { matchedPatient: null, matchStatus: "none", matchScore: 0 });
                      } else {
                        const p = patients.find(pt => pt.id === val);
                        if (p) onRowUpdate(row.id, { matchedPatient: p, matchStatus: "exact", matchScore: 100 });
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Selecionar paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-1">
                        <div className="flex items-center gap-1 px-1 pb-1">
                          <Search className="h-3 w-3 text-muted-foreground" />
                          <Input
                            className="h-6 text-xs border-0 shadow-none focus-visible:ring-0 p-0"
                            placeholder="Pesquisar..."
                            value={patientSearch[row.id] || ""}
                            onChange={(e) => setPatientSearch(prev => ({ ...prev, [row.id]: e.target.value }))}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <SelectItem value="__none__">— Nenhum —</SelectItem>
                      {/* Show candidates first */}
                      {row.matchCandidates.map(c => (
                        <SelectItem key={c.patient.id} value={c.patient.id}>
                          ⭐ {c.patient.full_name} ({c.score}%)
                        </SelectItem>
                      ))}
                      {/* Then filtered patients not in candidates */}
                      {getFilteredPatients(row.id)
                        .filter(p => !row.matchCandidates.some(c => c.patient.id === p.id))
                        .map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value="__none__"
                    onValueChange={(val) => {
                      if (val !== "__none__") {
                        const p = patients.find(pt => pt.id === val);
                        if (p) onRowUpdate(row.id, { matchedPatient: p, matchStatus: "exact", matchScore: 100, approved: true });
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs border-destructive">
                      <SelectValue placeholder="Selecionar paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-1">
                        <div className="flex items-center gap-1 px-1 pb-1">
                          <Search className="h-3 w-3 text-muted-foreground" />
                          <Input
                            className="h-6 text-xs border-0 shadow-none focus-visible:ring-0 p-0"
                            placeholder="Pesquisar..."
                            value={patientSearch[row.id] || ""}
                            onChange={(e) => setPatientSearch(prev => ({ ...prev, [row.id]: e.target.value }))}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <SelectItem value="__none__">— Nenhum —</SelectItem>
                      {getFilteredPatients(row.id).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Match score badge */}
              <div>{getMatchBadge(row)}</div>

              {/* Status icon */}
              <div className="flex justify-center">{getStatusIcon(row)}</div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
