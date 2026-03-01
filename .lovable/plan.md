

# Fix: Create missing EditEvolutionModal module

The build error indicates that `src/pages/Prontuarios.tsx` imports from `@/components/prontuarios/EditEvolutionModal`, but this file does not exist.

## Step

Create `src/components/prontuarios/EditEvolutionModal.tsx` with a minimal placeholder export (`export {};`) to resolve the TypeScript module resolution error immediately.

If the Prontuarios page actually uses a named export from this module (e.g., `EditEvolutionModal` component), we may need to add a proper stub component in a follow-up step.

