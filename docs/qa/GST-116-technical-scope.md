# GST-116 Technical Scope: Productivity Keyboard Shortcuts

**Date:** 2026-04-10  
**Owner:** CTO (preliminary scoping)  
**Related:** Phase B-2 Workstream B (`docs/superpowers/plans/2026-04-01-phaseb2-editor-ux-improvements.md`)

---

## Overview

Implement a comprehensive keyboard shortcut system for the GI Editor to improve editor productivity. This covers:
- B1: Baseline consistency fix (`Ctrl/Cmd+N`)
- B2: Productivity shortcut set

---

## Technical Analysis

### Current State

The editor currently has some keyboard handling but no unified shortcut system. Looking at the codebase:

**Existing keyboard handling:**
- `useCanvasDrag` — mouse drag handling (not keyboard)
- `SceneCanvas.tsx` — canvas-level event handlers
- Various `onKeyDown` handlers scattered in components

**Missing infrastructure:**
- No centralized keyboard shortcut registry
- No conflict detection between shortcuts
- No text-input-agnostic shortcut firing
- No shortcut help overlay

### Implementation Approach

#### 1. Create Keyboard Shortcut Registry

**File:** `packages/editor/src/keyboard/shortcuts.ts`

```typescript
export type ShortcutScope = 'global' | 'canvas' | 'text';

export interface Shortcut {
  key: string;           // e.g., 'cmd+n', 'ctrl+shift+1'
  action: () => void;
  scope: ShortcutScope;
  description: string;
  when?: () => boolean;  // optional condition
}
```

#### 2. Create useKeyboardShortcuts Hook

**File:** `packages/editor/src/hooks/useKeyboardShortcuts.ts`

```typescript
export function useKeyboardShortcuts(shortcuts: Shortcut[], deps?: unknown[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if focus is on text input/textarea (unless scope is 'text')
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (!shortcuts.some(s => s.scope === 'text')) return;
        e.preventDefault();
      }
      // Match and execute shortcut
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, ...(deps || [])]);
}
```

#### 3. Shortcut Definitions

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Cmd/Ctrl+N` | New scene/case (matches toolbar label) | global |
| `Cmd/Ctrl+1-4` | Switch primary center tabs | global |
| `Alt+Left/Right` | Previous/next scene in selected case | canvas |
| `F2` | Rename selected tree node | canvas |
| `Delete` | Delete selected hotspot/layer/asset | canvas |
| `Cmd/Ctrl+?` or `Cmd/Ctrl+/` | Open shortcut help overlay | global |

#### 4. Shortcut Help Overlay

**File:** `packages/editor/src/components/help/ShortcutOverlay.tsx`

- Modal or popover listing all shortcuts
- Grouped by scope (Global, Canvas)
- Keyboard-friendly dismissal (Escape)

---

## File Changes

### New Files
- `packages/editor/src/keyboard/shortcuts.ts` — shortcut registry types
- `packages/editor/src/hooks/useKeyboardShortcuts.ts` — React hook
- `packages/editor/src/components/help/ShortcutOverlay.tsx` — help UI

### Modified Files
- `packages/editor/src/components/layout/MainLayout.tsx` — register global shortcuts
- `packages/editor/src/components/scene/SceneCanvas.tsx` — register canvas shortcuts
- `packages/editor/src/components/tree/ProjectTree.tsx` — F2 rename handler
- `packages/editor/src/components/properties/PropertiesPanel.tsx` — Delete handler

---

## Implementation Order

1. **Step 1:** Create `shortcuts.ts` and `useKeyboardShortcuts.ts`
2. **Step 2:** Implement `ShortcutOverlay.tsx`
3. **Step 3:** Add `Cmd/Ctrl+N` fix (B1 baseline consistency)
4. **Step 4:** Add tab switching shortcuts (`Cmd/Ctrl+1-4`)
5. **Step 5:** Add navigation shortcuts (`Alt+Left/Right`)
6. **Step 6:** Add F2 rename
7. **Step 7:** Add Delete with confirmation
8. **Step 8:** Wire up `ShortcutOverlay` toggle

---

## Edge Cases

1. **Text input focus:** Shortcuts should NOT fire when user is typing in input/textarea
2. **Conflict detection:** If two shortcuts have same key combination, warn in console
3. **Browser default:** Some shortcuts have browser defaults (e.g., `Cmd+T` for new tab) — need `e.preventDefault()`
4. **macOS Cmd vs Windows Ctrl:** Use platform detection or allow both

---

## Test Plan

1. Unit test shortcut registry and matching logic
2. Integration test: verify shortcuts fire/not-fire based on focus
3. E2E test: create scene with `Cmd+N`, switch tabs with `Cmd+1-4`

---

## Acceptance Criteria

- [ ] `Cmd/Ctrl+N` creates new scene (matches toolbar label)
- [ ] `Cmd/Ctrl+1-4` switches between center tabs
- [ ] `Alt+Left/Right` navigates scenes when canvas has focus
- [ ] `F2` enters rename mode on selected tree node
- [ ] `Delete` shows confirmation dialog before deleting
- [ ] `Cmd/Ctrl+?` opens shortcut help overlay
- [ ] Shortcuts do NOT fire when input/textarea has focus
- [ ] All shortcuts are documented in the help overlay
