

# Simplificar Relatório Clínico - Texto Livre

## Situação Atual

O formulário de relatório clínico tem **6 campos separados** na tab "Conteúdo Clínico":

| Campo | Linhas |
|-------|--------|
| Diagnóstico Clínico | 3 |
| Objetivo do Tratamento | 3 |
| Evolução do Paciente | 6 |
| Resultados Obtidos | 3 |
| Recomendações | 3 |
| Observações | 2 |

O PDF gera secções com títulos para cada campo preenchido.

---

## Proposta

Substituir os 6 campos por **um único campo de texto livre** chamado "Conteúdo do Relatório", dando total flexibilidade ao profissional para estruturar como preferir.

---

## Implementação

### 1. Modificar: `src/components/prontuarios/NewClinicalReportModal.tsx`

**Simplificar estado do formulário:**
```typescript
// De 6 estados separados:
// diagnosticoClinico, objetivoTratamento, evolucaoPaciente, 
// resultadosObtidos, recomendacoes, observacoes

// Para 1 único:
const [conteudo, setConteudo] = useState("");
```

**Simplificar Tab "Conteúdo Clínico":**
```tsx
<TabsContent value="conteudo" className="space-y-4 mt-0">
  <div className="flex items-center justify-between mb-2">
    <Label htmlFor="conteudo">Conteúdo do Relatório</Label>
    <Button variant="outline" size="sm" onClick={handleImportEvolutions}>
      <Import className="h-4 w-4 mr-2" />
      Importar Evoluções
    </Button>
  </div>
  <Textarea
    id="conteudo"
    value={conteudo}
    onChange={(e) => setConteudo(e.target.value)}
    placeholder="Escreva livremente o conteúdo do relatório clínico..."
    rows={15}
    className="min-h-[300px]"
  />
</TabsContent>
```

### 2. Modificar: `src/services/ClinicalReportService.ts`

Adicionar novo campo `conteudo` às interfaces (mantendo os antigos para retrocompatibilidade):

```typescript
export interface ClinicalReport {
  // ... campos existentes
  conteudo?: string | null;  // Novo campo de texto livre
}
```

### 3. Modificar: `src/components/prontuarios/ClinicalReportPDF.ts`

**Simplificar geração do PDF:**

```typescript
// Se tiver conteúdo livre, usa apenas ele
if (report.conteudo) {
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  yPos = addWrappedText(report.conteudo, margin, yPos, contentWidth, 5);
} else {
  // Fallback para campos antigos (retrocompatibilidade)
  const sections = [
    { title: "DIAGNÓSTICO CLÍNICO", content: report.diagnostico_clinico },
    // ... demais campos
  ];
  // ... renderização por secções
}
```

### 4. Migração de Banco de Dados

Adicionar nova coluna à tabela `relatorios_clinicos`:

```sql
ALTER TABLE relatorios_clinicos 
ADD COLUMN conteudo TEXT;
```

---

## Resultado Visual

```text
┌─────────────────────────────────────────────────────────────┐
│  Tab: Conteúdo Clínico                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Conteúdo do Relatório        [Importar Evoluções]          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │  O paciente apresentou-se com queixa de dor        │    │
│  │  lombar há 3 meses. Após avaliação inicial,        │    │
│  │  iniciamos protocolo de tratamento com foco        │    │
│  │  em fortalecimento de core e mobilidade.           │    │
│  │                                                     │    │
│  │  Ao longo das 12 sessões realizadas, observamos    │    │
│  │  melhora progressiva da dor (8/10 → 2/10) e        │    │
│  │  ganho funcional significativo.                    │    │
│  │                                                     │    │
│  │  Recomendamos continuidade dos exercícios          │    │
│  │  domiciliares e reavaliação em 3 meses.            │    │
│  │                                                     │    │
│  │                                                     │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `NewClinicalReportModal.tsx` | Substituir 6 campos por 1 textarea grande |
| `ClinicalReportService.ts` | Adicionar campo `conteudo` às interfaces |
| `ClinicalReportPDF.ts` | Usar texto livre ou fallback para campos antigos |
| Nova migração SQL | Adicionar coluna `conteudo` |

---

## Retrocompatibilidade

- Relatórios antigos continuam funcionando (usam campos separados)
- Novos relatórios usam o campo único
- PDF detecta automaticamente qual formato usar

---

## Resumo Técnico

| Aspecto | Valor |
|---------|-------|
| Complexidade | Baixa-Média |
| Arquivos modificados | 3 |
| Nova migração | 1 (adicionar coluna) |
| Risco | Baixo (retrocompatível) |

