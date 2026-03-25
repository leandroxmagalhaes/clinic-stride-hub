

## Painel Rápido — Side Panel for Agenda

Build a modular floating side panel ("Painel Rápido") with two tabs: "Lista de Espera" and "Lembretes & Notas", integrated into the existing Agenda page.

### Architecture

The panel will be a **standalone component** (`QuickPanel`) that receives data and callbacks via props, making it reusable for future integration. It will be composed of several sub-components for maintainability.

### Files to Create

1. **`src/components/agenda/quick-panel/types.ts`** — Shared types for WaitingPatient, Note, NoteType, Priority
2. **`src/components/agenda/quick-panel/QuickPanel.tsx`** — Main panel container (collapsed button + expanded panel, slide animation, tab switching)
3. **`src/components/agenda/quick-panel/QuickPanelButton.tsx`** — Collapsed state: fixed right-edge button with counters, urgency pulse animation
4. **`src/components/agenda/quick-panel/WaitingListTab.tsx`** — Tab 1: specialty filter chips, patient cards with priority sorting, inline delete confirmation
5. **`src/components/agenda/quick-panel/WaitingPatientCard.tsx`** — Individual patient card (colored border by wait time, priority badge, action buttons)
6. **`src/components/agenda/quick-panel/WaitingPatientForm.tsx`** — Add/edit patient form with phone mask (PT format), priority toggles
7. **`src/components/agenda/quick-panel/NotesTab.tsx`** — Tab 2: filter chips, note cards sorted (fixed → pending → done), inline delete
8. **`src/components/agenda/quick-panel/NoteCard.tsx`** — Individual note card (checkbox for tasks/reminders, strikethrough when done, deadline badges)
9. **`src/components/agenda/quick-panel/NoteForm.tsx`** — Add/edit note form with type toggle, conditional deadline field
10. **`src/components/agenda/quick-panel/mockData.ts`** — Initial mock data (6 patients + 6 notes as specified)

### File to Modify

**`src/pages/Agenda.tsx`** — Import and render `QuickPanel`. Add state management for waiting list and notes. When panel is open, add `mr-[380px]` transition to the main content area so it pushes rather than overlaps.

### Key Behaviors

- **Collapsed button**: Fixed right edge, two stacked counters (waiting list icon + notes icon), red badges for urgencies, 10-second pulse animation via CSS keyframes
- **Panel open/close**: 380px width, slide-in from right (CSS transition `transform`), white background with left shadow
- **Waiting list sorting**: Urgente → Alta → Normal, then by days waiting (descending)
- **Notes sorting**: Fixed notes first → uncompleted → completed, then by recency
- **Phone mask**: Portuguese format (9 digits, displayed as `912 345 678`)
- **Inline delete confirmation**: Red background inside the card with "Sim"/"Não" buttons
- **Toast notifications**: Using existing `sonner` toast system already in the project
- **Content push**: When panel opens, Agenda content gets a right margin transition so nothing is hidden behind the panel

### Technical Notes

- All state is local (`useState`) — no database integration needed yet
- Uses Lucide React for all action icons, emojis only for note type indicators (☐, 🔔, 📌)
- Uses existing Tailwind config and shadcn/ui components (Input, Select, Textarea, Button)
- Inter font is already available in the project

