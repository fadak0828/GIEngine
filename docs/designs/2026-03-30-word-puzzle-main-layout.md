# Technical Design: word-puzzle-main-layout

**Date**: 2026-03-30
**Spec**: docs/specs/2026-03-30-word-puzzle-main-layout.md

---

## Executive Summary

Restructures the center column from a two-panel toggle (scene/puzzle) to a three-tab system (scene/words/puzzle). `ActivePanel = 'words'` already exists in the store — it just was never activated.

**Deliverables**:
1. `MainAreaTabBar` — 36px tab strip above center content
2. `WordManagerPanel` — full-area word management (replaces 320px sidebar widget)
3. `PuzzleEditorPanel` — redesigned two-column 60/40 layout
4. Minimal changes to `CaseProperties`, `MainLayout`, `ProjectTree`

---

## Implementation Order

1. `packages/core/src/models/types.ts` — add `hint?: LocalizedText`, `imageUrl?: string` to `Word`
2. `packages/editor/src/components/words/word-category-constants.ts` — NEW shared constants file
3. `packages/editor/src/components/words/WordRow.tsx` — import from shared constants
4. `packages/editor/src/components/words/WordAddForm.tsx` — import from shared constants
5. `packages/editor/src/components/layout/MainAreaTabBar.tsx` — NEW
6. `packages/editor/src/components/words/WordManagerRow.tsx` — NEW
7. `packages/editor/src/components/words/WordManagerPanel.tsx` — NEW
8. `packages/editor/src/components/puzzle/AnswerKeyEditor.tsx` — add SlotWordPicker
9. `packages/editor/src/components/puzzle/PuzzleEditorPanel.tsx` — two-column redesign
10. `packages/editor/src/components/properties/CaseProperties.tsx` — remove WordVocabularyPanel, add nav button
11. `packages/editor/src/components/layout/MainLayout.tsx` — add tab bar + words routing
12. `packages/editor/src/components/tree/ProjectTree.tsx` — auto-activate panels

---

## Component Specifications

### word-category-constants.ts (NEW)

Extract shared category data used across WordRow, WordAddForm, WordManagerPanel, WordManagerRow.

```typescript
import type { WordCategory } from '@gi-engine/core';
export const WORD_CATEGORIES: WordCategory[] = ['person','place','object','action','time','motive','evidence'];
export const CATEGORY_LABELS: Record<string, string> = {
  person:'인물', place:'장소', object:'사물', action:'행동', time:'시간', motive:'동기', evidence:'증거'
};
export const CATEGORY_COLORS: Record<string, string> = {
  person:'#3b82f6', place:'#10b981', object:'#f59e0b', action:'#ef4444',
  time:'#8b5cf6', motive:'#ec4899', evidence:'#6b7280'
};
```

---

### MainAreaTabBar (NEW)

**File**: `packages/editor/src/components/layout/MainAreaTabBar.tsx`

**Props**: none

**Store reads**:
```typescript
const activePanel = useEditorStore(s => s.ui.activePanel);
const wordCount = useEditorStore(s => {
  const caseId = s.selection.caseId;
  return caseId ? s.words.filter(w => w.caseId === caseId).length : 0;
});
const { setActivePanel } = useEditorStore();
```

**Tabs** (left to right):
- `씬 편집` → `setActivePanel('scene')` — active when `activePanel` is `'scene'|'assets'|'settings'`
- `단어 관리 {wordCount}` → `setActivePanel('words')` — active when `activePanel === 'words'`
- `퍼즐 편집` → `setActivePanel('puzzle')` — active when `activePanel === 'puzzle'`

**Styles** (inline):
- Container: `{ height: 36, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 4, flexShrink: 0, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }`
- Tab base: `{ padding: '0 14px', height: 36, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', background: 'transparent', border: 'none', borderBottom: '3px solid transparent', cursor: 'pointer' }`
- Tab active: `{ color: 'var(--accent)', fontWeight: 700, borderBottom: '3px solid var(--accent)' }`
- Badge: `{ fontSize: 10, fontWeight: 700, minWidth: 18, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '0 4px' }`

---

### WordManagerPanel (NEW)

**File**: `packages/editor/src/components/words/WordManagerPanel.tsx`

**Props**: none

**Store reads**: `project`, `words`, `selection.caseId`, `ui.editorLocale`, `addWord`, `deleteWord`

**Local state**:
```typescript
searchQuery: string          // '' default
activeCategory: WordCategory | 'all'  // 'all' default
isAddingWord: boolean        // false default
expandedWordId: string|null  // null default
selectedWordIds: Set<string> // empty Set default
```

**Derived data (all useMemo)**:
- `selectedCase`: traverse `project.acts` to find case with `caseId === selection.caseId`
- `caseWords`: `words.filter(w => w.caseId === selection.caseId)`
- `connectionMap`: `Record<wordId, { count: number; chips: {sceneName:string; hotspotName:string}[] }>` — same scan algorithm as WordVocabularyPanel but also stores chip metadata
- `categoryCounts`: `Record<WordCategory|'all', number>` — for filter pill badges
- `filteredWords`: caseWords filtered by searchQuery and activeCategory

**Layout** (flex column, height 100%, overflow hidden):
```
┌─────────────────────────────────────────────────────┐
│ HEADER (padding 12 16, borderBottom)                 │
│  "단어 관리 — {caseName}"   [＋ 단어 추가]             │
├─────────────────────────────────────────────────────┤
│ FILTER ROW (padding 8 16, borderBottom, gap 8)       │
│  [🔍 search input]  [전체][인물][장소][사물]...        │
├─────────────────────────────────────────────────────┤
│ ADD FORM AREA (conditional, padding 0 16 8)          │
│  <WordAddForm> when isAddingWord                     │
├─────────────────────────────────────────────────────┤
│ TABLE (flex:1, overflow auto)                        │
│  thead sticky — ☐ | 단어 | 카테고리 | 힌트 | 핫스팟 | │
│  <WordManagerRow> per filteredWord                   │
│  empty state when no filteredWords                   │
├─────────────────────────────────────────────────────┤
│ FOOTER (conditional: selectedWordIds.size > 0)       │
│  "선택된 N개  [선택 삭제]  [선택 해제]"                 │
└─────────────────────────────────────────────────────┘
```

**Table header** (`thead` sticky, `position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1`):
- fontSize 11, fontWeight 700, color var(--text-muted), textTransform uppercase, letterSpacing 0.08em
- Columns: `{ width: 40 }` | `{ flex: 2 }` | `{ width: 80 }` | `{ flex: 1 }` | `{ flex: 1 }` | `{ width: 60 }`

**Category pills** (horizontal scroll row): `전체` + all 7 categories, each `{label} {count}`. Active: `{ background: 'var(--accent)', color: '#000' }`. Inactive: `{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }`.

**Bulk delete handler**:
```typescript
window.confirm(`선택한 ${selectedWordIds.size}개 단어를 삭제하시겠습니까?\n일부 단어는 핫스팟에서 참조 중일 수 있습니다.`)
  ? [...selectedWordIds].forEach(id => deleteWord(id)) && setSelectedWordIds(new Set())
  : null
```

---

### WordManagerRow (NEW)

**File**: `packages/editor/src/components/words/WordManagerRow.tsx`

**Props**:
```typescript
interface WordManagerRowProps {
  word: Word;
  connectionChips: { sceneName: string; hotspotName: string }[];
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
}
```

**Store reads**: `updateWord`, `deleteWord`

**Local state** (edit draft, re-initialized when isExpanded becomes true):
```typescript
draftDisplay: LocalizedText
draftCategory: WordCategory
draftHint: LocalizedText
draftImageUrl: string
```

**Collapsed `<tr>`** — 6 `<td>` cells:
1. `<input type="checkbox" checked={isSelected} onChange={onToggleSelect} />`
2. Primary: `word.display.ko` (13px bold) + secondary: `/ {word.display.en}` (11px muted)
3. Category chip: colored dot + label using CATEGORY_COLORS/CATEGORY_LABELS
4. Hint preview: `word.hint?.ko` — 1 line, overflow ellipsis, fontSize 12, color muted
5. Hotspot chips: `{sceneName}·{hotspotName}` badges or `<span style={{color:'#ef4444'}}>미연결</span>`
6. `✎` expand button + `🗑` delete button (with window.confirm)

**Row hover**: `onMouseEnter/Leave` toggling `background: 'var(--bg-secondary)'`

**Expanded `<tr>`** (rendered after main row when `isExpanded`):
- `<td colSpan={6}>` containing inline edit grid:
  - Row 1: `LocalizedTextInput label="표시명"` for display
  - Row 2: category `<select>` with all 7 options
  - Row 3: `LocalizedTextInput label="힌트"` for hint (multiline=false)
  - Row 4: `<input placeholder="이미지 URL">`
  - Row 5: `[취소]` + `[저장]` buttons (right-aligned)
- `handleSave`: `updateWord(word.id, { display: draftDisplay, category: draftCategory, hint: draftHint, imageUrl: draftImageUrl })` then `onToggleExpand()`

---

### AnswerKeyEditor modification

**File**: `packages/editor/src/components/puzzle/AnswerKeyEditor.tsx`

Replace plain `<select>` per slot with a private `SlotWordPicker` sub-component (defined in same file):

```typescript
function SlotWordPicker({ slotId, currentWordId, caseWords, locale, onSelect }: {
  slotId: string; currentWordId: string; caseWords: Word[];
  locale: 'ko'|'en'; onSelect: (slotId: string, wordId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  // outside-click close: same pattern as WordDropdown
  const filtered = caseWords.filter(w =>
    w.display.ko.includes(search) || w.display.en?.includes(search)
  );
  const selected = caseWords.find(w => w.id === currentWordId);
  // Render: chip showing selected word name (or placeholder) + dropdown on click
}
```

**Visual**: Selected word shown as an accent-colored chip. Unselected: muted placeholder "단어 선택...". Dropdown list shows filtered words; clicking selects and closes.

---

### PuzzleEditorPanel redesign

**File**: `packages/editor/src/components/puzzle/PuzzleEditorPanel.tsx`

**Remove**: Back button header (the `← 씬으로 돌아가기` block) — navigation handled by MainAreaTabBar.

**New root layout** (two columns, `display: 'flex', height: '100%', overflow: 'hidden'`):

```typescript
<div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
  {/* LEFT: segment builder, flex 1.2 */}
  <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column',
                borderRight: '1px solid var(--border-color)', overflow: 'hidden' }}>
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Puzzle title section */}
      {/* PuzzleTemplateEditor (unchanged) */}
    </div>
    {/* AI accordion pinned to bottom */}
    <div style={{ borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
      <button onClick={() => setAiOpen(v => !v)} style={accordionBtnStyle}>
        {aiOpen ? '▼' : '▶'} ✨ AI 퍼즐 생성
      </button>
      {aiOpen && <AIPuzzleGenerator ... />}
    </div>
  </div>

  {/* RIGHT: preview + answer slots, flex 0.8 */}
  <div style={{ flex: 0.8, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Section label: 미리보기 */}
      {/* renderPreview box */}
      {/* Section label: 정답 슬롯 배정 */}
      {/* AnswerKeyEditor */}
    </div>
  </div>
</div>
```

**renderPreview function** (defined inside PuzzleEditorPanel):
```typescript
function renderPreview(segments, answers, words, locale): React.ReactNode {
  return segments.map((seg, i) => {
    if (seg.type === 'text') return <span key={i}>{seg.content[locale] || seg.content.ko}</span>;
    if (seg.type === 'line_break') return <br key={i} />;
    if (seg.type === 'slot') {
      const word = words.find(w => w.id === answers[seg.slotId]?.correctWordId);
      return (
        <span key={i} style={{ borderBottom: '2px solid var(--accent)', minWidth: 40,
          textAlign: 'center', color: word ? 'var(--accent)' : 'var(--text-muted)' }}>
          {word ? (word.display[locale] || word.display.ko) : '___'}
        </span>
      );
    }
    return null;
  });
}
```

**Preview box style**: `background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 16, fontSize: 15, lineHeight: 1.8, minHeight: 80`

**AI accordion local state**: `const [aiOpen, setAiOpen] = useState(false);`

---

## Modified Files — Exact Changes

### packages/core/src/models/types.ts
Add to `Word` interface (optional, backward-compatible):
```typescript
hint?: LocalizedText;
imageUrl?: string;
```

### packages/editor/src/components/properties/CaseProperties.tsx
- Remove: `import { WordVocabularyPanel }` + `<WordVocabularyPanel ... />`
- Add `setActivePanel` to store destructure
- Insert before "퍼즐 편집 열기" button:
```tsx
<button onClick={() => setActivePanel('words')} style={{
  width: '100%', padding: '7px 12px', fontSize: 12, fontWeight: 600,
  background: 'transparent', color: 'var(--accent)',
  border: '1px solid var(--accent)', borderRadius: 3, cursor: 'pointer', marginBottom: 8
}}>
  → 단어 관리 열기
</button>
```

### packages/editor/src/components/layout/MainLayout.tsx
- Add imports: `MainAreaTabBar`, `WordManagerPanel`
- Change center column JSX to include `<MainAreaTabBar />` and route `'words'` → `<WordManagerPanel />`

### packages/editor/src/components/tree/ProjectTree.tsx
- `ActNode`: add `setActivePanel` to store destructure; add `setActivePanel('words')` in CaseNode onSelect
- `CaseNode`: add `setActivePanel` to store destructure; add `setActivePanel('scene')` in SceneNode onSelect

---

## Error Handling & Edge Cases

| Case | Handling |
|------|----------|
| No case selected in WordManagerPanel | "사건을 선택하면 단어 목록이 표시됩니다." centered empty state |
| Search with no results | "검색 결과가 없습니다." |
| Bulk delete with hotspot references | window.confirm warning text includes reference note |
| Expanded row — word prop changes from store | useEffect re-initializes draft state |
| PuzzleEditorPanel — no slots | Right column: "슬롯이 없습니다. 템플릿에 슬롯을 추가하세요." |
| SlotWordPicker — no caseWords | Dropdown: "이 사건에 단어가 없습니다" |
| Tab clicks when no case selected | Still navigates; WordManagerPanel shows no-case empty state |
