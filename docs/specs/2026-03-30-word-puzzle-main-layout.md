# Spec: Word Manager & Puzzle Editor as Full Main-Area Panels

**Date**: 2026-03-30
**Feature ID**: word-puzzle-main-layout
**Status**: Draft
**Requested by**: User (Korean UX request — "단어 목록과 퍼즐 편집 UI 개선")

---

## 1. Problem Statement

### Current situation

The GIEngine Editor uses a three-column layout:

```
┌──────────────┬──────────────────────────────┬───────────────────┐
│  ProjectTree │      CENTER (main area)       │  PropertiesPanel  │
│   (260 px)   │                               │     (320 px)      │
│              │  SceneCanvas  or              │                   │
│              │  PuzzleEditorPanel            │  CaseProperties   │
│              │                               │  ↳ WordVocab      │
│              │                               │    Panel (TINY)   │
│              │                               │  [퍼즐 편집 열기]  │
└──────────────┴──────────────────────────────┴───────────────────┘
```

**WordVocabularyPanel** (`CaseProperties.tsx` line 123) is embedded inside the right properties sidebar (320 px wide). It is a cramped vertical list — no search, no category filter, no bulk actions, no visual indication of hotspot connections beyond a small count badge.

**PuzzleEditorPanel** (`activePanel === 'puzzle'` → center column) already occupies the main area when active, but its internal layout was designed for a narrow column: small font sizes (11–12 px), single-column form layout, no drag-and-drop segment builder, no live preview of the assembled question.

### Impact

- Editors cannot efficiently manage large word vocabularies (10–60+ words per case) in a 320 px column.
- The Puzzle Template Editor and Answer Key Editor are difficult to use because the surrounding chrome is cramped and context (word list, live preview) is not visible.
- The workflow between Word Management and Puzzle Editing requires context-switching via the "퍼즐 편집 열기" button buried at the bottom of the properties panel after scrolling through case metadata.

---

## 2. User Stories

**US-1 — Word Manager as primary workspace**
As a content editor, when I select a Case in the project tree, I want to open a full-screen Word Manager panel (same size as the Scene Canvas) so that I can see, search, and edit all words for that case without cramped columns or scrolling.

**US-2 — Search and filter words**
As a content editor, I want to filter the word list by category (인물, 사건, 물건, 단서, 기타) and search by keyword so that I can quickly locate a specific word in a large vocabulary.

**US-3 — Inline word editing**
As a content editor, I want to click any word row to expand it for inline editing (KO/EN text, category, hint, image) without opening a separate modal so that my flow is not interrupted.

**US-4 — Hotspot connection map**
As a level designer, I want to see which hotspots in each scene reference each word (via `word_reveal` actions), shown as scene/hotspot chip tags on each word row, so that I can spot unconnected words before publishing.

**US-5 — Spacious Puzzle Editor**
As a puzzle designer, I want the Puzzle Editor to use the full main-area width so that the segment builder, live question preview, and answer slot picker are visible simultaneously without scrolling.

**US-6 — Fluid navigation between panels**
As an editor, I want a persistent tab bar in the main area header that lets me switch between Scene Canvas, Word Manager, and Puzzle Editor with a single click, and I want the correct panel to open automatically when I select a Case or click the existing "퍼즐 편집 열기" trigger.

---

## 3. Feature Scope

### IN scope

| # | Item |
|---|------|
| 1 | New `WordManagerPanel` component — full-width main-area replacement for `WordVocabularyPanel` |
| 2 | Category filter tabs + keyword search bar in Word Manager |
| 3 | Inline expandable row editing in Word Manager |
| 4 | Hotspot connection visualization per word row (scene/hotspot chip tags) |
| 5 | Bulk select + bulk delete in Word Manager |
| 6 | "Add Word" affordance in Word Manager (retains existing `WordAddForm` logic) |
| 7 | Redesigned `PuzzleEditorPanel` layout optimised for the full main area |
| 8 | Live question preview pane alongside the segment builder |
| 9 | Persistent main-area tab bar: "씬" / "단어" / "퍼즐" |
| 10 | `ActivePanel` enum addition: `'words'` already exists in the store — wire it up |
| 11 | Auto-activate `'words'` panel when a Case node is selected in the ProjectTree |
| 12 | Auto-activate `'puzzle'` panel when "퍼즐 편집 열기" is clicked (existing behavior, preserve) |
| 13 | Store changes: no new state fields required; `setActivePanel('words')` and `setActivePanel('puzzle')` already exist |

### OUT of scope

| # | Item | Reason |
|---|------|--------|
| 1 | Drag-and-drop reordering of words | Lower priority; can be added in a follow-up |
| 2 | Word import/export (CSV, XLSX) | Separate feature request |
| 3 | Sub-puzzle editors (character_id, timeline, scenario, relationship) | They require their own design pass |
| 4 | Global word library shared across cases | Architecture change; out of current sprint |
| 5 | Changes to ProjectTree, Toolbar, or left panel widths | Not in scope |
| 6 | Right PropertiesPanel layout changes when word/puzzle panels are active | Simplest approach: keep right panel visible (it shows case/hotspot meta) |

---

## 4. UI / UX Description

### 4.1 Overall layout (unchanged chrome)

```
┌────────────────────────────────────────────────────────────────────┐
│  Toolbar (48 px)  — unchanged                                       │
├──────────────────┬─────────────────────────────────┬───────────────┤
│  ProjectTree     │  MAIN AREA (flex: 1)             │  Properties   │
│  (260 px)        │                                  │  Panel        │
│                  │  ┌──────────────────────────┐   │  (320 px)     │
│                  │  │  Tab bar (36 px)          │   │               │
│                  │  │  [씬] [단어] [퍼즐]        │   │  (unchanged)  │
│                  │  ├──────────────────────────┤   │               │
│                  │  │                          │   │               │
│                  │  │  Panel content           │   │               │
│                  │  │  (fills remaining height) │   │               │
│                  │  │                          │   │               │
│                  │  └──────────────────────────┘   │               │
│                  │  PreviewPane (collapsible)       │               │
└──────────────────┴─────────────────────────────────┴───────────────┘
```

The only structural change to `MainLayout.tsx` is adding the **tab bar** inside the center column and routing the three panels through it.

### 4.2 Main-area tab bar

```
┌──────────────────────────────────────────────────────────────────┐
│  [ 씬 편집 ]   [ 단어 관리  12 ]   [ 퍼즐 편집 ]                    │
│      ▲ active tab has amber underline and full-weight text         │
└──────────────────────────────────────────────────────────────────┘
```

- Height: 36 px, `background: var(--bg-secondary)`, `border-bottom: 1px solid var(--border-color)`
- Three tabs: "씬 편집", "단어 관리 {count badge}", "퍼즐 편집"
- Active tab: `color: var(--accent)`, `border-bottom: 2px solid var(--accent)` (raised from panel background)
- Tabs are always visible; clicking "단어 관리" when no case is selected shows an empty-state prompt
- Word count badge on "단어 관리" tab reflects the count for the currently selected case (0 when no case)

### 4.3 Word Manager Panel (`WordManagerPanel`)

**Full-width layout (three zones, horizontal split)**

```
┌───────────────────────────────────────────────────────────────────┐
│ HEADER ROW                                                         │
│  [ 🔍  단어 검색...              ]  [+ 단어 추가]  [☑ 일괄 선택]   │
│  [전체] [인물] [사건] [물건] [단서] [기타]   ← category filter tabs │
├───────────────────────────────────────────────────────────────────┤
│ WORD TABLE (scrollable, flex: 1)                                   │
│  ┌──────┬──────────────────┬──────┬──────────────┬──────────────┐ │
│  │  □   │  단어 (KO / EN)  │ 카테 │  힌트 미리보기 │ 연결된 핫스팟  │ │
│  ├──────┼──────────────────┼──────┼──────────────┼──────────────┤ │
│  │  □   │ 홍길동 / Hong GD  │ 인물  │ "의문의 용의자" │ [씬1·H2][씬2·H1] │
│  │      │   ▼ expanded row (inline editor)                      │ │
│  │      │   KO: [__________]  EN: [__________]                 │ │
│  │      │   카테고리: [▾인물]   힌트: [________________]         │ │
│  │      │   이미지 URL: [________________________________] [삭제] │ │
│  ├──────┼──────────────────┼──────┼──────────────┼──────────────┤ │
│  │  □   │ 청동 열쇠 / Bronze Key │ 물건 │ "잠겨진 서랍" │ [씬1·H5]     │ │
│  └──────┴──────────────────┴──────┴──────────────┴──────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│ FOOTER (shown when rows selected)                                  │
│  선택된 3개  [선택 삭제]  [선택 해제]                                │
└───────────────────────────────────────────────────────────────────┘
```

**Column definitions**

| Column | Width | Notes |
|--------|-------|-------|
| Checkbox | 40 px | Bulk select |
| 단어 (KO/EN) | flex: 2 | Primary: KO text, Secondary: EN text in muted style |
| 카테고리 | 80 px | Color-coded chip |
| 힌트 미리보기 | flex: 1 | Truncated to 1 line, muted |
| 연결된 핫스팟 | flex: 1 | Chips: `[씬 이름 · 핫스팟 이름]`; "미연결" in red if 0 |
| 액션 | 60 px | Edit icon (opens inline), Delete icon |

**Row expansion** — clicking the Edit icon (or the row itself) toggles an inline expanded section beneath the row. No modal, no navigation.

**Category filter tabs** — horizontal pill tabs: 전체 / 인물 / 사건 / 물건 / 단서 / 기타. Each shows item count.

**Empty state** — When no case is selected: centered illustration + "사건을 선택하면 단어 목록이 표시됩니다." When case is selected but has no words: "단어가 없습니다. + 단어 추가 버튼을 눌러 시작하세요."

### 4.4 Puzzle Editor Panel (redesigned)

**Two-column layout (segment builder left, preview + answers right)**

```
┌─────────────────────────────────┬──────────────────────────────────┐
│  LEFT: SEGMENT BUILDER          │  RIGHT: LIVE PREVIEW + ANSWERS    │
│  (flex: 1.2)                    │  (flex: 0.8)                      │
│                                 │                                    │
│  퍼즐 제목                        │  ┌──────────────────────────────┐  │
│  KO [__________________]        │  │  LIVE PREVIEW                │  │
│  EN [__________________]        │  │                              │  │
│                                 │  │  "홍___은 __에서 청동 열쇠를  │  │
│  퍼즐 템플릿                       │  │   발견했다."                 │  │
│  ┌───────────────────────────┐  │  │                              │  │
│  │  [텍스트] [빈칸] [텍스트]  │  │  │  (renders current template  │  │
│  │  ← drag chips to reorder  │  │  │   with answer slots shown   │  │
│  │                           │  │  │   as colored blanks)        │  │
│  │  + 세그먼트 추가             │  │  └──────────────────────────────┘  │
│  │    [텍스트 세그먼트]          │  │                                    │
│  │    [빈칸 슬롯]               │  │  정답 슬롯 배정                      │
│  └───────────────────────────┘  │  ┌──────────────────────────────┐  │
│                                 │  │  슬롯 1:  [ 단어 선택 ▾ ]      │  │
│  AI 퍼즐 생성 (collapsible)       │  │  슬롯 2:  [ 단어 선택 ▾ ]      │  │
│  ▶ AI 생성 열기                   │  │  (word picker shows case     │  │
│                                 │  │   words with search)         │  │
│                                 │  └──────────────────────────────┘  │
└─────────────────────────────────┴──────────────────────────────────┘
```

Key improvements over the current design:

- **Two-column layout**: builder (left) and preview+answers (right) are visible simultaneously — no scrolling required for typical puzzle sizes.
- **Segment chips**: each template segment is a draggable chip (`[텍스트: "홍"]`, `[빈칸 #1]`) with a drag handle. Reordering via drag-and-drop replaces the current flat JSON editor.
- **Live preview**: rendered inside a styled box using the same visual language as the game's fill-in-blank display. Blank slots show `___` with a color coded by which answer word is assigned.
- **Word picker dropdown** in the answer slot section: searchable dropdown that lists `caseWords` — replaces the plain `<select>` in `AnswerKeyEditor`.
- **AI generator**: moved to a collapsible accordion at the bottom of the left column; retains `AIPuzzleGenerator` logic unchanged.
- Back navigation: "← 씬으로" button is removed; navigation is handled by the tab bar.

---

## 5. Navigation Model

### 5.1 Panel switching

`activePanel: ActivePanel` in `UIState` (already exists in `editor-store.ts`) drives what is rendered in the center column. The current two-way toggle (`'scene'` / `'puzzle'`) is extended to three values: `'scene'` / `'words'` / `'puzzle'`. (`'assets'` and `'settings'` remain reserved but are not part of this feature.)

```
ActivePanel = 'scene' | 'puzzle' | 'assets' | 'words' | 'settings'
```

The `'words'` value is already declared in the store (line 48 of `editor-store.ts`). Only the MainLayout center column and the tab bar need to handle it.

### 5.2 Auto-activation rules

| Trigger | Resulting activePanel |
|---------|-----------------------|
| User selects a **Case** node in ProjectTree | `'words'` |
| User selects a **Scene** node in ProjectTree | `'scene'` |
| User clicks **"퍼즐 편집 열기"** button (CaseProperties) | `'puzzle'` |
| User clicks a tab in the main-area tab bar | whichever tab was clicked |
| User opens a new project or loads a project | `'scene'` (default, unchanged) |

Auto-activation for Case selection is the only new side-effect. It is added to the `setSelection` action in the store, or alternatively triggered from `ProjectTree` via `setActivePanel('words')` after `setSelection({ caseId })`.

### 5.3 Panel routing in MainLayout

```
// Pseudocode for center column rendering
{ui.activePanel === 'words'  && <WordManagerPanel />}
{ui.activePanel === 'puzzle' && <PuzzleEditorPanel />}
{(ui.activePanel === 'scene' || ui.activePanel === 'assets' || ui.activePanel === 'settings') && <SceneCanvas />}
```

The `PreviewPane` remains below the center column regardless of active panel.

### 5.4 Tab bar state

Tab bar always shows all three tabs. The active tab reflects `ui.activePanel`:

- `'scene'` → "씬 편집" active
- `'words'` → "단어 관리" active
- `'puzzle'` → "퍼즐 편집" active

Word count badge on "단어 관리" tab: derived from `words.filter(w => w.caseId === selection.caseId).length`. Renders "0" when no case is selected.

---

## 6. Component Structure

```
packages/editor/src/components/
├── layout/
│   ├── MainLayout.tsx          (modified: add MainAreaTabBar, route 'words' panel)
│   └── MainAreaTabBar.tsx      (new: tab bar component)
├── words/
│   ├── WordManagerPanel.tsx    (new: full-area panel — replaces WordVocabularyPanel in main area)
│   ├── WordManagerTable.tsx    (new: table + filter + search)
│   ├── WordManagerRow.tsx      (new: expanded/collapsed row with inline editor)
│   ├── WordVocabularyPanel.tsx (KEEP unchanged — still rendered inside CaseProperties
│   │                            as the compact sidebar widget; OR remove if redundant)
│   ├── WordRow.tsx             (keep or deprecate depending on above decision)
│   ├── WordAddForm.tsx         (keep, reused by WordManagerPanel)
│   └── WordDropdown.tsx        (keep, used by AnswerKeyEditor)
└── puzzle/
    └── PuzzleEditorPanel.tsx   (modified: new two-column layout, keep sub-components)
```

> Decision point: `WordVocabularyPanel` in `CaseProperties` can either be kept as a compact summary (showing count + "단어 관리 열기" link) or removed entirely once `WordManagerPanel` is live. This spec recommends keeping a minimal read-only summary in `CaseProperties` and making `WordManagerPanel` the primary editing surface.

---

## 7. Acceptance Criteria

### AC-1 Tab bar is rendered
- [ ] The main area header contains exactly three tabs: "씬 편집", "단어 관리", "퍼즐 편집"
- [ ] Clicking each tab changes `ui.activePanel` in the store and renders the correct panel
- [ ] The active tab has a visual active state (accent underline, bold text)
- [ ] The "단어 관리" tab badge shows the correct count for the selected case, or 0 when no case is selected

### AC-2 WordManagerPanel renders in main area
- [ ] `WordManagerPanel` fills the full center column (same bounding box as `SceneCanvas`)
- [ ] All words for `selection.caseId` are listed
- [ ] When no case is selected, an empty-state message is shown
- [ ] Font sizes are at minimum 13 px for primary content

### AC-3 Search and filter
- [ ] Typing in the search field filters word rows in real-time (case-insensitive match on KO and EN text)
- [ ] Clicking a category filter tab shows only words of that category; "전체" shows all
- [ ] Filter tabs show per-category counts

### AC-4 Inline row editing
- [ ] Clicking a word row's edit action expands an inline editor with KO, EN, category, hint, and image URL fields
- [ ] Changes are saved to the store on blur or on explicit Save button click
- [ ] Clicking the delete icon on a row shows a confirmation prompt and removes the word from the store

### AC-5 Hotspot connection chips
- [ ] Each word row displays chips identifying the scenes and hotspot names that reference it via `word_reveal`
- [ ] A word with zero connections shows "미연결" in red
- [ ] Chip data is derived from `caseScenes` (same logic as existing `connectionMap` in `WordVocabularyPanel`)

### AC-6 Bulk actions
- [ ] Selecting checkboxes and clicking "선택 삭제" removes all selected words after a confirmation prompt
- [ ] "전체 선택" / "선택 해제" controls work correctly

### AC-7 PuzzleEditorPanel layout
- [ ] When `activePanel === 'puzzle'`, the PuzzleEditorPanel renders in a two-column layout (builder | preview+answers)
- [ ] The live preview pane renders the assembled question text with blank slots visualised
- [ ] The answer slot word picker is a searchable dropdown showing only words from the current case
- [ ] The AI generator section is accessible via a collapsible accordion

### AC-8 Auto-activation
- [ ] Selecting a Case node in ProjectTree automatically sets `activePanel` to `'words'`
- [ ] Clicking "퍼즐 편집 열기" (in CaseProperties) sets `activePanel` to `'puzzle'` (existing behavior, must not regress)
- [ ] Selecting a Scene node in ProjectTree sets `activePanel` to `'scene'`

### AC-9 No regression
- [ ] `SceneCanvas` continues to work correctly when `activePanel === 'scene'`
- [ ] `PreviewPane` continues to render below the center column in all panel modes
- [ ] `PropertiesPanel` (right column) continues to show CaseProperties / SceneProperties / HotspotProperties based on selection
- [ ] All existing store actions (`addWord`, `updateWord`, `deleteWord`, `setActivePanel`, etc.) remain unchanged in signature

---

## 8. Open Questions

| # | Question | Decision needed by |
|---|----------|--------------------|
| Q1 | Should `WordVocabularyPanel` inside `CaseProperties` be replaced with a "단어 관리 열기" button, or kept as a read-only summary? | Engineering kickoff |
| Q2 | Should selecting a Case auto-navigate to `'words'` panel, or should the current `'scene'` default be preserved and the user clicks a tab? | UX review |
| Q3 | Does the two-column puzzle editor layout need a minimum viewport width breakpoint, or is the editor always assumed to run at ≥ 1280 px? | Engineering kickoff |
| Q4 | Should bulk-delete bypass the individual word validation (e.g., warn if a word is referenced by hotspots before deleting)? | Product review |

---

## 9. Technical Notes

- No new Zustand state keys are required. `activePanel: 'words'` is already declared in `ActivePanel` type (line 48, `editor-store.ts`).
- `WordManagerPanel` should accept `caseId` and `caseScenes` as props (same interface as `WordVocabularyPanel`) or derive them from the store via `selection.caseId`.
- The live preview in the redesigned `PuzzleEditorPanel` should reuse whatever rendering logic the preview/game runtime uses for `fill_in_blank` puzzles if such logic exists in `@gi-engine/core`; otherwise a simple text-construction pass is sufficient.
- Drag-and-drop for segment reordering in the Puzzle Editor can be implemented with the HTML5 Drag and Drop API (no external library dependency required) or a lightweight library already present in the monorepo.
- All styling must use existing CSS custom properties (`var(--bg-panel)`, `var(--accent)`, `var(--text-primary)`, etc.) to maintain theme consistency.
