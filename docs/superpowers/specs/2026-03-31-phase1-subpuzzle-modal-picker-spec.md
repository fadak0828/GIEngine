# Phase 1 UI Design Spec: SubPuzzle Modal + Smart Pickers

**Date**: 2026-03-31
**Status**: Ready for implementation
**Scope**: Editor Phase 1 UI refinements for SubPuzzle editing, image/word pickers, and layer ordering feedback
**Source of truth**: `DESIGN.md` (Warm Industrial system)

---

## 1. Design System Alignment

Use the existing tokens from `DESIGN.md` for all new UI in this spec.

- Typography
  - Body and controls: DM Sans, 12-13px
  - Section labels: 11px uppercase, 0.08em letter spacing, weight 700
  - IDs and code-like values: JetBrains Mono, 11px
- Colors
  - Surfaces: `var(--bg-primary)`, `var(--bg-card)`, `var(--bg-panel)`
  - Borders: `var(--border-color)`, focus/active: `var(--accent)`
  - Text: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`
  - Error and broken reference states: `var(--danger)`
- Spacing (4px scale)
  - Item gap: 4-8px
  - Section gap: 12-16px
  - Panel padding: 12-16px
- Radius
  - Inputs/chips: 3px
  - Cards/buttons/dropdowns: 4-6px
  - Modal container: 10px

---

## 2. SubPuzzle Modal Layout Spec

### 2.1 Modal shell

- Entry point: Case Properties -> "SubPuzzle Edit"
- Modal size
  - `min-width: 640px`
  - `width: clamp(640px, 78vw, 900px)`
  - `max-width: 900px`
  - `max-height: 80vh`
- Modal container
  - Background: `var(--bg-panel)`
  - Border: `1px solid var(--border-color)`
  - Radius: 10px
  - Shadow: `0 16px 40px rgba(0,0,0,0.45)`
  - Internal layout: header / body / footer with body scroll (`overflow-y: auto`)
- Header
  - Left: puzzle type icon + localized title
  - Right: type badge + close action
- Footer
  - Primary action (save/apply): filled `var(--accent)`
  - Secondary action (cancel): outline `var(--border-color)`

### 2.2 Common body rules

- Body padding: 16px
- Section spacing: 16px between major blocks, 8px between controls
- Section labels: uppercase 11px muted style
- Card blocks: `var(--bg-primary)`, 1px border, 4px radius, 8px internal padding

### 2.3 Type-specific editor layouts

#### A. `character_id` (2-column grid: portrait | name/answer)

- Grid per character row
  - `grid-template-columns: 160px 1fr`
  - Gap: 12px
- Left column
  - Portrait input via ImageAssetPicker
  - Preview area uses 4:5 style box, min height 160px
- Right column
  - Read-only generated slot ID (mono 11px muted)
  - Answer selector (WordDropdown single-select)
  - Remove row action aligned bottom-right

#### B. `timeline` (left-right split: slots | answer assignment)

- Root split
  - `grid-template-columns: minmax(220px, 42%) 1fr`
  - Gap: 16px
- Left pane
  - Slot list with slot labels, add/remove controls
- Right pane
  - Selected slot details
  - Answer assignment uses single-select dropdown
- Empty slot state
  - Message card with muted text and add-slot CTA

#### C. `relationship` (2 split: nodes | edges)

- Root split
  - `grid-template-columns: 1fr 1fr`
  - Gap: 16px
- Nodes pane
  - Node list cards (label + optional portrait)
- Edges pane
  - From/to node selectors
  - Read-only slot ID + answer selector
- Empty state behavior
  - If no nodes: edge controls disabled + hint text

#### D. `scenario` (existing key-value style retained)

- Keep current key-value style editing pattern
- Improve hierarchy only
  - Group each answer entry as a card
  - Slot key (left) and correct word (right)
  - Add/remove controls pinned to each card footer

---

## 3. ImageAssetPicker Design Spec

### 3.1 Component structure

- Trigger field
  - Shows selected thumbnail + asset ID when selected
  - Placeholder text when empty
- Dropdown panel
  - Relative to trigger wrapper (`position: relative` parent)
  - Panel defaults below trigger; if not enough viewport space, opens upward

### 3.2 Grid and item sizing

- Thumbnail grid
  - `grid-template-columns: repeat(auto-fill, minmax(40px, 1fr))`
  - Cell image: `40x40`, `object-fit: cover`, radius 2px
  - Grid max height: 240px, scrollable
- Selected item style
  - Border: `2px solid var(--accent)`
  - Background remains neutral (no heavy fill)
- Unselected item style
  - Border: `1px solid var(--border-color)`
  - Hover border: `var(--border-light)`

### 3.3 States

- Default/empty
  - Text: "No image asset selected"
  - CTA: upload button
- Uploading
  - Upload button disabled
  - Label: "Uploading..."
  - Apply `opacity: 0.6` and `pointer-events: none` on upload controls
- Upload error
  - Container border switches to `var(--danger)`
  - Inline error text in `var(--danger)` at 11px
- Broken thumbnail source
  - Replace image with neutral placeholder tile
  - Keep item selectable and show asset ID tooltip

---

## 4. WordDropdown Single-Select Spec

### 4.1 Interaction model

- Mode flag: `singleSelect`
- One value only
  - Selecting a new option replaces previous value
  - Dropdown closes immediately after selection
- Clear action
  - Inline clear button on selected chip

### 4.2 Selected chip style

- Background: `transparent`
- Border: `1px solid var(--accent)`
- Text: `var(--text-primary)`
- Radius: 3px
- Padding: `2px 6px`

### 4.3 Warning and empty states

- Dangling reference (selected ID not in current case words)
  - Border and text switch to `var(--danger)`
  - Helper line: "Referenced word no longer exists in this case"
- Empty value
  - Placeholder: "Select a word..."
  - Empty helper card with CTA button to open Word Manager

---

## 5. LayerPanel DnD Visual Spec

### 5.1 Row layout

- Row height target: 32-36px
- Left-to-right order
  - Drag handle
  - Thumbnail (`24x24`, radius 2px)
  - Visibility toggle
  - Layer name (truncate)
  - z-index badge
  - Remove action

### 5.2 Drag feedback

- Dragging row
  - `opacity: 0.45`
  - Cursor: `grabbing`
- Drop target row
  - `1px solid var(--accent)` outline
  - `background: var(--selection-bg)` light tint
- Non-target rows during drag
  - Keep neutral background to reduce visual noise

### 5.3 Thumbnail rules

- If layer has image: show 24x24 asset thumbnail (`object-fit: cover`)
- If missing image: fallback checker/placeholder tile in neutral tones

---

## 6. Acceptance Checklist

- [ ] SubPuzzle modal uses 640-900px width and max-height 80vh
- [ ] All 4 puzzle types follow the specified layout patterns
- [ ] ImageAssetPicker grid uses 40x40 cells with selected/uploading/error states
- [ ] WordDropdown single-select chip uses accent border and supports dangling-ref warning via `var(--danger)`
- [ ] LayerPanel rows include 24x24 thumbnails with clear drag/drop target feedback
- [ ] All colors/spacing/typography/radius decisions map to `DESIGN.md` tokens

---

## 7. Implementation Targets

- `packages/editor/src/components/properties/SubPuzzleModal.tsx` (new)
- `packages/editor/src/components/properties/CaseProperties.tsx` (open modal entry and handoff)
- `packages/editor/src/components/shared/ImageAssetPicker.tsx` (new)
- `packages/editor/src/components/words/WordDropdown.tsx` (single-select mode)
- `packages/editor/src/components/layers/LayerPanel.tsx` (DnD feedback and thumbnail consistency)

