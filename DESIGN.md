# Design System — GIEngine

## Product Context
- **What this is:** A desktop game editor for building Golden Idol-style detective/deduction puzzle games
- **Who it's for:** Game designers and creators who build investigation-style puzzle games
- **Space/industry:** Game development tools, narrative game editors (peers: Unity, Godot, Twine, RPG Maker, Ren'Py)
- **Project type:** Desktop web app (editor/authoring tool)
- **Note:** This design system covers the **editor** only. The runtime player has its own aesthetic (warm parchment/serif) defined in `packages/runtime/src/styles/main.css`.

## Aesthetic Direction
- **Direction:** Warm Industrial — a dimly-lit study where you craft mysteries
- **Decoration level:** Intentional — subtle warmth in surfaces, no textures or grain (textures are reserved for the runtime player)
- **Mood:** Professional and serious, but with warmth that connects the tool to the detective world it helps create. Not cold blue-gray like VS Code or Unity. Think warm leather and old wood tones.
- **Reference sites:** Godot Engine (editor layout), The Case of the Golden Idol (genre reference), Game UI Database (component patterns)

## Typography
- **Display/Headings:** Instrument Serif — elegant, editorial serif that links the editor to the detective genre without going full-period. Used sparingly for section headers and panel titles.
- **Body/UI:** DM Sans — clean geometric sans-serif. Good for dense UI, readable at small sizes, supports tabular numbers for data alignment.
- **UI Labels:** DM Sans at weight 500
- **Data/Tables:** DM Sans with `font-variant-numeric: tabular-nums` for aligned columns
- **Code/Monospace:** JetBrains Mono — for IDs, coordinates, and any code-like content
- **Loading:** Google Fonts CDN
  ```html
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  ```
- **Scale:**
  - Display: 36px / 28px / 24px (Instrument Serif)
  - Body: 15px / 14px / 13px (DM Sans)
  - Labels: 12px / 11px uppercase with 0.06-0.08em letter-spacing (DM Sans 500-600)
  - Code: 13px / 12px (JetBrains Mono)

## Color

### Dark Theme (default)
- **Approach:** Restrained warm palette — amber accent + warm neutrals
- **Background:** `--bg-primary: #151210` — warm near-black (replaces cold navy #0f0f1a)
- **Surface:** `--bg-secondary: #1e1a16` — warm dark brown
- **Panel:** `--bg-panel: #241f1a` — warm panel background
- **Card:** `--bg-card: #2c2620` — elevated surface
- **Border:** `--border-color: #3d352c` — warm border
- **Border Light:** `--border-light: #4d4438` — lighter border for hover/focus
- **Text Primary:** `--text-primary: #e8e0d4` — warm parchment white
- **Text Secondary:** `--text-secondary: #a89880` — parchment muted
- **Text Muted:** `--text-muted: #9c8c77` — warm gray for labels (WCAG AA compliant ≥4.5:1 on bg-primary)
- **Accent:** `--accent: #d4963a` — refined deep amber
- **Accent Hover:** `--accent-hover: #e0a84a` — lighter amber on hover
- **Accent Dim:** `--accent-dim: #5c3d14` — dark amber for backgrounds
- **Selection:** `--selection: #3b7dd4` — blue (universal, kept for familiarity)
- **Selection BG:** `--selection-bg: rgba(59, 125, 212, 0.2)`
- **Semantic:**
  - Success: `--success: #4a8c5c`
  - Warning/Partial: `--partial: #b89830`
  - Danger: `--danger: #c44040`
  - Info: blue selection color
- **Hotspot:** `--hotspot-color: rgba(212, 150, 58, 0.4)` / `--hotspot-selected: rgba(59, 125, 212, 0.6)`

### Light Theme
- **Strategy:** Invert to warm cream/parchment backgrounds with dark text
- **Background:** `#f5f0e8`
- **Surface:** `#ebe5db`
- **Panel:** `#e0d9cd`
- **Card:** `#f8f4ee`
- **Border:** `#c8bfb0`
- **Text Primary:** `#1a1612`
- **Text Secondary:** `#5c5040`
- **Text Muted:** `#8c8070`
- **Accent:** `#b87e28` (slightly deeper for light backgrounds)

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — dense enough for a professional tool, but not cramped
- **Scale:**
  - `2xs`: 2px
  - `xs`: 4px
  - `sm`: 8px
  - `md`: 12px
  - `lg`: 16px
  - `xl`: 24px
  - `2xl`: 32px
  - `3xl`: 48px

## Layout
- **Approach:** Grid-disciplined — classic 3-column editor layout
- **Structure:** Left sidebar (project tree, 180-240px) | Center (canvas/editor, flex) | Right sidebar (properties, 240-280px)
- **Top:** Toolbar (40px height) with brand, menu items, actions
- **Center tabs:** Tab bar (32px height) for switching between Scene Canvas, Puzzle Editor, Word Manager
- **Max content width:** Full viewport (editor fills screen)
- **Border radius:**
  - `sm`: 3px (inputs, small elements)
  - `md`: 6px (buttons, cards, dropdowns)
  - `lg`: 10px (modals, panels, large containers)
  - `full`: 9999px (pills, tags, badges)

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:**
  - micro: 50-100ms (color changes, opacity)
  - short: 150-200ms (hover states, focus rings, selection highlights)
  - medium: 200-300ms (panel resizes, dropdown opens, tab switches)
- **No decorative animation in the editor.** The tool should feel fast and responsive.

## Design Principles
1. **Warmth, not cold** — Every surface has warm brown undertones. No pure grays or blues for backgrounds.
2. **Genre connection** — The editor hints at the detective world through Instrument Serif headers and amber accents, without copying the runtime's parchment aesthetic.
3. **Professional density** — This is a serious tool. UI is compact but readable, not spacious marketing-style.
4. **Accent is rare** — Amber accent is used sparingly for important actions, active states, and the brand. Most UI is neutral.
5. **Parchment-tinted text** — Text colors have warm amber cast (#e8e0d4, not pure #ffffff). This ties the whole UI together.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-31 | Initial design system created | Created by /design-consultation based on product context and competitive research (Godot, Golden Idol, Twine, Game UI Database) |
| 2026-03-31 | Warm palette over cold navy | Connects editor to detective game world, differentiates from generic cold-themed editors |
| 2026-03-31 | Instrument Serif for display | Genre-appropriate serif gives editor unique identity without fighting body text readability |
| 2026-03-31 | DM Sans for body/UI | Clean geometric sans, good at small sizes, tabular numbers for data |
| 2026-03-31 | Editor-only scope | Runtime player keeps its own parchment/serif aesthetic in main.css |
