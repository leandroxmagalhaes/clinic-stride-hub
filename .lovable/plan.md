

# Fix AppSidebar.tsx duplicated content

## Problem
`AppSidebar.tsx` has its entire content duplicated starting at line 306. Lines 1-305 contain the correct, complete component (including `Wind` import, `clinicNavItems` array, and Clínica sidebar group). Lines 306-578 are a broken duplicate that causes the build errors.

## App.tsx
Already correct — has `RelatorioResp` lazy import (line 52) and the route (visible in the existing code). No changes needed.

## Plan

### 1. Remove duplicate content from `AppSidebar.tsx`
Delete lines 306-578 (the duplicated code after the closing `}` of the component on line 305). This leaves the complete, working file with all the requested additions already in place:
- `Wind` in the lucide-react import (line 29)
- `clinicNavItems` array (lines 135-137)  
- Clínica sidebar group (lines 231-243)

No other files need modification.

