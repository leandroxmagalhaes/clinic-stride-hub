

# Recriar PackManagerModal.tsx como stub + corrigir erros de build

## Problema

Existem 3 erros de build:
1. `SessionManagementModal` exportada como default mas importada como named export em 2 ficheiros
2. `Dashboard.tsx` passa prop `getCreditBalance` que nao existe em `NewSessionModalProps`
3. O utilizador quer tambem recriar `PackManagerModal.tsx` como stub vazio

## Plano

### 1. Recriar `src/components/agenda/PackManagerModal.tsx`
Substituir o conteudo actual por apenas:
```tsx
export function PackManagerModal() { return null; }
```

### 2. Corrigir import de SessionManagementModal
Preciso verificar como esta exportado actualmente e alinhar os imports.

### 3. Corrigir Dashboard.tsx
Remover a prop `getCreditBalance` que nao existe no tipo `NewSessionModalProps`.

Vou verificar os ficheiros para confirmar as correcoes exactas.

