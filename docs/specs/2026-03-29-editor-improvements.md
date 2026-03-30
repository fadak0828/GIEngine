# Editor Improvements — 기능 명세서

**문서 버전**: 1.0.0
**작성일**: 2026-03-29
**범위**: Phase 5 에디터 개선 (이름 수정 UI, 핫스팟 드래그/리사이즈 버그 수정, 배경 이미지 + AI 에셋 생성)
**관련 설계 문서**: `docs/designs/2026-03-29-gi-editor.md`

---

## 1. 기능 1 — 트리 노드 인라인 이름 수정

### 1.1 개요

ProjectTree의 막(Act), 사건(Case), 씬(Scene) 노드에서 이름(title/name)을 에디터 UI 내에서 직접 수정할 수 있도록 인라인 편집 기능을 제공한다. 현재는 이름을 변경하려면 오른쪽 속성 패널로 이동해야 하는데, 이 마찰을 제거하는 것이 목적이다.

### 1.2 현재 상태 분석

`packages/editor/src/components/tree/ProjectTree.tsx`를 보면:

- **ActNode**: `act.title[ui.editorLocale]`을 `<span>`으로 표시하고, 클릭 시 expand/collapse만 처리한다. 이름 편집 진입점이 없다.
- **CaseNode**: `caseData.title[ui.editorLocale]`을 `<span>`으로 표시하고, 클릭 시 selection 업데이트만 처리한다.
- **SceneNode**: `scene.name[ui.editorLocale]`을 단순 텍스트로 표시하고, 클릭 시 scene 선택만 처리한다.

스토어(`editor-store.ts`)에는 `updateAct(actId, patch)`, `updateCase(caseId, patch)`, `updateScene(caseId, sceneId, patch)` 액션이 모두 구현되어 있어 실제 데이터 변경 경로는 존재한다. UI 레이어에서 편집 진입점만 추가하면 된다.

### 1.3 기능 설명

**더블클릭 인라인 편집 패턴**

각 노드(ActNode, CaseNode, SceneNode)의 이름 표시 영역을 더블클릭하면:
1. 텍스트가 `<input>`으로 전환된다.
2. 현재 `ui.editorLocale`에 해당하는 값이 input value로 채워진다.
3. Enter 키 또는 input blur 이벤트 시 저장된다.
4. Escape 키 시 변경 없이 취소된다.
5. 저장 시 `updateAct` / `updateCase` / `updateScene`을 호출하여 현재 locale의 값만 업데이트한다.

**수정 범위**: 현재 `ui.editorLocale`에 해당하는 locale 값만 수정한다. 다른 locale 값은 속성 패널의 `LocalizedTextInput`을 통해 수정한다.

**LocalizedText 필드 매핑**:
- Act: `title` (`LocalizedText`)
- Case: `title` (`LocalizedText`)
- Scene: `name` (`LocalizedText`)

### 1.4 수락 기준

| # | 기준 | 방법 |
|---|------|------|
| AC-1 | ActNode 이름 영역 더블클릭 시 input이 나타나고 포커스된다 | 수동 테스트 |
| AC-2 | CaseNode 이름 영역 더블클릭 시 input이 나타나고 포커스된다 | 수동 테스트 |
| AC-3 | SceneNode 이름 영역 더블클릭 시 input이 나타나고 포커스된다 | 수동 테스트 |
| AC-4 | Enter 또는 blur 시 스토어에 변경사항이 반영된다 (isDirty=true) | 스토어 상태 확인 |
| AC-5 | Escape 키 시 원래 이름이 유지된다 | 수동 테스트 |
| AC-6 | 빈 문자열로 저장 시 기존 이름을 유지한다 (빈 이름 방지) | 수동 테스트 |
| AC-7 | 편집 중 다른 노드를 클릭해도 blur 이벤트로 저장이 처리된다 | 수동 테스트 |
| AC-8 | 편집 input이 열린 상태에서 트리 노드의 select/expand 기본 동작이 발생하지 않는다 | 수동 테스트 |

### 1.5 UI 상세

- input 스타일: 노드 텍스트와 동일한 폰트 크기/색상 유지, 배경은 `var(--bg-card)`, 테두리는 `1px solid var(--accent)`, border-radius 3px
- input 너비: 기존 span 너비에 맞춰 `flex: 1` 또는 고정 최소 폭(80px)
- 편집 중 expand/collapse 아이콘과 액션 버튼(추가, 삭제)은 그대로 표시

---

## 2. 기능 2 — 핫스팟 드래그/리사이즈 버그 수정

### 2.1 개요

씬 캔버스에서 핫스팟을 `select` 도구로 선택한 후 드래그 이동 또는 리사이즈 핸들 조작이 동작하지 않는 버그를 수정한다.

### 2.2 근본 원인 분석

코드를 분석한 결과 두 가지 핵심 문제가 확인되었다.

#### 문제 1: `useCanvasDrag` 훅이 SceneCanvas에 연결되어 있지 않음

`packages/editor/src/hooks/useCanvasDrag.ts`에 완성된 드래그 로직(`startDrag`, `dragState`, `onDragStart`, `onDragMove`, `onDragEnd` 콜백)이 구현되어 있다.

그러나 `packages/editor/src/components/canvas/SceneCanvas.tsx`를 보면 `useCanvasDrag`를 **import하거나 호출하는 코드가 없다**. 캔버스 컴포넌트는 `draw_rect` 도구용 포인터 이벤트만 직접 구현하고 있으며, `select` 도구로 선택된 핫스팟에 대한 드래그/리사이즈 이벤트 처리가 전혀 없다.

#### 문제 2: `HotspotOverlay`의 `onHotspotPointerDown` 콜백이 전달되지 않음

`packages/editor/src/components/canvas/HotspotOverlay.tsx`는 `onHotspotPointerDown?: (e: React.PointerEvent, hotspotId: string) => void` prop을 선언하고 있으며, 각 핫스팟 `<rect>`의 `onPointerDown`에 바인딩하고 있다.

그러나 `SceneCanvas.tsx`에서 `HotspotOverlay`를 렌더링하는 코드를 보면:

```tsx
<HotspotOverlay
  hotspots={scene.hotspots}
  selectedHotspotId={selection.hotspotId}
  scaleX={scaleX}
  scaleY={scaleY}
  onSelect={id => { ... }}
  // onHotspotPointerDown prop이 전달되지 않음
/>
```

`onHotspotPointerDown`이 `undefined`로 전달되기 때문에 핫스팟의 `onPointerDown`이 `undefined`가 되어 드래그 시작이 불가능하다.

#### 문제 3: 리사이즈 핸들의 `onPointerDown` 미구현

`HotspotOverlay.tsx`의 리사이즈 핸들(8개 `<rect>`)에는 `style={{ cursor }}`만 있고 `onPointerDown` 핸들러가 없다. 방향별 리사이즈 모드(`resize-nw`, `resize-n` 등)를 시작하는 핸들러가 연결되지 않았다.

#### 문제 4: `scaleX`/`scaleY` 계산 시점 문제

`SceneCanvas.tsx`에서:

```tsx
const scaleX = scene ? (containerRef.current?.clientWidth ?? 800) / scene.dimensions.width : 1;
const scaleY = scene ? (containerRef.current?.clientHeight ?? 450) / scene.dimensions.height : 1;
```

`containerRef.current`가 null인 초기 렌더 시점에 800/450 기본값을 사용한다. 이 값은 이후 `useCanvasDrag`에서 좌표 변환에 사용될 `canvasRectRef`와 일치하지 않을 수 있다. 실제 캔버스 크기는 CSS `aspect-ratio`에 의해 결정되므로 `getBoundingClientRect()`를 통해 정확한 크기를 읽어야 한다.

### 2.3 수정 방향

1. **`SceneCanvas`에 `useCanvasDrag` 연결**: `canvasRectRef`를 생성하고, `containerRef`의 getBoundingClientRect 결과를 저장하는 콜백을 구성한다. `useCanvasDrag`의 `onDragMove`에서 핫스팟의 임시 위치를 로컬 state로 관리하고, `onDragEnd`에서 `updateHotspotArea`를 호출한다.

2. **`onHotspotPointerDown` prop 전달**: `SceneCanvas`에서 `HotspotOverlay`를 렌더링할 때 `onHotspotPointerDown` 콜백을 전달한다. `select` 도구 활성 시에만 전달하며, 콜백 내부에서 해당 핫스팟을 선택하고 `startDrag(e, 'move')`를 호출한다.

3. **리사이즈 핸들에 `onPointerDown` 추가**: `HotspotOverlay`의 각 리사이즈 핸들에 `onPointerDown` prop을 추가한다. 핸들의 cursor 이름(`nw-resize` → `resize-nw`)을 `DragMode`에 매핑하여 `onHotspotPointerDown` 계열 콜백을 호출한다. `SceneCanvas`에서 `onResizeHandlePointerDown?: (e: React.PointerEvent, hotspotId: string, mode: DragMode) => void` prop을 추가로 전달한다.

4. **드래그 중 핫스팟 시각적 피드백**: 드래그/리사이즈 중 핫스팟의 임시 위치를 로컬 state로 관리하여 실시간으로 위치/크기가 반영되도록 한다. `onDragEnd` 시 최종 값을 스토어에 반영한다.

5. **`scaleX`/`scaleY` 계산 수정**: `useLayoutEffect` 또는 포인터 이벤트 발생 시점에 `getBoundingClientRect()`를 호출하여 실제 렌더 크기를 사용한다.

### 2.4 수락 기준

| # | 기준 | 방법 |
|---|------|------|
| AC-1 | `select` 도구에서 핫스팟 클릭 시 선택(파란색 하이라이트)된다 | 수동 테스트 |
| AC-2 | 선택된 핫스팟을 드래그하면 실시간으로 이동 미리보기가 표시된다 | 수동 테스트 |
| AC-3 | 드래그 완료(pointerup) 후 핫스팟의 `area.x`, `area.y`가 스토어에 업데이트된다 | 스토어 상태 확인 |
| AC-4 | 8개의 리사이즈 핸들 각각을 드래그하면 해당 방향으로 크기가 조절된다 | 수동 테스트 |
| AC-5 | 리사이즈 완료 후 핫스팟의 `area.width`, `area.height`가 스토어에 업데이트된다 | 스토어 상태 확인 |
| AC-6 | 드래그/리사이즈 중 `draw_rect` 신규 그리기 동작이 발생하지 않는다 | 수동 테스트 |
| AC-7 | 핫스팟 크기가 최소값(10x10 scene px) 미만으로 리사이즈되지 않는다 | 수동 테스트 |
| AC-8 | 캔버스 경계 밖으로 핫스팟이 이동되지 않는다 (scene 좌표 클램핑) | 수동 테스트 |

---

## 3. 기능 3 — 배경 이미지 + AI 에셋 생성 (Phase 5)

### 3.1 개요

씬 배경 이미지 업로드/변경 기능을 에디터에 통합하고, Google Gemini API를 활용하여 게임 콘텐츠(배경 이미지, 스토리 텍스트, 퍼즐 질문)를 자동 생성하는 `packages/ai` 패키지를 추가한다.

### 3.2 기능 3-A: 씬 배경 이미지 관리

#### 현재 상태

`Scene` 타입(`packages/core/src/models/types.ts`)에 `background: AssetRef`가 존재하며, `SceneCanvas.tsx`는 `bgAsset`을 찾아 이미지를 렌더링하는 코드도 갖추고 있다. 그러나 에디터 UI에서 배경 이미지를 업로드하거나 선택하는 기능이 없다.

에셋 저장 방식: `AssetDefinition.inline`에 base64 문자열을 저장하고 `AssetManifest.items`에 등록하는 패턴이 이미 존재한다.

#### 기능 설명

**씬 배경 설정 UI** (SceneCanvas 툴바 또는 씬 속성 패널에 추가):
- "배경 이미지 업로드" 버튼: 파일 선택 다이얼로그 → `FileReader.readAsDataURL` → base64 추출 → `addAsset` → `updateScene(caseId, sceneId, { background: assetId })`
- "배경 이미지 제거" 버튼: `updateScene(caseId, sceneId, { background: '' })`
- 현재 배경 이미지 썸네일(32x32) 미리보기 표시

지원 형식: JPEG, PNG, WebP (최대 5MB)

**핫스팟 이미지 설정** (HotspotProperties 패널 내):
- `examine_image` 타입 액션에서 image AssetRef를 지정하는 기존 필드와 연계
- 핫스팟 선택 후 오른쪽 속성 패널에서 액션 타입을 `examine_image`로 선택하고 이미지를 업로드/선택할 수 있음

#### 수락 기준

| # | 기준 | 방법 |
|---|------|------|
| AC-1 | 씬 선택 상태에서 배경 이미지 업로드 버튼이 표시된다 | 수동 테스트 |
| AC-2 | 이미지 파일 선택 시 캔버스에 배경이 즉시 반영된다 | 수동 테스트 |
| AC-3 | 배경 이미지가 AssetManifest에 등록되고 Scene.background에 assetId가 저장된다 | 스토어 상태 확인 |
| AC-4 | 배경 이미지 제거 시 캔버스가 기본 체크보드 패턴으로 돌아간다 | 수동 테스트 |
| AC-5 | 5MB 초과 파일 선택 시 오류 메시지를 표시한다 | 수동 테스트 |
| AC-6 | 프로젝트 저장/불러오기 시 배경 이미지(base64)가 유지된다 | 수동 테스트 |

### 3.3 기능 3-B: AI 에셋 생성 (`packages/ai`)

#### 패키지 구조

```
packages/ai/
├── package.json
│   └── dependencies: @google/generative-ai ^0.21.0
├── tsconfig.json
└── src/
    ├── index.ts               # 공개 API 엔트리
    ├── client.ts              # GeminiClient (API 키 관리, 공통 설정)
    ├── generators/
    │   ├── background.ts      # generateBackground(): Imagen을 이용한 배경 이미지 생성
    │   ├── story.ts           # generateStory(): Gemini Text를 이용한 스토리/사건 설명 생성
    │   └── puzzle.ts          # generatePuzzle(): Gemini Text를 이용한 퍼즐 질문/답 생성
    ├── prompts/
    │   ├── background.ts      # 배경 이미지 생성 프롬프트 템플릿
    │   ├── story.ts           # 스토리 생성 프롬프트 템플릿
    │   └── puzzle.ts          # 퍼즐 생성 프롬프트 템플릿
    └── types.ts               # 요청/응답 인터페이스
```

#### 사용 Gemini API

| 목적 | 모델 | API |
|------|------|-----|
| 배경 이미지 생성 | `imagen-3.0-generate-002` | `@google/generative-ai` ImageGenerationModel |
| 스토리/사건 설명 생성 | `gemini-2.0-flash` | `generateContent` (text) |
| 퍼즐 질문/답 생성 | `gemini-2.0-flash` | `generateContent` (text, structured output/JSON mode) |

#### 생성 콘텐츠 상세

**배경 이미지 생성** (`generateBackground`)

입력:
```typescript
interface BackgroundGenerateRequest {
  sceneDescription: string;   // 씬 설명 (한국어 또는 영어)
  style?: 'realistic' | 'watercolor' | 'noir' | 'cartoon';
  aspectRatio?: '16:9' | '4:3';
}
```

동작:
- 입력 설명을 영어 프롬프트로 변환하여 Imagen에 요청
- 응답: base64 PNG 이미지
- 결과를 `AssetDefinition` 형식(`{ id, type: 'image', src: '', inline: base64, mimeType: 'image/png' }`)으로 반환

출력:
```typescript
interface BackgroundGenerateResult {
  asset: AssetDefinition;
  promptUsed: string;
}
```

**스토리 생성** (`generateStory`)

입력:
```typescript
interface StoryGenerateRequest {
  caseTitle: string;
  genre?: 'mystery' | 'thriller' | 'historical';
  locale: 'ko' | 'en';
  hints?: string[];              // 포함할 키워드 힌트
}
```

동작:
- 사건 제목과 장르를 기반으로 사건 설명 텍스트를 생성
- 결과는 `LocalizedText` 형식

출력:
```typescript
interface StoryGenerateResult {
  description: LocalizedText;    // Case.description 에 직접 사용 가능
  suggestedSceneNames: LocalizedText[];  // 씬 이름 제안 목록 (최대 5개)
}
```

**퍼즐 생성** (`generatePuzzle`)

입력:
```typescript
interface PuzzleGenerateRequest {
  caseTitle: string;
  caseDescription: string;
  wordBank: Array<{ id: string; display: LocalizedText; category?: string }>;
  locale: 'ko' | 'en';
}
```

동작:
- JSON mode (`responseMimeType: 'application/json'`)로 구조화된 응답 요청
- 제공된 단어 뱅크에서 사용할 단어를 선택하고 빈칸 채우기 템플릿을 생성
- 응답은 `PuzzleTemplate`과 `Record<string, AnswerDefinition>` 형식으로 파싱

출력:
```typescript
interface PuzzleGenerateResult {
  title: LocalizedText;
  template: PuzzleTemplate;       // PuzzleSegment[] 형식 (types.ts 기준)
  answers: Record<string, AnswerDefinition>;
}
```

#### `packages/ai/src/client.ts`

```typescript
export interface GeminiClientOptions {
  apiKey: string;
}

export class GeminiClient {
  constructor(options: GeminiClientOptions);
  getTextModel(modelName?: string): GenerativeModel;       // 기본: gemini-2.0-flash
  getImagenModel(modelName?: string): ImageGenerationModel; // 기본: imagen-3.0-generate-002
}
```

API 키는 생성자 주입 방식. 에디터에서 Settings 패널을 통해 사용자가 입력하고 `localStorage`에 저장한다.

#### 에디터 통합 UI

**Settings 패널** (`GameSettingsEditor.tsx` 또는 신규 `AISettingsSection.tsx`):
- "Google Gemini API 키" 입력 필드 (type=password, localStorage 저장)
- API 키 저장/삭제 버튼

**씬 캔버스 툴바**:
- "AI 배경 생성" 버튼 (씬이 선택된 경우에만 활성화)
- 클릭 시 모달 표시: 씬 설명 textarea + 스타일 선택 + "생성" 버튼
- 생성 중 로딩 스피너 표시, 생성 완료 후 배경 자동 적용

**사건 속성 패널** (`CaseProperties.tsx`):
- "AI 스토리 생성" 버튼
- 클릭 시 장르 선택 + 힌트 키워드 입력 UI 표시
- 생성 결과로 Case.description 자동 채우기 (덮어쓰기 전 확인 다이얼로그)

**퍼즐 디자이너** (`PuzzleDesigner.tsx`):
- "AI 퍼즐 생성" 버튼
- 현재 사건의 wordBank와 description을 자동으로 컨텍스트로 사용
- 생성 결과로 PuzzleTemplate 및 Answers 자동 채우기 (덮어쓰기 전 확인 다이얼로그)

#### 수락 기준

| # | 기준 | 방법 |
|---|------|------|
| AC-1 | Settings에서 Gemini API 키를 입력하고 저장할 수 있다 | 수동 테스트 |
| AC-2 | API 키 미설정 시 AI 생성 버튼이 비활성화 또는 경고를 표시한다 | 수동 테스트 |
| AC-3 | "AI 배경 생성" 버튼 클릭 → 설명 입력 → 생성 시 씬 배경 이미지가 변경된다 | 수동 테스트 |
| AC-4 | 생성된 배경 이미지는 AssetManifest에 자동 등록된다 | 스토어 상태 확인 |
| AC-5 | "AI 스토리 생성" 버튼으로 Case.description이 채워진다 | 수동 테스트 |
| AC-6 | "AI 퍼즐 생성" 버튼으로 PuzzleTemplate과 Answers가 유효한 형식으로 채워진다 | 수동 테스트 |
| AC-7 | API 오류 발생 시 사용자에게 오류 메시지를 표시하고 기존 콘텐츠가 변경되지 않는다 | 수동 테스트 |
| AC-8 | `packages/ai`는 브라우저 환경에서 실행된다 (Node.js 전용 API 불사용) | 빌드 테스트 |

---

## 4. 범위 외 (Out of Scope)

이번 명세서에서 다루지 않는 항목:

- **다중 locale 동시 편집**: 인라인 편집은 현재 `ui.editorLocale` 단일 locale만 수정한다. 다른 locale 값 편집은 오른쪽 속성 패널 `LocalizedTextInput`을 사용한다.
- **polygon/circle 핫스팟 드래그**: `HotspotArea` 타입 중 `rect` 타입만 지원한다. `polygon`, `circle`은 이번 버그 수정 범위 밖이다.
- **AI 생성 실행취소(Undo)**: AI로 생성한 콘텐츠에 대한 undo/redo 기능은 이번 Phase에 포함하지 않는다.
- **AI 생성 배치 처리**: 여러 씬의 배경 이미지를 한 번에 생성하는 기능은 포함하지 않는다.
- **Gemini API 키 암호화 저장**: localStorage에 평문 저장한다. 보안 강화(암호화, 서버 프록시)는 후속 작업이다.
- **음성 에셋 AI 생성**: 텍스트와 이미지 에셋만 생성하며 오디오 생성은 포함하지 않는다.
- **Scene 치수(dimensions) 변경 UI**: 씬 해상도 변경은 이번 명세에 포함하지 않는다.

---

## 5. 테스트 요구사항

### 5.1 단위 테스트

| 대상 | 테스트 파일 위치 | 테스트 내용 |
|------|-----------------|-------------|
| `useCanvasDrag` 훅 | `packages/editor/src/hooks/__tests__/useCanvasDrag.test.ts` | startDrag → pointermove → pointerup 시퀀스에서 deltaX/deltaY 계산이 올바른지 검증 |
| `packages/ai/src/generators/story.ts` | `packages/ai/src/__tests__/story.test.ts` | generateStory가 `LocalizedText` 형식 응답을 반환하는지 검증 (Gemini 클라이언트 mock) |
| `packages/ai/src/generators/puzzle.ts` | `packages/ai/src/__tests__/puzzle.test.ts` | generatePuzzle이 유효한 `PuzzleTemplate` + `AnswerDefinition` 형식을 반환하는지 검증 (Gemini 클라이언트 mock) |
| `packages/ai/src/generators/background.ts` | `packages/ai/src/__tests__/background.test.ts` | generateBackground가 `AssetDefinition` 형식의 결과를 반환하는지 검증 (Imagen 클라이언트 mock) |

### 5.2 통합 테스트

| 대상 | 테스트 내용 |
|------|-------------|
| 인라인 이름 편집 | ActNode, CaseNode, SceneNode에서 더블클릭 → 입력 → 저장 플로우가 스토어 상태를 올바르게 업데이트하는지 확인 |
| 핫스팟 드래그 | SceneCanvas에서 핫스팟 드래그 시 `updateHotspotArea`가 올바른 좌표로 호출되는지 확인 |
| 배경 이미지 업로드 | 이미지 업로드 → addAsset → updateScene 호출 체인이 올바른지 확인 |

### 5.3 수동 E2E 테스트 시나리오

**시나리오 1 — 이름 편집**:
1. 새 프로젝트 생성
2. 막 추가 → 막 이름 더블클릭 → "1막" 입력 → Enter
3. 사건 추가 → 사건 이름 더블클릭 → "첫 번째 사건" 입력 → Enter
4. 씬 추가 → 씬 이름 더블클릭 → "현장" 입력 → Enter
5. 프로젝트 저장 후 불러오기 → 이름이 유지되는지 확인

**시나리오 2 — 핫스팟 드래그**:
1. 씬 선택 → `draw_rect` 도구로 핫스팟 그리기
2. `select` 도구로 전환 → 핫스팟 클릭 (선택 확인)
3. 핫스팟 드래그 → 새 위치에 이동되는지 확인
4. SE 핸들 드래그 → 크기 조절되는지 확인

**시나리오 3 — 배경 이미지**:
1. 씬 선택 → 배경 이미지 업로드 버튼 클릭 → 이미지 파일 선택
2. 캔버스에 배경이 표시되는지 확인
3. 배경 이미지 제거 → 체크보드 패턴으로 돌아오는지 확인

**시나리오 4 — AI 생성** (Gemini API 키 필요):
1. Settings에서 API 키 입력
2. AI 배경 생성 → 씬 설명 입력 → 생성 → 배경 적용 확인
3. AI 스토리 생성 → 사건 설명 채워지는지 확인
4. AI 퍼즐 생성 → PuzzleTemplate 생성되는지 확인

---

## 6. 구현 의존성 및 순서

```
[기능 2 버그 수정] → 독립 구현 가능 (가장 먼저 진행 권장)
[기능 1 이름 편집] → 독립 구현 가능
[기능 3-A 배경 이미지] → 기능 2 완료 후 병행 가능
[기능 3-B AI 생성] → 기능 3-A 완료 후 진행 (배경 이미지 적용 경로 필요)
```

---

*이 문서는 PM Agent가 생성한 명세입니다. 구현 전 승인이 필요합니다.*
