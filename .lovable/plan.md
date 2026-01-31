
# Corrigir Problema: Tab Relatórios Não Aparece em Produção

## Problema Identificado

A aba **Relatórios** não mostra conteúdo no navegador externo porque o componente `ClinicalReportsList` está condicionado à existência de `clinicInfo`:

```tsx
// Linha 560-573 de Prontuarios.tsx
<TabsContent value="relatorios">
  {clinicInfo && (      // ← O problema está aqui!
    <ClinicalReportsList ... />
  )}
</TabsContent>
```

### Por que funciona no Lovable e não no navegador externo?

1. **Logs de Console**: Foi detectado um erro `AuthApiError: Invalid Refresh Token` 
2. O hook `useClinicInfo` depende de autenticação para buscar dados da clínica
3. Se houver qualquer problema de autenticação ou se a query ainda estiver carregando, `clinicInfo` será `undefined`
4. Quando `clinicInfo` é `undefined`, **nada é renderizado na tab**

No ambiente Lovable, a sessão pode estar mais estável. No navegador externo, tokens expirados ou problemas de sincronização causam falhas.

---

## Solução

Remover a renderização condicional baseada em `clinicInfo` e sempre mostrar o componente. O `clinicInfo` deve ser tratado como opcional dentro do `ClinicalReportsList`.

---

## Implementação

### 1. Modificar: `src/pages/Prontuarios.tsx`

**De:**
```tsx
<TabsContent value="relatorios">
  {clinicInfo && (
    <ClinicalReportsList
      patientId={selectedProntuario.paciente_id}
      prontuarioId={selectedProntuario.id}
      clinicId={selectedProntuario.clinic_id}
      clinicInfo={{
        name: clinicInfo.name,
        address: clinicInfo.address || undefined,
        phone: clinicInfo.phone || undefined,
        email: clinicInfo.email || undefined,
      }}
    />
  )}
</TabsContent>
```

**Para:**
```tsx
<TabsContent value="relatorios">
  <ClinicalReportsList
    patientId={selectedProntuario.paciente_id}
    prontuarioId={selectedProntuario.id}
    clinicId={selectedProntuario.clinic_id}
    clinicInfo={clinicInfo ? {
      name: clinicInfo.name,
      address: clinicInfo.address || undefined,
      phone: clinicInfo.phone || undefined,
      email: clinicInfo.email || undefined,
    } : undefined}
  />
</TabsContent>
```

### 2. O componente `ClinicalReportsList` já aceita `clinicInfo` como opcional

Na interface atual (linha 48-58):
```tsx
interface ClinicalReportsListProps {
  patientId: string;
  prontuarioId: string;
  clinicId: string;
  clinicInfo?: {  // ← Já é opcional!
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}
```

O PDF é gerado com ou sem `clinicInfo` - simplesmente não mostra dados da clínica no cabeçalho se não existir.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Prontuarios.tsx` | Remover condição `{clinicInfo && (...)}` da tab Relatórios |

---

## Resultado Esperado

```text
ANTES:
- Tab "Relatórios" vazia quando clinicInfo não carrega

DEPOIS:
- Tab "Relatórios" sempre mostra o componente ClinicalReportsList
- Se clinicInfo estiver disponível, PDF terá dados da clínica
- Se clinicInfo não estiver disponível, componente funciona normalmente
```

---

## Resumo Técnico

| Aspecto | Valor |
|---------|-------|
| Complexidade | Muito baixa |
| Arquivos modificados | 1 |
| Linhas alteradas | ~10 |
| Risco | Nenhum |
| Causa raiz | Renderização condicional desnecessária |
