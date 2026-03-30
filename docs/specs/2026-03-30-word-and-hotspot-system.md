# 단어 관리 및 핫스팟 연결 시스템 — 기능 명세서

**문서 버전**: 1.0.0
**작성일**: 2026-03-30
**범위**: Case별 단어 어휘 관리 UI / 핫스팟 속성 패널 확장 / 핫스팟-단어 연결
**관련 패키지**: `packages/editor`, `packages/core`

---

## 1. 문제 정의 (Problem Statement)

GIEngine의 핵심 게임플레이는 플레이어가 씬을 탐색하면서 핫스팟을 클릭해 단어(Word)를 수집하고, 수집한 단어들을 퍼즐 슬롯에 배치하여 추리를 완성하는 것이다. 이 흐름은 `WordRevealAction` → `Word` → `AnswerDefinition.correctWordId` 로 이어지는 데이터 체인에 의존한다.

그러나 현재 에디터에는 이 체인을 구성하기 위한 UI가 두 곳 모두 비어 있다.

### 1-1. 단어 관리 UI 부재

- `Word` 타입(`id`, `display: LocalizedText`, `category?: WordCategory`, `caseId: string`)은 코어에 정의되어 있다.
- `EditorStore`에 `addWord`, `updateWord`, `deleteWord` 액션이 모두 구현되어 있다.
- 그러나 에디터 어느 화면에서도 단어를 추가·편집·삭제할 수 있는 UI가 존재하지 않는다.
- 결과: 퍼즐 `AnswerDefinition.correctWordId`에 들어갈 단어 ID를 에디터에서 만들 방법이 없어 퍼즐 제작이 사실상 불가능하다.

### 1-2. 핫스팟 속성 패널 미완성

- `HotspotProperties.tsx`의 `word_reveal` 액션 편집 영역은 단어 ID를 쉼표로 구분하여 직접 타이핑하도록 구현되어 있다(`placeholder="word_id_1, word_id_2"`).
- 단어 목록이 에디터에 없으므로 작성자는 ID를 암기하거나 직접 JSON을 열어야 한다.
- 핫스팟에 `ariaLabel`, `cursor` 편집은 있으나 핫스팟 자체의 이름/설명(`name`, `description`) 필드가 타입에 없어 창작 의도를 기록할 방법이 없다.

### 1-3. 핫스팟 → 단어 연결 불가

- 위 두 문제가 결합되어 "이 핫스팟을 클릭하면 어떤 단어가 수집되는가"를 에디터에서 시각적으로 설정할 수 없다.
- 수동 JSON 편집 없이는 완전한 게임을 만들 수 없다.

---

## 2. 사용자 스토리 (User Stories)

| ID   | 역할       | 스토리                                                                                           | 우선순위 |
|------|------------|--------------------------------------------------------------------------------------------------|----------|
| US-1 | 창작자     | Case를 선택했을 때 해당 사건에서 플레이어가 수집할 수 있는 단어 목록을 보고 싶다.                | 필수     |
| US-2 | 창작자     | 단어를 새로 추가할 때 한국어/영어 표시명과 카테고리(person, evidence 등)를 설정하고 싶다.        | 필수     |
| US-3 | 창작자     | 기존 단어를 클릭하여 이름과 카테고리를 인라인으로 수정하고, 불필요한 단어를 삭제하고 싶다.       | 필수     |
| US-4 | 창작자     | 씬 캔버스에서 핫스팟을 선택했을 때, 그 핫스팟이 어떤 단어를 제공하는지 드롭다운으로 연결하고 싶다. | 필수   |
| US-5 | 창작자     | 단어가 어느 핫스팟에도 아직 연결되지 않았는지 한 눈에 확인하여 누락 없이 게임을 완성하고 싶다.   | 선택     |

---

## 3. 기능 범위 (Feature Scope)

### IN SCOPE

- **F1 — Case 단어 관리 패널**: Case 선택 시 속성 패널(또는 별도 탭) 내에 해당 `caseId`에 속한 단어들을 나열하고, 추가/인라인 편집/삭제하는 UI.
- **F2 — 핫스팟 속성 패널 확장**: `word_reveal` 액션의 `wordIds` 입력을 자유 텍스트에서 단어 드롭다운 멀티셀렉트로 교체.
- **F3 — 단어 연결 시각화**: 단어 목록 행에 "연결된 핫스팟 수" 배지(badge) 표시(읽기 전용).
- **F4 — 빈 단어 경고**: `word_reveal` 액션에서 wordIds가 비어 있으면 HotspotProperties에 경고 인라인 표시.

### OUT OF SCOPE

- 단어의 런타임 수집 애니메이션 변경
- 단어 아이콘/이미지 에셋 연결
- 단어 글로벌 검색/필터 (프로젝트 전체 단어 뷰)
- Sub-puzzle(characterId, timeline 등) 슬롯과 단어 연결
- 단어 Import/Export (CSV 등)
- 단어 카테고리 커스텀 추가 (정의된 7개 고정 카테고리만 지원)

---

## 4. UI/UX 설계

### 4-1. Case 단어 관리 패널 (WordVocabularyPanel)

**진입점**: `CaseProperties` 컴포넌트 하단에 "단어 관리" 섹션을 추가. 현재 "퍼즐 편집 열기" 버튼 위에 위치.

**레이아웃**:

```
┌─────────────────────────────────┐
│  [SECTION] 단어 어휘              │
│  Case에 속한 단어: 4개            │
├─────────────────────────────────┤
│  + 단어 추가                     │   ← 항상 노출
├─────────────────────────────────┤
│  [person] 이상혁 / Lee Sang-hyuk │ ✎ 🗑  │
│  [evidence] 혈흔 / Bloodstain   │ ✎ 🗑  │
│  [place] 창고 / Warehouse       │ ✎ 🗑  │
│  ...                             │
└─────────────────────────────────┘
```

**"+ 단어 추가" 동작**:
- 클릭 시 목록 최하단에 인라인 폼을 삽입.
- 폼 필드: KO 표시명(필수), EN 표시명(선택), 카테고리 드롭다운(기본값: `evidence`).
- [저장] 클릭 → `addWord({ id: genId('word'), caseId, display: {ko, en}, category })` 호출.
- [취소] 클릭 → 폼 닫기.
- 저장 후 목록 자동 스크롤하여 신규 단어 노출.

**단어 행 (WordRow)**:
- 기본 상태: 카테고리 배지 + KO 표시명 + `/ EN 표시명` (엷은 색)
- 편집(✎) 클릭 → 인라인 편집 모드로 전환. 기존 값이 입력 필드에 채워짐.
- 삭제(🗑) 클릭 → 확인 없이 즉시 삭제(`deleteWord`). 단, 다른 씬의 `word_reveal` 또는 퍼즐 `AnswerDefinition`에서 참조 중인 경우 삭제 버튼에 tooltip "다른 곳에서 참조 중" 표시(클릭은 가능, 참조 정리는 작성자 책임).
- "연결된 핫스팟" 배지: `0개`이면 회색(`--text-muted`), 1개 이상이면 강조색으로 표시.

**빈 상태(empty state)**:
```
단어가 없습니다.
이 사건에서 플레이어가 수집할 단어를 추가하세요.
```

---

### 4-2. 핫스팟 속성 패널 — word_reveal 액션 편집 개선

**현재 상태**: `<input type="text" placeholder="word_id_1, word_id_2" />`

**변경 후**: 단어 드롭다운 멀티셀렉트 UI

```
┌─────────────────────────────────┐
│  [SECTION] 액션: 단어 획득        │
│                                  │
│  단어 선택                        │
│  ┌──────────────────────────┐   │
│  │ [person] 이상혁     ×    │   │ ← 선택된 단어 chip
│  │ [evidence] 혈흔     ×    │   │
│  └──────────────────────────┘   │
│  + 단어 추가  ▼                  │   ← 드롭다운 버튼
│    ┌─────────────────────────┐  │
│    │ [person] 이상혁         │  │
│    │ [evidence] 혈흔         │  │
│    │ [place] 창고            │  │
│    └─────────────────────────┘  │
│                                  │
│  ⚠️ 단어가 선택되지 않았습니다.    │  ← wordIds가 []일 때만 표시
│                                  │
│  피드백 (선택)                    │
│  KO: ___________________________│
│  EN: ___________________________│
└─────────────────────────────────┘
```

**동작 상세**:
- 드롭다운 목록은 현재 선택된 Case(`selection.caseId`)에 속한 단어만 필터링하여 표시.
- 이미 `wordIds`에 포함된 단어는 목록에서 회색(disabled) 처리하거나 체크 표시.
- Chip의 `×` 클릭 → 해당 wordId를 `wordIds`에서 제거.
- Case에 단어가 없을 때 드롭다운 내부에 "이 사건에는 단어가 없습니다. Case 속성에서 단어를 먼저 추가하세요." 메시지 및 링크(또는 해당 Case 선택으로 포커스 이동).

---

### 4-3. 단어 연결 시각화 (연결된 핫스팟 수 배지)

- `WordRow`의 오른쪽에 `● N곳`과 같은 배지 삽입.
- N은 현재 선택된 Case 내 모든 Scene의 모든 Hotspot 중 `action.type === 'word_reveal'` 이고 `action.wordIds.includes(word.id)` 인 핫스팟 수를 계산.
- N === 0이면 배지 색상 `var(--text-muted)` (미연결 경고).
- N ≥ 1이면 배지 색상 `var(--accent)` (연결됨).
- 배지 클릭 시 첫 번째 연결된 핫스팟이 있는 Scene으로 선택 이동(F3 선택 사항, 구현 복잡도가 높으면 비활성 배지로 처리 가능).

---

## 5. 데이터 모델 변경 사항

### 5-1. 코어 타입 변경 없음 (현행 유지)

`Word` 타입은 현재 구조로 충분하다:

```typescript
// packages/core/src/models/types.ts — 변경 없음
export interface Word {
  id: string;
  display: LocalizedText;
  category?: WordCategory;
  caseId: string;
}
```

### 5-2. Hotspot 타입 — `name` 필드 추가 (옵셔널)

현재 `Hotspot`에는 에디터에서 식별 가능한 이름 필드가 없다. `ariaLabel`은 접근성 목적이며 내부 식별명이 아니다. 드롭다운 목록에서 핫스팟을 사람이 읽을 수 있는 이름으로 구분하기 위해 옵셔널 `name` 필드를 추가한다.

```typescript
// packages/core/src/models/types.ts — 변경
export interface Hotspot {
  id: string;
  name?: string;              // NEW: 에디터용 식별 이름 (게임 런타임 미사용)
  area: HotspotArea;
  action: HotspotAction;
  cursor: string;
  condition?: VisibilityCondition;
  ariaLabel: LocalizedText;
}
```

- `name`은 에디터 내부 식별 용도이며 런타임(`packages/runtime`)에서는 무시된다.
- 기존 JSON에 `name`이 없어도 하위 호환(옵셔널).
- `addHotspot` 팩토리(`editor-store.ts`)에서 기본값 `name: ''` 추가.

### 5-3. EditorStore 변경 없음

`updateHotspot`이 `Partial<Hotspot>`을 받으므로 `name` 필드 업데이트는 기존 액션으로 처리 가능하다.

---

## 6. 컴포넌트 구조 계획

```
packages/editor/src/components/
├── properties/
│   ├── CaseProperties.tsx         [수정] WordVocabularyPanel 섹션 추가
│   ├── HotspotProperties.tsx      [수정] word_reveal ActionEditor 교체
│   ├── PropertiesPanel.tsx        [변경 없음]
│   └── SceneProperties.tsx        [변경 없음]
├── words/                         [신규 디렉토리]
│   ├── WordVocabularyPanel.tsx    [신규] 단어 목록 + 추가/편집/삭제
│   ├── WordRow.tsx                [신규] 단어 단일 행 (인라인 편집 포함)
│   └── WordDropdown.tsx           [신규] word_reveal용 멀티셀렉트 드롭다운
```

---

## 7. 수용 기준 (Acceptance Criteria)

### AC-1: 단어 추가

- [ ] Case를 선택하면 속성 패널에 "단어 어휘" 섹션이 보인다.
- [ ] "단어 추가" 버튼을 클릭하면 인라인 폼이 나타난다.
- [ ] KO 표시명을 입력하고 저장하면 목록에 신규 단어가 추가된다.
- [ ] 저장된 단어는 `words` store에 `caseId`가 현재 Case ID로 설정되어 저장된다.

### AC-2: 단어 편집

- [ ] 편집 아이콘을 클릭하면 해당 행이 인라인 편집 모드로 전환된다.
- [ ] KO, EN 표시명 및 카테고리를 수정하고 저장하면 `updateWord`가 호출된다.
- [ ] 취소하면 변경 사항이 버려지고 기존 값이 복원된다.

### AC-3: 단어 삭제

- [ ] 삭제 아이콘 클릭 시 단어가 목록에서 즉시 제거된다.
- [ ] `deleteWord`가 호출되고 store에서 해당 Word가 제거된다.

### AC-4: 핫스팟-단어 연결 (word_reveal)

- [ ] 핫스팟을 선택하고 액션 타입을 `word_reveal`로 설정하면, 단어 ID 입력란 대신 드롭다운이 나타난다.
- [ ] 드롭다운에는 현재 Case에 속한 단어만 표시된다.
- [ ] 단어를 선택하면 chip으로 추가되고 `wordIds`가 업데이트된다.
- [ ] Chip `×`를 클릭하면 해당 단어가 `wordIds`에서 제거된다.

### AC-5: 빈 단어 경고

- [ ] `word_reveal` 액션에서 `wordIds`가 빈 배열이면 경고 메시지가 표시된다.
- [ ] `wordIds`에 1개 이상의 단어가 있으면 경고가 사라진다.

### AC-6: 연결 배지

- [ ] 단어 행에 해당 단어를 참조하는 핫스팟 수가 배지로 표시된다.
- [ ] 연결된 핫스팟이 없으면 배지가 뮤트(muted) 색으로 표시된다.
- [ ] 연결된 핫스팟이 있으면 배지가 강조(accent) 색으로 표시된다.

### AC-7: 하위 호환

- [ ] `name` 필드가 없는 기존 `.gi-project` 파일을 로드해도 오류 없이 동작한다.
- [ ] `word_reveal` 핫스팟의 `wordIds`에 현재 Case에 존재하지 않는 ID가 있어도 드롭다운이 crash하지 않고, 해당 ID는 "(알 수 없음 — word_xxx)" 로 chip에 표시된다.

---

## 8. 엣지 케이스 및 고려 사항

| 상황 | 처리 방법 |
|------|-----------|
| 단어 삭제 후 해당 단어를 참조하는 `word_reveal` 핫스팟 존재 | 삭제 허용, 런타임에서 wordId not found 시 무시. 에디터 재진입 시 AC-7 규칙 적용 |
| Case에 단어가 0개인데 핫스팟에서 word_reveal 선택 | 드롭다운 내부에 빈 상태 안내 메시지. 단어 추가 진입 링크 제공 |
| 다른 Case의 단어를 word_reveal에 연결 시도 | 드롭다운은 현재 caseId 기준 필터링이므로 자연스럽게 방지 |
| 핫스팟에 ariaLabel은 있지만 name이 없을 때 드롭다운 표시 | `name || ariaLabel.ko || hotspot.id` 우선순위로 표시 |

---

## 9. 관련 문서

- `docs/specs/2026-03-29-gi-engine.md` — 코어 타입 설계 원본
- `docs/specs/2026-03-30-content-and-export.md` — 퍼즐 편집 및 익스포트 명세 (AnswerDefinition과 Word 연결 참고)
- `packages/core/src/models/types.ts` — Word, Hotspot, WordRevealAction 타입 정의
- `packages/editor/src/store/editor-store.ts` — addWord, updateWord, deleteWord, updateHotspotAction 액션
