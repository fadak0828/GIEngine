# Phase 3a UX Spec: Inner Hotspot Visual Editor

**Date**: 2026-04-01
**Status**: Ready for implementation
**Scope**: Add a visual editor for `examine_image` inner hotspots in the right properties panel
**Source of truth**: `DESIGN.md` (Warm Industrial system)

---

## 1. Goals

Replace the current numeric-only editing flow in `InnerHotspotEditor.tsx` with a visual authoring canvas that supports:

- Image preview from `examine_image.image`
- Rect overlay rendering for all inner hotspots (percentage-based coordinates)
- Drag-to-move
- Corner drag-to-resize
- Drag-to-create new hotspot
- Selection sync between overlay and property list
- Numeric fields retained for precise adjustments

---

## 2. Constraints and Non-Goals

### 2.1 Constraints

- Inner hotspot coordinates remain `%` based (`0..100`) to match runtime popup behavior.
- Phase 3a supports `rect` only for visual operations.
- Existing action editing (`word_reveal`, `examine`, `examine_image`) remains in the same panel flow.

### 2.2 Non-goals (Phase 3a)

- Polygon/circle editing for inner hotspots
- Zoom/pan of preview canvas
- Multi-select or marquee selection

---

## 3. Component Architecture

### 3.1 `HotspotProperties.tsx`

Update `examine_image` branch to pass image ref:

```tsx
<InnerHotspotEditor
  caseId={caseId}
  imageAssetRef={action.image}
  innerHotspots={action.innerHotspots ?? []}
  onChange={innerHotspots => onChange({ ...action, innerHotspots })}
/>
```

### 3.2 `InnerHotspotEditor.tsx`

Split into three sub-blocks:

- `InnerHotspotVisualCanvas`: Preview image + SVG overlay + draw/move/resize interactions
- `InnerHotspotList`: Existing expandable cards for action/details
- `InnerHotspotToolbar`: Tool mode buttons (`select`, `draw_rect`, `delete`) and quick hints

Recommended local UI state:

- `selectedInnerHotspotId: string | null`
- `tool: 'select' | 'draw_rect' | 'delete'`
- `interactionState` for pointer interaction session
- `draftHotspots: Hotspot[]` for transient drag/resize/draw preview

---

## 4. Layout Spec

### 4.1 Overall panel layout

- Container: `display: flex; flex-direction: column; gap: 8px`
- Order:
1. Label row (existing)
2. Visual editor card (new)
3. Hotspot list (existing, synced with selection)
4. Add button (existing fallback action)

### 4.2 Visual editor card

- Background: `var(--bg-primary)`
- Border: `1px solid var(--border-color)`
- Radius: `6px`
- Padding: `8px`
- Internal structure:
1. Toolbar row (height ~28)
2. Canvas area (`aspect-ratio: 16 / 9`, min-height 180px)
3. Footer hint line (11px muted)

### 4.3 Image preview states

- Valid asset ref: render image in `img` with `object-fit: contain`, absolute fill.
- Missing/invalid asset ref: show checker/neutral placeholder + message: "Select an image asset to edit inner hotspots visually."
- Keep numeric list enabled even when preview is unavailable.

---

## 5. Visual Style Spec

Use existing tokens from `DESIGN.md`.

- Unselected rect: fill `var(--hotspot-color)`, stroke `var(--accent)`, stroke width `1.5`, dash `4 2`.
- Selected rect: fill `var(--hotspot-selected)`, stroke `var(--selection)`, stroke width `2`.
- Resize handles (selected only): 8 handles, `8x8` px, fill `#fff`, stroke `var(--selection)`, directional resize cursors.
- Draw preview rect: fill `rgba(212, 150, 58, 0.20)`, dashed stroke `var(--accent)`.

---

## 6. Interaction Spec

### 6.1 Coordinate conversion

Use percentage mapping against rendered canvas content box:

- `xPx = (area.x / 100) * canvasWidth`
- `yPx = (area.y / 100) * canvasHeight`
- `wPx = (area.width / 100) * canvasWidth`
- `hPx = (area.height / 100) * canvasHeight`

Inverse conversion for pointer updates:

- `xPct = clamp((xPx / canvasWidth) * 100, 0, 100)`
- `yPct = clamp((yPx / canvasHeight) * 100, 0, 100)`

Use min size guard:

- `MIN_WIDTH_PCT = 2`
- `MIN_HEIGHT_PCT = 2`

### 6.2 Select

- Click rect selects hotspot.
- Selected hotspot card expands in list.
- Clicking list header selects corresponding overlay rect.

### 6.3 Move

- In `select` tool, pointer-down on selected/unselected rect starts move.
- During move, update `draftHotspots` only.
- On pointer-up, commit one `onChange(finalHotspots)`.

### 6.4 Resize

- Selected rect shows 8 handles.
- Pointer-down on handle enters directional resize mode.
- Clamp to image bounds and min size.
- Commit once on pointer-up.

### 6.5 Create (drag-to-draw)

- In `draw_rect` tool, drag on empty canvas creates preview rect.
- If final size `< 2%` width or height, discard.
- Else add new hotspot with defaults: `action: { type: 'word_reveal', wordIds: [] }`, `cursor: 'pointer'`, `ariaLabel: { ko: '', en: '' }`.
- Auto-select and auto-expand the newly created hotspot.

### 6.6 Delete tool behavior

- In `delete` tool, click rect removes it immediately.
- Confirm dialog is not required for Phase 3a (match fast editor flow).
- After delete, clear selection if deleted item was selected.

### 6.7 Numeric precision editing

- Keep existing `x/y/width/height` number inputs in list card.
- Input changes update hotspot immediately as today.
- Overlay should re-render in sync without mode reset.

---

## 7. History and Performance Rules

Current store updates push history for each `updateHotspotAction` path. To avoid flooding undo stack during drag:

- Do not call `onChange` on every pointer move.
- Keep pointer-move updates in local component state (`draftHotspots`).
- Call `onChange` once on interaction end (`pointerup` / `pointercancel`).

Expected result:

- One undo step per move/resize/create interaction
- Smooth dragging without heavy store churn

---

## 8. Accessibility and Input Semantics

- Keep each rect as focusable interactive element (`role="button"`, `tabIndex={0}`).
- `aria-label` fallback: `Inner hotspot {index + 1}` when localized label empty.
- Keyboard baseline for Phase 3a: `Enter` selects focused rect, `Delete/Backspace` removes selected rect.

(Mouse-first interaction remains primary for draw/resize.)

---

## 9. Implementation Targets

- `packages/editor/src/components/properties/HotspotProperties.tsx`
- `packages/editor/src/components/properties/InnerHotspotEditor.tsx`
- Optional extraction if file grows: `packages/editor/src/components/properties/inner-hotspot/InnerHotspotVisualCanvas.tsx`, `packages/editor/src/components/properties/inner-hotspot/inner-hotspot-geometry.ts`.

---

## 10. Acceptance Checklist

- [ ] `examine_image` action shows visual editor with toolbar and image preview
- [ ] Existing inner hotspots render as rect overlays at correct `%` positions
- [ ] User can drag to move a hotspot and commit on pointer-up
- [ ] User can resize selected hotspot via 8 handles
- [ ] User can drag on canvas to create a new hotspot
- [ ] Overlay selection and list expansion stay synchronized
- [ ] Numeric field edits still work for precise values
- [ ] Missing image asset state is handled without blocking list editing
- [ ] Undo stack does not create dozens of entries during one drag gesture
