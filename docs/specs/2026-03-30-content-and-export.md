# 콘텐츠 편집 및 익스포트 — 기능 명세서

**문서 버전**: 1.0.0
**작성일**: 2026-03-30
**범위**: 사건 설명 편집 / 추리 퍼즐 편집 UI / HTML 익스포트 / AI 배경 생성 컨텍스트 인식 프롬프트
**관련 패키지**: `packages/editor`, `packages/ai`, `packages/exporter`, `packages/core`

---

## 배경 및 동기

GIEngine 에디터는 현재 씬 편집(배경 이미지, 핫스팟 배치)과 에셋 관리는 가능하지만, 게임 콘텐츠의 핵심 요소들이 UI에서 누락되어 있다.

1. **사건 설명(Case Description)**: `Case.description` 필드가 타입에 존재하고 `makeDefaultCase()`에서 빈 값으로 초기화되지만, 에디터에서 이를 입력하는 UI가 없다. 플레이어가 사건 선택 화면에서 보는 소개 텍스트이므로 필수 콘텐츠이다.

2. **추리 퍼즐 편집**: `PuzzleSet`, `PuzzleTemplate`, `PuzzleSegment`, `AnswerDefinition` 등의 타입이 모두 `@gi-engine/core`에 정의되고, 스토어에 `updateMainPuzzle`, `updatePuzzleTemplate`, `updatePuzzleAnswers` 액션이 있으나, 에디터 UI에서 이를 조작하는 컴포넌트가 전혀 없다. 게임의 핵심 메카닉인 추리 퍼즐을 에디터 없이는 만들 수 없다.

3. **익스포트**: `packages/exporter`에 `bundle()` 함수가 완전히 구현되어 있고 CLI(`gi-export`)도 존재하지만, 에디터 UI에서 직접 익스포트를 실행하는 버튼이 없다. 창작자가 결과물을 브라우저에서 바로 확인하려면 터미널 명령을 알아야 한다.

4. **AI 배경 생성 컨텍스트**: 현재 `AIBackgroundModal`은 사용자가 자유 텍스트로 장면을 설명하면 Imagen으로 배경을 생성한다. 하지만 이미 씬에 배치된 핫스팟들(위치, 크기, 설명)을 무시한다. 핫스팟 정보를 JSON 컨텍스트로 취합하여 AI 이미지 모델이 씬의 공간 구조를 정확하게 그려낼 수 있는 구조화된 프롬프트를 자동 생성하면 생성 품질이 크게 향상된다.

---

## 사용자 스토리

### Feature 1: 사건 설명 편집

- **US-1**: 창작자로서 사건 선택 화면에 표시될 사건 설명(한국어/영어)을 에디터에서 직접 입력하고 싶다.
- **US-2**: 창작자로서 사건의 제목(title)도 같은 화면에서 한꺼번에 편집하고 싶다.

### Feature 2: 추리 퍼즐 편집

- **US-3**: 창작자로서 빈칸 채우기 형식의 메인 추리 문장(PuzzleTemplate)을 시각적으로 편집하고 싶다.
- **US-4**: 창작자로서 단어 은행(Word Bank)에서 어떤 단어가 어떤 슬롯에 들어가야 하는지 정답 키(AnswerDefinition)를 설정하고 싶다.
- **US-5**: 창작자로서 AI를 이용해 퍼즐 초안을 자동으로 생성하고, 결과를 검토하여 편집하고 싶다.
- **US-6**: 창작자로서 퍼즐 UI를 열고 닫을 때 현재 씬 편집 화면과 분리되어 있으면 좋겠다(전용 패널 혹은 탭).

### Feature 3: 익스포트

- **US-7**: 창작자로서 툴바의 버튼 하나를 클릭하여 게임을 단일 HTML 파일로 내보내고 싶다.
- **US-8**: 창작자로서 익스포트 진행 상황과 완료 결과(파일 크기 등)를 모달로 확인하고 싶다.
- **US-9**: 창작자로서 브라우저 환경에서 바로 파일 다운로드가 진행되면 좋겠다(별도 Node.js 서버 없이).

### Feature 4: AI 배경 — 컨텍스트 인식 프롬프트

- **US-10**: 창작자로서 AI 배경 생성 시 현재 씬의 핫스팟 위치와 설명이 자동으로 프롬프트에 반영되면 좋겠다.
- **US-11**: 창작자로서 AI가 생성한 프롬프트 초안을 모달에서 확인하고 수정할 수 있으면 좋겠다.
- **US-12**: 창작자로서 외부 AI 이미지 도구(나노바나나 등)에 바로 붙여넣을 수 있는 형태의 프롬프트를 얻고 싶다.

---

## 기능 요구사항

---

### Feature 1: 사건 설명 편집 (Case Description Editor)

#### F1-01: 사건 선택 시 속성 패널 표시

`PropertiesPanel`은 현재 `selectedScene`과 `selectedHotspot`이 있을 때만 콘텐츠를 표시한다. 사건(`caseId`)이 선택되어 있으나 씬이 선택되지 않은 경우, 사건 메타데이터 편집 폼을 표시해야 한다.

- `selection.caseId !== null && selection.sceneId === null`인 경우 `CaseProperties` 컴포넌트를 렌더링한다.
- `PropertiesPanel`의 조건부 렌더링 분기에 해당 케이스를 추가한다.

#### F1-02: CaseProperties 컴포넌트 신규 구현

파일 경로: `packages/editor/src/components/properties/CaseProperties.tsx`

표시 필드:

| 필드 | 타입 | 컴포넌트 |
|------|------|----------|
| `case.title` | `LocalizedText` | `LocalizedTextInput` (기존 공유 컴포넌트) |
| `case.description` | `LocalizedText` | `LocalizedTextInput` (multiline, `rows={4}`) |
| `case.id` | `string` (read-only) | 단순 텍스트 표시 |
| `case.prerequisites` | `string[]` | 현재 범위 외 (Open Question 참고) |
| `case.thumbnail` | `AssetRef` | 현재 범위 외 (Open Question 참고) |

저장 방식:
- `useEditorStore`의 `updateCase(caseId, patch)` 액션 사용
- `updateCase`의 `patch` 타입은 `Partial<Omit<Case, 'scenes' | 'puzzles'>>` — `title`과 `description` 모두 포함됨
- 각 `LocalizedTextInput`의 `onChange` 시 즉시 스토어에 반영 (저장 버튼 없음, 실시간 업데이트)

#### F1-03: ProjectTree에서 Case 클릭 시 caseId 단독 선택

현재 `CaseNode`를 클릭하면 `setSelection({ caseId, sceneId: null, hotspotId: null })`이 호출된다. 이 동작을 확인하고, sceneId가 null로 초기화됨을 보장한다. (현재 동작이 올바른지 `ProjectTree.tsx` 코드에서 검증 필요 — Open Question 참고)

#### F1-04: 수락 기준

| # | 기준 |
|---|------|
| AC1-1 | ProjectTree에서 Case 노드를 클릭하면 PropertiesPanel에 CaseProperties가 표시된다 |
| AC1-2 | title의 ko/en 값을 편집하면 스토어에 즉시 반영되고 `isDirty=true`가 된다 |
| AC1-3 | description의 ko/en 값을 편집하면 스토어에 즉시 반영된다 |
| AC1-4 | 저장 후 프로젝트를 다시 불러오면 수정한 title/description이 유지된다 |
| AC1-5 | CaseProperties가 표시된 상태에서 씬을 클릭하면 SceneProperties로 전환된다 |

---

### Feature 2: 추리 퍼즐 편집 (Deduction/Puzzle Editor)

#### F2-01: 퍼즐 편집 패널 활성화

`ActivePanel` 타입에 이미 `'puzzle'`이 정의되어 있다 (`packages/editor/src/store/editor-store.ts` line 48). 그러나 이 패널을 렌더링하는 UI가 없다. 메인 레이아웃에서 `activePanel === 'puzzle'`일 때 `PuzzleEditorPanel`을 표시해야 한다.

진입 방법: `PropertiesPanel`의 사건 선택 화면(`CaseProperties`) 내에 "퍼즐 편집 열기" 버튼을 추가하거나, ProjectTree의 Case 노드 컨텍스트 메뉴(또는 아이콘 버튼)에서 퍼즐 탭으로 전환한다.

#### F2-02: PuzzleEditorPanel 컴포넌트 구현

파일 경로: `packages/editor/src/components/puzzle/PuzzleEditorPanel.tsx`

**레이아웃 구조**:

```
PuzzleEditorPanel
├── 퍼즐 제목 편집 (LocalizedTextInput — Puzzle.title)
├── 세그먼트 편집기 (PuzzleTemplateEditor)
│   ├── 세그먼트 목록 (drag-reorder)
│   │   ├── TextSegmentRow — 텍스트 내용 편집 (ko/en)
│   │   ├── SlotSegmentRow — slotId, placeholder, acceptCategory 편집
│   │   └── LineBreakRow — 구분자
│   ├── [+ 텍스트 추가] [+ 슬롯 추가] [+ 줄바꿈] 버튼
│   └── 프리뷰 (렌더링된 퍼즐 문장 표시)
├── 정답 키 편집 (AnswerKeyEditor)
│   └── 슬롯ID별로 correctWordId 드롭다운 (현재 Case의 Word 목록에서 선택)
└── AI 퍼즐 생성 섹션 (AIPuzzleGenerator, 하단)
```

#### F2-03: PuzzleTemplateEditor — 세그먼트 편집

세그먼트(`PuzzleSegment`) 타입별 편집 행:

**TextSegment** (`type: 'text'`):
- ko/en 텍스트 입력 (`<input>` 단행)
- 삭제 버튼

**SlotSegment** (`type: 'slot'`):
- `slotId`: 자동 생성 (`slot_N`) — 편집 불가 (표시만)
- `placeholder.ko` / `placeholder.en`: 텍스트 입력
- `acceptCategory`: Word category 드롭다운 (`person|place|object|action|time|motive|evidence|없음`)
- 삭제 버튼

**LineBreakSegment** (`type: 'line_break'`):
- "줄바꿈" 레이블 표시
- 삭제 버튼

세그먼트 순서 변경: 위/아래 화살표 버튼 또는 drag-and-drop (구현 복잡도에 따라 선택).

저장: 세그먼트 목록 변경 시 `updatePuzzleTemplate(caseId, newTemplate)` 호출.

#### F2-04: AnswerKeyEditor — 정답 키 편집

- 현재 `PuzzleTemplate`의 모든 `SlotSegment`를 순회하여 슬롯별 행을 표시한다.
- 각 슬롯 행: `slotId` 표시 + `correctWordId` 드롭다운 (현재 `case`의 `words` 목록에서 선택)
- `partiallyCorrectWordIds`: 다중 선택 지원 (선택적 구현 — Open Question 참고)
- 저장: 변경 시 `updatePuzzleAnswers(caseId, newAnswers)` 호출

#### F2-05: AI 퍼즐 생성 (AIPuzzleGenerator)

`packages/ai/src/generators/puzzle-generator.ts`의 `generatePuzzle()` 함수를 활용한다. 이 함수는 `PuzzleGenerateRequest`를 받아 `PuzzleGenerateResult`를 반환한다.

입력:
- `caseTitle`: 현재 선택된 Case의 `title[editorLocale]`
- `caseDescription`: 현재 선택된 Case의 `description[editorLocale]`
- `wordBank`: 현재 `words` 배열에서 해당 `caseId`에 속하는 단어들의 `display[editorLocale]` 리스트
- `locale`: `ui.editorLocale`

UI 흐름:
1. "AI로 퍼즐 생성" 버튼 클릭
2. 생성 중 로딩 인디케이터 표시
3. 생성 완료 후 결과를 PuzzleTemplateEditor에 표시 (단, 즉시 저장하지 않고 "적용" 버튼으로 확인 후 저장)
4. 에러 시 에러 메시지 표시

전제 조건 검사: `wordBank`가 비어있으면 버튼 disabled + "단어 은행에 단어를 먼저 추가하세요" 툴팁 표시.

#### F2-06: 수락 기준

| # | 기준 |
|---|------|
| AC2-1 | 퍼즐 편집 패널이 열리면 현재 Case의 메인 퍼즐 데이터가 표시된다 |
| AC2-2 | 텍스트 세그먼트를 추가하고 내용을 입력하면 스토어에 반영된다 |
| AC2-3 | 슬롯 세그먼트를 추가하면 자동으로 유니크한 slotId가 부여된다 |
| AC2-4 | AnswerKeyEditor에서 슬롯의 정답 단어를 선택하면 스토어에 반영된다 |
| AC2-5 | 정답 키에 설정된 단어가 Word 목록에 존재해야 선택 가능하다 |
| AC2-6 | AI 퍼즐 생성 버튼 클릭 시 로딩 중 UI가 표시되고, 완료 후 프리뷰에 결과가 나타난다 |
| AC2-7 | AI 생성 결과를 "적용" 하면 기존 퍼즐 템플릿이 교체되고 isDirty=true가 된다 |
| AC2-8 | 퍼즐 편집 패널을 닫고 다시 열면 마지막으로 저장된 상태가 표시된다 |

---

### Feature 3: 익스포트 (Export to Single HTML)

#### F3-01: 툴바 익스포트 버튼

`packages/editor/src/components/layout/Toolbar.tsx`에 "익스포트" 버튼을 추가한다.

- 위치: 저장 버튼 오른쪽, 구분선 뒤
- 레이블: `📤 익스포트`
- disabled 조건: `project === null`
- 클릭 시: `ExportModal`을 열거나 즉시 브라우저 익스포트 실행

#### F3-02: ExportModal 컴포넌트

파일 경로: `packages/editor/src/components/export/ExportModal.tsx`

**상태 머신**:

```
idle → exporting → success
               └→ error
```

**idle 단계** (설정 화면):
- 출력 파일명 입력 (기본값: `${project.id}.html`)
- 빌드 모드 선택: `개발 (development)` / `배포 (production)` (기본값: production)
- "익스포트 시작" 버튼

**exporting 단계** (진행 표시):
- 스피너 + "HTML 파일 생성 중..." 텍스트
- 단계별 메시지 (선택적): "에셋 인라인 처리 중...", "HTML 조립 중...", "다운로드 준비 중..."

**success 단계** (완료 화면):
- "익스포트 완료" 메시지
- 파일 크기 요약 표시 (총 크기, JS/CSS/에셋/데이터 분류)
- "닫기" 버튼

**error 단계**:
- 에러 메시지 표시
- "다시 시도" / "닫기" 버튼

#### F3-03: 브라우저 환경에서의 익스포트 실행

`packages/exporter/src/bundler.ts`의 `bundle()` 함수는 Node.js 파일 시스템(`node:fs`, `node:path`)에 의존하므로 브라우저에서 직접 사용할 수 없다. 브라우저 전용 익스포트 로직을 별도로 구현한다.

브라우저 익스포트 함수 위치: `packages/exporter/src/browser-export.ts` (신규 파일)

브라우저 익스포트 알고리즘:
1. `GameDefinition` + `words` 객체를 직렬화 (에셋은 이미 `inline` base64로 저장되어 있으므로 별도 인라인 처리 불필요)
2. `assembleHtml()` 호출 — 이 함수는 이미 순수 문자열 처리이므로 브라우저에서 사용 가능
3. Runtime JS/CSS: 에디터 빌드 시 `import.meta.glob` 또는 인라인 문자열로 번들링
4. `Blob` → `URL.createObjectURL()` → 앵커 태그 클릭으로 파일 다운로드

Runtime JS 번들 전략 (Open Question):
- 에디터 Vite 빌드 시 `packages/runtime/dist`를 `?raw` import로 인라인
- 또는 런타임 빌드를 `base64`로 인코딩하여 상수로 포함

#### F3-04: 파일 크기 계산 및 표시

| 항목 | 계산 방법 |
|------|----------|
| 총 크기 | `new Blob([html]).size` |
| 에셋 크기 | 모든 `AssetDefinition.inline` 의 base64 바이트 합산 (× 3/4 for binary bytes) |
| 데이터 크기 | `JSON.stringify(exportDef).length` (byte 단위) |

표시 형식: `< 1KB` / `X.X KB` / `X.XX MB`

#### F3-05: 수락 기준

| # | 기준 |
|---|------|
| AC3-1 | 프로젝트가 없으면 익스포트 버튼이 비활성화된다 |
| AC3-2 | 익스포트 버튼 클릭 시 ExportModal이 열린다 |
| AC3-3 | "익스포트 시작" 클릭 시 로딩 화면으로 전환된다 |
| AC3-4 | 익스포트 완료 시 `.html` 파일이 브라우저 다운로드로 저장된다 |
| AC3-5 | 완료 화면에서 총 파일 크기가 표시된다 |
| AC3-6 | 생성된 HTML 파일을 브라우저에서 열면 런타임이 로드된다 |
| AC3-7 | 익스포트 중 모달을 닫을 수 없다 (진행 중 인터럽트 방지) |

---

### Feature 4: AI 배경 — 컨텍스트 인식 프롬프트 (Context-Aware Prompt Generation)

#### F4-01: 핫스팟 컨텍스트 JSON 생성

`AIBackgroundModal`이 열릴 때, 현재 씬의 모든 핫스팟을 수집하여 공간 레이아웃 JSON을 구성한다.

**핫스팟 공간 분석 로직**:

`HotspotArea`의 `rect` 타입을 기준으로 상대적 위치와 크기를 계산한다.

```typescript
// 씬 dimensions 기준 상대 위치 계산
interface HotspotContext {
  id: string;
  label: string;           // ariaLabel[editorLocale] 또는 action.content 첫 줄
  positionZone: string;    // "left" | "center" | "right" + "-" + "top" | "middle" | "bottom"
  relativeSize: string;    // "small" | "medium" | "large" (씬 넓이 대비 width 비율)
  description: string;     // examine action의 content[editorLocale] 첫 50자 (있는 경우)
}
```

위치 존 계산 (씬 width/height 기준):
- x 축: `< 33%` → "left", `33%~66%` → "center", `> 66%` → "right"
- y 축: `< 33%` → "top", `33%~66%` → "middle", `> 66%` → "bottom"
- 조합: `"left-top"`, `"center-middle"` 등 9개 존

크기 분류 (핫스팟 width / 씬 width):
- `< 10%` → "small"
- `10%~30%` → "medium"
- `> 30%` → "large"

`circle` 타입: `cx`, `cy`, `radius`를 rect 변환 (`x=cx-r, y=cy-r, width=height=r*2`)하여 동일 로직 적용.

`polygon` 타입: bounding box 계산 후 동일 로직 적용.

#### F4-02: 씬 컨텍스트 JSON 구조

```json
{
  "scene": {
    "width": 1280,
    "height": 720,
    "userDescription": "사용자가 입력한 자유 텍스트 장면 설명"
  },
  "objects": [
    {
      "label": "책상",
      "positionZone": "center-middle",
      "relativeSize": "large",
      "description": "오래된 참나무 책상, 위에 서류들이 쌓여있다"
    },
    {
      "label": "창문",
      "positionZone": "right-top",
      "relativeSize": "medium",
      "description": "빗물이 흐르는 창문"
    }
  ]
}
```

#### F4-03: 자동 프롬프트 초안 생성

위 JSON 컨텍스트를 바탕으로 자연어 프롬프트를 자동 생성한다.

생성 함수 위치: `packages/ai/src/prompts/background-prompts.ts`에 `buildContextualBackgroundPrompt()` 추가

프롬프트 생성 규칙:

```
A game background scene: {userDescription}.

Spatial layout:
{objects를 순회하여 각각 "- {label}: positioned in the {positionZone} area, {relativeSize} in size. {description}"}

Style: {styleDescriptor}.
Wide angle, no characters, no text, suitable as a point-and-click adventure game background.
Ensure the objects are placed accurately according to their described positions.
```

핫스팟이 없는 경우: 기존 `buildBackgroundPrompt()`와 동일하게 동작.

#### F4-04: AIBackgroundModal UI 업데이트

**추가 UI 요소**:

1. **컨텍스트 미리보기 섹션** (접기/펼치기 가능):
   - "씬 오브젝트 컨텍스트 (N개 핫스팟)" 헤더
   - 핫스팟 목록을 테이블 형태로 표시 (`label`, `positionZone`, `relativeSize`)
   - 핫스팟이 없으면 "배치된 핫스팟 없음 — 자유 설명만 사용합니다" 안내

2. **생성 프롬프트 미리보기 및 편집**:
   - "생성될 프롬프트 초안" 레이블
   - 자동 생성된 프롬프트를 `<textarea>`에 표시 (편집 가능)
   - 사용자는 프롬프트를 직접 수정하거나 복사할 수 있다
   - "복사" 버튼: 클립보드에 현재 프롬프트 복사 (외부 이미지 도구 사용 시 활용)

3. **기존 "장면 설명" 입력란**: 유지 (프롬프트의 `userDescription`으로 사용)

**AI 이미지 생성 흐름 업데이트**:
- "배경 생성" 버튼 클릭 시: 편집된 프롬프트를 `sceneDescription`으로 전달
- `generateBackground()` 호출 시 편집 가능한 프롬프트 텍스트를 그대로 사용

#### F4-05: 프롬프트 실시간 업데이트

사용자가 "장면 설명" 텍스트를 변경하거나 스타일을 변경하면 프롬프트 미리보기가 실시간으로 업데이트된다.

- `useEffect` 또는 `useMemo`로 `description`, `style`, `hotspotContexts`가 변경될 때마다 `buildContextualBackgroundPrompt()` 재호출
- 사용자가 프롬프트를 직접 편집한 경우, "장면 설명"이나 스타일 변경 시 "자동 생성 프롬프트로 초기화" 버튼을 표시하여 명시적으로 리셋 가능

#### F4-06: 수락 기준

| # | 기준 |
|---|------|
| AC4-1 | AIBackgroundModal이 열릴 때 현재 씬의 핫스팟이 컨텍스트 미리보기에 표시된다 |
| AC4-2 | 핫스팟의 위치(positionZone)와 크기(relativeSize)가 씬 dimensions에 따라 올바르게 계산된다 |
| AC4-3 | 핫스팟 정보가 자동으로 프롬프트에 포함된다 |
| AC4-4 | 생성된 프롬프트를 사용자가 직접 편집할 수 있다 |
| AC4-5 | "복사" 버튼 클릭 시 프롬프트가 클립보드에 복사된다 |
| AC4-6 | 장면 설명 변경 시 프롬프트 미리보기가 실시간으로 업데이트된다 |
| AC4-7 | 핫스팟이 없는 씬에서는 기존 방식(자유 텍스트만)으로 동작한다 |
| AC4-8 | 배경 생성 버튼 클릭 시 편집된 프롬프트가 사용된다 |

---

## 비기능 요구사항

### 성능

- **NF-01**: 핫스팟 컨텍스트 JSON 생성 및 프롬프트 빌드는 씬당 최대 100개 핫스팟 기준 1ms 이내에 완료되어야 한다.
- **NF-02**: 익스포트 시 브라우저 메인 스레드 블로킹을 최소화한다. `Blob` 생성 이전 단계(JSON 직렬화, HTML 조립)는 동기 처리 허용, 단 50MB 초과 프로젝트는 `Worker` 사용 권장 (Open Question).
- **NF-03**: PuzzleEditorPanel은 세그먼트 최대 50개 기준으로 렌더링 지연 없이 동작해야 한다.

### 접근성

- **NF-04**: 모든 신규 버튼과 입력 필드에 `aria-label` 또는 `title` 속성을 부여한다.
- **NF-05**: 모달 열기/닫기 시 포커스를 적절히 관리한다 (모달 열릴 때 첫 번째 포커스 가능 요소로 이동, 닫힐 때 트리거 버튼으로 반환).

### 타입 안전성

- **NF-06**: 모든 신규 컴포넌트는 TypeScript strict mode를 준수하며, `any` 사용을 최소화한다.
- **NF-07**: `packages/exporter/src/browser-export.ts`의 신규 함수는 `packages/exporter/src/index.ts`에서 re-export한다.

### 코드 구조

- **NF-08**: `AIBackgroundModal`의 핫스팟 컨텍스트 생성 로직은 순수 함수로 분리하여 독립적으로 테스트 가능하게 한다.
- **NF-09**: 익스포트 브라우저 함수는 React 의존성 없이 `@gi-engine/exporter` 패키지 내에 구현하여 재사용 가능하게 한다.

---

## 범위 외 (Out of Scope)

- `SubPuzzle` 타입 (character_id, timeline, scenario, relationship) 편집 UI — 스토어 액션은 구현되어 있으나 UI는 이번 스펙의 범위 밖
- `Case.prerequisites` (선행 조건) 편집 UI
- `Case.thumbnail` 이미지 업로드 UI
- `partiallyCorrectWordIds` 편집 UI (AnswerKeyEditor에서 정답만 지원)
- 익스포트 진행 중 취소 기능
- 익스포트 파일을 로컬 파일 시스템 경로에 직접 저장 (브라우저 다운로드만 지원)
- AI 이미지 생성 결과의 "다시 생성" 루프 (1회 생성 후 닫기)
- 핫스팟 polygon 타입의 정밀한 공간 분석 (bounding box 근사값 사용)
- 다국어 프롬프트 생성 (프롬프트는 항상 영어로 생성)

---

## UI/UX 노트

### 사건 설명 편집

- `CaseProperties`는 기존 `SceneProperties`와 동일한 패딩/스타일링 적용
- `LocalizedTextInput`의 multiline variant를 활용 (`rows={4}`)
- 제목 위에 "📁 [사건 이름]" 형식으로 섹션 헤더 표시

### 퍼즐 편집 패널

- `activePanel === 'puzzle'`로 전환 시 메인 캔버스 영역에 `PuzzleEditorPanel`을 전체 너비로 표시 (캔버스 대신 또는 하단 분할 방식)
- 세그먼트 편집은 행(row) 단위 테이블 형태로 구성
- 프리뷰는 패널 상단에 고정, 세그먼트 수정 시 실시간 갱신
- 퍼즐 패널에서 씬 탭으로 복귀 버튼 제공

### 익스포트 모달

- 기존 `AIBackgroundModal`과 동일한 모달 스타일 (430px 너비, `--bg-panel`, 그림자)
- 완료 화면의 파일 크기는 색상 코딩: 10MB 미만 초록, 10~30MB 노랑, 30MB 초과 빨강

### AI 배경 모달 개선

- 기존 레이아웃 최대한 유지, 프롬프트 미리보기 섹션만 추가
- 컨텍스트 섹션은 기본 접힌 상태 (핫스팟이 있을 때만 기본 펼침)
- 모달 높이 증가: 기존 고정 레이아웃에서 `max-height: 80vh` + 내부 스크롤로 변경

---

## 오픈 이슈 (Open Questions)

| # | 질문 | 영향 범위 |
|---|------|----------|
| OQ-1 | ProjectTree에서 CaseNode 클릭 시 현재 `sceneId`가 null로 초기화되는가, 아니면 마지막으로 선택된 sceneId가 유지되는가? 후자라면 CaseProperties가 표시되지 않을 수 있다. | F1-01, F1-03 |
| OQ-2 | 퍼즐 편집 패널을 캔버스 영역을 대체하는 방식으로 표시할지, 오른쪽 패널에 표시할지 결정 필요. 캔버스 대체 방식은 씬과 퍼즐을 동시에 볼 수 없다는 단점이 있다. | F2-01, F2-02 |
| OQ-3 | AI 퍼즐 생성 시 `wordBank`에는 현재 Case의 단어만 포함할지, 전체 `words` 배열을 사용할지 결정 필요. `Word.caseId` 필드가 있으므로 Case 단위 필터링이 가능하다. | F2-05 |
| OQ-4 | 브라우저 익스포트 시 Runtime JS를 어떻게 번들에 포함시킬지 결정 필요. (a) Vite `?raw` import, (b) build 후 상수 문자열로 하드코딩, (c) 에디터 빌드 시 외부 런타임 URL 참조 중 선택. | F3-03 |
| OQ-5 | 익스포트가 50MB를 초과하는 경우 Web Worker 사용 여부. 에디터의 현재 타겟 사용자(소규모 콘텐츠 창작자)를 고려하면 당장 필요하지 않을 수 있다. | NF-02 |
| OQ-6 | `partiallyCorrectWordIds` 편집 지원 여부. 이 기능이 있으면 "거의 맞는" 답변에 대한 힌트 피드백이 가능하지만, UX 복잡도가 올라간다. | F2-04 |
| OQ-7 | 나노바나나 또는 기타 외부 AI 이미지 도구용 프롬프트를 별도 "외부 도구용 프롬프트" 섹션으로 분리할지, 아니면 기존 Imagen 프롬프트와 동일하게 사용할지 결정 필요. | F4-03, F4-04 |
| OQ-8 | `ariaLabel`이 비어있는 핫스팟의 label을 어떻게 폴백할지: `examine` action의 `content.ko` 첫 줄 vs. `title` vs. 핫스팟 ID 사용 중 선택. | F4-01 |

---

## 의존성 및 사전 작업

| 의존성 | 설명 | 완료 여부 |
|--------|------|----------|
| `Case.description` 필드 | 타입에 정의됨, `makeDefaultCase()`에서 초기화됨 | 완료 |
| `updateCase()` 스토어 액션 | description 포함한 `Partial<Omit<Case, 'scenes' \| 'puzzles'>>` patch 지원 | 완료 |
| `updatePuzzleTemplate()` 스토어 액션 | 구현됨 | 완료 |
| `updatePuzzleAnswers()` 스토어 액션 | 구현됨 | 완료 |
| `generatePuzzle()` AI 함수 | `packages/ai/src/generators/puzzle-generator.ts`에 구현됨 | 확인 필요 |
| `assembleHtml()` 익스포트 함수 | 브라우저 호환 순수 함수 — 확인 필요 | 확인 필요 |
| `LocalizedTextInput` 공유 컴포넌트 | `packages/editor/src/components/shared/LocalizedTextInput.tsx`에 구현됨 | 완료 |
| `ActivePanel` 타입에 `'puzzle'` 포함 | `editor-store.ts` line 48에 정의됨 | 완료 |
