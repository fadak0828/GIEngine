# Technical Design: Word Vocabulary & Hotspot Linking System

**Date**: 2026-03-30
**Spec**: `docs/specs/2026-03-30-word-and-hotspot-system.md`

---

## Architecture Overview

### Files Modified

| File | Change |
|------|--------|
| `packages/core/src/models/types.ts` | Add `name?: string` to `Hotspot` interface |
| `packages/editor/src/store/editor-store.ts` | Add `name: ''` to `newHotspot` in `addHotspot` factory |
| `packages/editor/src/components/properties/CaseProperties.tsx` | Import and render `WordVocabularyPanel` above the puzzle button |
| `packages/editor/src/components/properties/HotspotProperties.tsx` | Replace `word_reveal` branch with `<WordDropdown>`, thread `caseId` prop into `ActionEditor` |

### Files Created

| File | Purpose |
|------|---------|
| `packages/editor/src/components/words/WordVocabularyPanel.tsx` | Section container: word list, empty state, add trigger |
| `packages/editor/src/components/words/WordRow.tsx` | Single word row: display + inline edit mode |
| `packages/editor/src/components/words/WordAddForm.tsx` | Inline add form rendered below the list |
| `packages/editor/src/components/words/WordDropdown.tsx` | Multi-select chip dropdown for `word_reveal` wordIds |

---

## Component Tree

```
CaseProperties (modified)
└── WordVocabularyPanel (new)
    ├── [section header + word count badge]
    ├── [+ 단어 추가 button]
    ├── WordRow[] (new) — one per word in caseId
    │   └── [inline edit: LocalizedTextInput + category select + save/cancel]
    └── WordAddForm (new) — rendered when isAdding=true
        └── LocalizedTextInput (existing shared)

HotspotProperties (modified)
└── ActionEditor (internal, gains caseId prop)
    └── [word_reveal case] WordDropdown (new)
        ├── [selected chips: word display + × button]
        └── [dropdown panel: word options list]
```

---

## Data Flow

### WordVocabularyPanel
```
EditorStore.words (filtered by caseId)
    --> WordVocabularyPanel
        --> connectionMap = useMemo: for each word, count hotspots in caseScenes
            where action.type === 'word_reveal' && wordIds.includes(word.id)
        --> WordRow (display: word.display.ko, category badge, connectionCount badge)
            --> [edit] local draft state --> updateWord(wordId, patch)
            --> [delete] deleteWord(wordId)
        --> WordAddForm
            --> local { display: LocalizedText, category: WordCategory }
            --> [save] addWord({ id: `word_${Date.now()}_${rand}`, caseId, display, category })
```

### WordDropdown
```
EditorStore.words (filtered by selection.caseId)
    --> WordDropdown
        --> chip per wordId in action.wordIds
            --> word not found: "(알 수 없음 — {id})"
            --> chip × click: onChange(wordIds.filter(id => id !== chipId))
        --> dropdown option click: onChange([...wordIds, word.id])
        --> onChange → ActionEditor.onChange → updateHotspotAction(caseId, sceneId, hotspotId, action)
```

---

## Implementation Order

1. `packages/core/src/models/types.ts` — add `name?: string` to `Hotspot`
2. `packages/editor/src/store/editor-store.ts` — add `name: ''` to `addHotspot`
3. `packages/editor/src/components/words/WordAddForm.tsx` — new
4. `packages/editor/src/components/words/WordRow.tsx` — new
5. `packages/editor/src/components/words/WordVocabularyPanel.tsx` — new
6. `packages/editor/src/components/words/WordDropdown.tsx` — new
7. `packages/editor/src/components/properties/CaseProperties.tsx` — add `WordVocabularyPanel`
8. `packages/editor/src/components/properties/HotspotProperties.tsx` — replace `word_reveal` editor

---

## Component Specifications

### WordAddForm

**Props:**
```typescript
interface WordAddFormProps {
  caseId: string;
  onSaved: (wordId: string) => void;
  onCancel: () => void;
}
```
- Local state: `display: LocalizedText = { ko: '', en: '' }`, `category: WordCategory = 'evidence'`
- Uses `<LocalizedTextInput label="표시명" value={display} onChange={setDisplay} required />`
- Category `<select>`: `['person','place','object','action','time','motive','evidence']`
- Save disabled when `display.ko.trim() === ''`
- On save: `id = 'word_' + Date.now() + '_' + Math.random().toString(36).slice(2,7)`

---

### WordRow

**Props:**
```typescript
interface WordRowProps {
  word: Word;
  connectionCount: number;
  editorLocale: Locale;
}
```
- Display: category badge, `word.display.ko`, `/ {word.display.en}` (muted), connection badge (`●{N}곳`)
- Connection badge: accent color when >= 1, muted when 0
- Edit button `✎` → inline edit mode; Cancel button restores display
- Delete button `🗑`; `title="다른 곳에서 참조 중"` when `connectionCount > 0`
- Edit mode: draft `{ display, category }` initialized from word; save → `updateWord`

---

### WordVocabularyPanel

**Props:**
```typescript
interface WordVocabularyPanelProps {
  caseId: string;
  caseScenes: Scene[];
}
```
- `caseWords = words.filter(w => w.caseId === caseId)`
- `connectionMap`: `useMemo` — for each word, count hotspots across all scenes where `word_reveal.wordIds.includes(word.id)`
- Section header with `borderTop` divider, word count badge
- `isAdding` state controls `WordAddForm` visibility

---

### WordDropdown

**Props:**
```typescript
interface WordDropdownProps {
  caseId: string;
  wordIds: string[];
  onChange: (wordIds: string[]) => void;
}
```
- `caseWords = words.filter(w => w.caseId === caseId)`
- Chip area: chip per selected wordId; unknown ids show muted fallback text
- Dropdown panel: positioned absolutely, `z-index: 50`
- Already-selected words shown with `✓` prefix and reduced opacity
- Empty caseWords: "이 사건에는 단어가 없습니다" message
- Warning `⚠ 단어가 선택되지 않았습니다` when `wordIds.length === 0`
- Outside-click closes panel via `document` mousedown listener (cleaned up on unmount)

---

## Modified Files — Exact Changes

### packages/core/src/models/types.ts
Add to `Hotspot` interface:
```typescript
name?: string;  // editor-only label; ignored by runtime
```

### packages/editor/src/store/editor-store.ts
In `addHotspot` factory, add to `newHotspot`:
```typescript
name: '',
```

### packages/editor/src/components/properties/CaseProperties.tsx
Import:
```typescript
import { WordVocabularyPanel } from '@/components/words/WordVocabularyPanel';
```
Insert before puzzle button:
```tsx
<WordVocabularyPanel caseId={caseData.id} caseScenes={caseData.scenes} />
```

### packages/editor/src/components/properties/HotspotProperties.tsx
- `ActionEditorProps` gains `caseId: string`
- Replace `word_reveal` case with `<WordDropdown caseId={caseId} wordIds={action.wordIds} onChange={...} />`
- Import `WordDropdown`

---

## Error Handling & Edge Cases

| Case | Handling |
|------|----------|
| Unknown wordId in chips | Render `(알 수 없음 — {id})` with muted color; `×` still removes it |
| Word deleted while hotspot references it | Chip shows fallback; no crash |
| Empty caseWords in dropdown | Show empty-state guidance message |
| KO display name empty on save | Save button disabled |
| `caseScenes` empty | `connectionMap` all 0s via `connectionMap[id] ?? 0` |
| Hotspot `name` missing in existing JSON | `name?: string` optional; backward-compatible |
| Custom category not in canonical list | Add `<option value={word.category}>` guard in edit select |

---

## Test Strategy

### WordVocabularyPanel.test.tsx
- Empty state when `words = []`
- Correct word count badge
- "단어 추가" shows `WordAddForm`
- `connectionCount` computed correctly: word in hotspot `word_reveal.wordIds` → count=1

### WordRow.test.tsx
- Displays category badge, KO, EN, connection badge
- Connection badge color changes at count 0 vs 1
- Edit → form appears with pre-populated values
- Save calls `updateWord`; cancel restores display
- Delete calls `deleteWord`
- Delete tooltip when `connectionCount > 0`

### WordAddForm.test.tsx
- Save disabled when KO empty
- Save calls `addWord` with correct shape
- Cancel calls `onCancel`, no `addWord`

### WordDropdown.test.tsx
- Renders chips for all `wordIds`
- Unknown ID chip renders fallback text
- Chip `×` removes id from list
- Dropdown toggles on button click
- Empty caseWords shows guidance message
- Selecting word calls `onChange` with appended id
- Already-selected word shows `✓`, click is no-op
- Warning shown when `wordIds.length === 0`
- Outside click closes dropdown
