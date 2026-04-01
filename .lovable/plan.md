

## Adicionar botão Sair ao Portal do Paciente

Simple change to the header in `src/pages/PatientPortal.tsx`.

### Changes

**File: `src/pages/PatientPortal.tsx`**

1. Add `LogOut` to the lucide-react import (line 4)
2. Add `useNavigate` from react-router-dom (line 2)
3. Add `supabase` import if not present (already imported)
4. Add a logout button in the header (lines 279-285), next to the existing "Trocar" button

The header's right side will contain a flex group with the optional "Trocar" button and the new "Sair" button:
- Icon: `LogOut` from lucide-react
- Style: `text-slate-500 hover:text-red-500` transition
- On click: `supabase.auth.signOut()` then `navigate('/portal/login')`

### Technical Detail

The button goes inside the `justify-between` flex container, in a new `div` wrapping both the optional "Trocar" and the "Sair" button with `flex items-center gap-1`.

No other files are modified.

