# 골든 아이돌 완전 재현을 위한 GIEngine 개선 플랜

**작성일**: 2026-03-31
**목표**: The Case of the Golden Idol의 게임플레이를 GIEngine으로 완전히 재현할 수 있는 수준으로 엔진을 개선

---

## 분석 요약

PRD 기준 357개 요구사항은 모두 완료 상태다. 하지만 골든 아이돌의 실제 플레이 경험과 비교하면 **8개의 갭**이 존재한다. 이 갭들은 현재 코드에 타입은 정의되어 있으나 구현이 빠진 것들이 대부분이다.

---

## 갭 분석

### GAP-1 (심각) — BGM/배경음악 시스템 미완성

**영향 범위**: 게임 분위기의 80%를 담당. BGM 없이는 골든 아이돌의 감성 재현 불가.

**현황**:
- `AudioManager`에 BGM 코드 있음 (`bgmSource`, `bgmGain`, fade 지원)
- `AssetItem.type: 'image' | 'audio' | 'font'` — audio 타입 존재
- **없는 것**:
  - `SideEffect` 타입에 `play_bgm` 없음 (현재는 `play_sound`만)
  - `Scene` 타입에 `bgm?: AssetRef` 필드 없음
  - `NavigateAction`에서 BGM 전환 트리거 없음
  - `engine.ts`에서 씬 진입 시 BGM 자동 전환 로직 없음
  - 에디터 `SceneProperties`에 BGM 업로드/설정 UI 없음
  - 에디터에서 오디오 파일 업로드 UI 없음 (이미지만 가능)
  - `HotspotProperties`에서 `play_sound` 단독 액션 설정 불가

**관련 파일**:
- `packages/core/src/models/types.ts` (SideEffect, Scene, NavigateAction, AssetItem)
- `packages/runtime/src/engine.ts` (executeSideEffect, NAVIGATE_SCENE 처리)
- `packages/runtime/src/audio/audio-manager.ts` (playBgm 메서드 미구현)
- `packages/editor/src/components/properties/SceneProperties.tsx`
- `packages/editor/src/components/properties/HotspotProperties.tsx`

---

### GAP-2 (심각) — 씬 onEnter 액션 미실행

**영향 범위**: 씬 진입 시 애니메이션, 사운드, 레이어 변경 등 자동 이벤트 불가.

**현황**:
- `packages/core/src/models/types.ts:63` — `Scene.onEnter?: ActionSequence` 타입 정의됨
- **없는 것**:
  - `state-machine.ts`의 `NAVIGATE_SCENE` 처리에서 `onEnter` 실행 안 함
  - `engine.ts`의 side effect 파이프라인에 onEnter 연결 없음
  - 에디터 `SceneProperties`에서 `onEnter` 액션 편집 UI 없음

**관련 파일**:
- `packages/core/src/state/state-machine.ts` (NAVIGATE_SCENE 케이스)
- `packages/runtime/src/engine.ts`
- `packages/editor/src/components/properties/SceneProperties.tsx`

---

### GAP-3 (심각) — 탐색 중 수집 단어 패널 없음

**영향 범위**: 플레이어가 어떤 단어를 수집했는지 항상 확인할 수 없어 게임 플로우 단절.

**현황**:
- 단어 수집 시 일시적 toast 표시됨 (`showWordToast`)
- puzzle bar (하단 탭)에 퍼즐 목록은 표시됨
- **없는 것**: 탐색 중 수집된 단어 목록을 항상 볼 수 있는 패널

**골든 아이돌 원본 동작**:
- 화면 하단에 수집된 단어들이 항상 나열됨
- 단어를 클릭하면 어디서 수집됐는지 힌트 표시 (원본은 없지만 UX 개선 가능)
- 탐색 화면과 추론 화면 모두에서 동일한 단어 은행 공유

**관련 파일**:
- `packages/runtime/src/renderer/renderer.ts` (renderExploring)
- `packages/runtime/src/renderer/puzzle-bar-renderer.ts` (확장 또는 별도 컴포넌트)
- `packages/runtime/src/styles/main.css`

---

### GAP-4 (중간) — 씬 스크롤/패닝 없음

**영향 범위**: 뷰포트보다 넓은 씬(시장, 저택 전경 등) 재현 불가.

**현황**:
- 씬은 컨테이너에 맞게 CSS로 스케일링됨 (`transform: scale()`)
- 씬 크기가 뷰포트보다 커도 크롭되거나 축소됨
- **없는 것**: 좌우/상하 패닝, 드래그로 씬 이동

**골든 아이돌 원본 동작**:
- 일부 씬은 화면보다 넓어 좌우 드래그로 탐색
- 씬 가장자리에서 커서가 바뀌며 자동 스크롤

**관련 파일**:
- `packages/runtime/src/renderer/scene-renderer.ts`
- `packages/runtime/src/renderer/renderer.ts`
- `packages/runtime/src/styles/main.css`
- `packages/editor/src/components/canvas/SceneCanvas.tsx` (에디터도 동일 이슈)

---

### GAP-5 (중간) — 에디터 오디오 에셋 관리 UI 없음

**영향 범위**: GAP-1 구현 후에도 에디터에서 오디오 파일을 등록할 방법 없음.

**현황**:
- `AssetItem.type: 'image' | 'audio' | 'font'` 타입 존재
- `AssetManifest`에 audio 에셋 저장 가능한 구조
- **없는 것**:
  - 에디터에서 오디오(.mp3/.ogg/.wav) 업로드 UI
  - SceneProperties에서 BGM 선택 드롭다운
  - HotspotProperties에서 sound 설정

**관련 파일**:
- `packages/editor/src/components/properties/SceneProperties.tsx`
- `packages/editor/src/components/properties/HotspotProperties.tsx`
- `packages/editor/src/store/editor-store.ts` (addAsset 확장)

---

### GAP-6 (낮음) — CompositeAction delayBetween 미구현

**영향 범위**: 연속 이벤트(팝업 → 잠시 후 단어 수집 등) 타이밍 제어 불가.

**현황**:
- `packages/core/src/models/types.ts:145` — `delayBetween?: number` 타입 있음
- `state-machine.ts`에서 composite 처리 시 즉시 순차 실행, 지연 없음
- **없는 것**: side effect 파이프라인에서 타이밍 처리

**관련 파일**:
- `packages/core/src/state/state-machine.ts` (composite 처리, 534-631줄)
- `packages/runtime/src/engine.ts` (side effect 큐잉 필요)

---

### GAP-7 (낮음) — 이미지 팝업 스크롤/확대 없음

**영향 범위**: 큰 문서, 지도, 편지 이미지를 자세히 보기 어려움.

**현황**:
- `popup-renderer.ts`의 이미지 팝업은 이미지를 `object-fit: contain`으로 표시
- **없는 것**: 핀치/휠 줌, 패닝

**관련 파일**:
- `packages/runtime/src/renderer/popup-renderer.ts`
- `packages/runtime/src/styles/main.css`

---

### GAP-8 (낮음) — Polygon 핫스팟 에디터 그리기 없음

**영향 범위**: 불규칙한 모양의 오브젝트(사람 실루엣, 불규칙 물건)에 rect만 사용 가능.

**현황**:
- `HotspotArea.polygon` 타입 존재, 런타임 렌더링도 지원
- **없는 것**: 에디터 canvas에서 polygon 그리기 툴

**관련 파일**:
- `packages/editor/src/components/canvas/SceneCanvas.tsx`
- `packages/editor/src/components/canvas/HotspotOverlay.tsx`

---

## 구현 플랜

### Phase 1 — 게임 분위기 완성 (BGM + onEnter)
*가장 큰 플레이 경험 차이를 만드는 부분*

**Task 1.1: BGM SideEffect 타입 추가**
- `packages/core/src/models/types.ts`
  - `SideEffect`에 `{ type: 'play_bgm'; assetRef: AssetRef; loop?: boolean; fadeDuration?: number }` 추가
  - `SideEffect`에 `{ type: 'stop_bgm'; fadeDuration?: number }` 추가
  - `Scene`에 `bgm?: AssetRef` 필드 추가 (씬 진입 시 자동 BGM)
  - `HotspotAction`에 `PlaySoundAction` 추가: `{ type: 'play_sound'; assetRef: AssetRef }`

**Task 1.2: AudioManager BGM 메서드 구현**
- `packages/runtime/src/audio/audio-manager.ts`
  - `playBgm(assetRef, assets, loop, fadeDuration)` 구현 (이미 `bgmSource`, `bgmGain` 있음)
  - `stopBgm(fadeDuration)` 구현
  - 같은 BGM 재생 중이면 재시작 안 하는 로직

**Task 1.3: engine.ts BGM 처리 연결**
- `packages/runtime/src/engine.ts`
  - `executeSideEffect`에 `play_bgm`, `stop_bgm` 케이스 추가
  - `NAVIGATE_SCENE` 처리 시 `scene.bgm`가 있으면 자동으로 `play_bgm` side effect 발생
  - 씬 전환 시 이전 BGM과 다르면 페이드 전환

**Task 1.4: state-machine.ts onEnter 실행**
- `packages/core/src/state/state-machine.ts`
  - `NAVIGATE_SCENE` 케이스에서 `scene.onEnter` 처리 추가
  - `onEnter`의 각 액션을 `handleHotspotAction`으로 실행
  - 결과 side effects를 반환 effects에 포함

**Task 1.5: 에디터 SceneProperties BGM/onEnter 설정 UI**
- `packages/editor/src/components/properties/SceneProperties.tsx`
  - BGM 오디오 파일 업로드/선택 섹션 추가
  - onEnter 액션 시퀀스 편집 UI (HotspotProperties와 유사한 방식)
- `packages/editor/src/components/properties/HotspotProperties.tsx`
  - `play_sound` 액션 타입 추가 (오디오 파일 선택)

**Task 1.6: 에디터 오디오 에셋 업로드 지원**
- `packages/editor/src/store/editor-store.ts`
  - 이미지뿐만 아니라 오디오 파일 업로드 가능하도록 `addAsset` 확장
- `SceneProperties`에서 오디오 파일 선택 드롭다운 (audio 에셋 필터링)

---

### Phase 2 — 탐색 UX 완성 (단어 패널 + 씬 스크롤)
*골든 아이돌 탐색 경험의 핵심*

**Task 2.1: 탐색 중 수집 단어 패널**
- `packages/runtime/src/renderer/` — 새 `WordBankPanelRenderer` 추가
  - 수집된 단어들을 카테고리별로 표시하는 접이식 패널
  - 할당된 단어는 회색, 미할당은 표준 스타일
  - puzzle bar 위 또는 우측 사이드 패널로 배치
- `packages/runtime/src/renderer/renderer.ts`
  - `renderExploring`에서 `wordBankPanel.render()` 호출
  - 탐색 → 추론 화면 전환 시 단어 목록 동기화
- `packages/runtime/src/styles/main.css`
  - `.gi-word-panel` 스타일 추가

**Task 2.2: 씬 패닝/스크롤**
- `packages/core/src/models/types.ts`
  - `Scene`에 `scrollable?: boolean` 필드 추가 (기본값 false)
  - `Scene.dimensions`가 뷰포트보다 크면 자동 활성화도 고려
- `packages/runtime/src/renderer/scene-renderer.ts`
  - `scrollable` 모드 시 씬 컨테이너에 `overflow: hidden` + 패닝 핸들러
  - `pointerdown` + `pointermove`로 씬 드래그 패닝
  - 씬 가장자리 감지 → 자동 스크롤 옵션
- `packages/editor/src/components/canvas/SceneCanvas.tsx`
  - 에디터에서도 넓은 씬 편집 시 스크롤 지원

---

### Phase 3 — 인터랙션 세부 개선

**Task 3.1: CompositeAction delayBetween**
- `packages/runtime/src/engine.ts`
  - side effect 큐 시스템 구현: `{ effect, delay }[]` 배열
  - `setTimeout` 기반으로 지연 있는 액션 순차 처리
  - `composite` 액션 처리 시 `delayBetween`이 있으면 큐에 추가
- `packages/core/src/state/state-machine.ts`
  - composite 처리에서 delay 정보를 side effect로 전달하는 방법 설계

**Task 3.2: 이미지 팝업 확대/패닝**
- `packages/runtime/src/renderer/popup-renderer.ts`
  - 이미지 팝업에 wheel 이벤트 줌 (min 1x, max 3x)
  - 줌 상태에서 드래그 패닝
  - 더블클릭 → 원래 크기 복귀
- `packages/runtime/src/styles/main.css`
  - `.gi-popup-image--zoomed` 스타일

**Task 3.3: Polygon 핫스팟 에디터**
- `packages/editor/src/components/canvas/SceneCanvas.tsx`
  - 에디터 툴바에 `draw_polygon` 툴 추가
  - 클릭으로 꼭짓점 추가, 더블클릭으로 완성
  - SVG overlay에 polygon 핸들 표시
- `packages/editor/src/components/canvas/HotspotOverlay.tsx`
  - polygon 타입 핫스팟 렌더링 및 꼭짓점 드래그 편집

---

## 우선순위 매트릭스

| 갭 | 플레이 경험 영향 | 구현 난이도 | Phase |
|----|----------------|------------|-------|
| GAP-1 BGM 시스템 | ★★★★★ | 중간 | 1 |
| GAP-2 onEnter 실행 | ★★★★☆ | 낮음 | 1 |
| GAP-3 단어 패널 | ★★★★☆ | 낮음 | 2 |
| GAP-4 씬 스크롤 | ★★★☆☆ | 높음 | 2 |
| GAP-5 오디오 에디터 | ★★★☆☆ | 낮음 | 1 (1.6) |
| GAP-6 지연 액션 | ★★☆☆☆ | 중간 | 3 |
| GAP-7 이미지 줌 | ★★☆☆☆ | 낮음 | 3 |
| GAP-8 Polygon 에디터 | ★★☆☆☆ | 높음 | 3 |

---

## 영향받는 파일 목록

### Core
- `packages/core/src/models/types.ts` — SideEffect, Scene, HotspotAction 타입 확장
- `packages/core/src/state/state-machine.ts` — NAVIGATE_SCENE onEnter, composite delay

### Runtime
- `packages/runtime/src/engine.ts` — BGM side effect 처리, onEnter 연결
- `packages/runtime/src/audio/audio-manager.ts` — playBgm, stopBgm 구현
- `packages/runtime/src/renderer/renderer.ts` — 단어 패널 연결, 씬 스크롤
- `packages/runtime/src/renderer/scene-renderer.ts` — 씬 패닝
- `packages/runtime/src/renderer/popup-renderer.ts` — 이미지 줌
- `packages/runtime/src/styles/main.css` — 새 스타일

### Editor
- `packages/editor/src/components/properties/SceneProperties.tsx` — BGM, onEnter UI
- `packages/editor/src/components/properties/HotspotProperties.tsx` — play_sound 액션
- `packages/editor/src/components/canvas/SceneCanvas.tsx` — polygon 툴, 스크롤
- `packages/editor/src/components/canvas/HotspotOverlay.tsx` — polygon 편집
- `packages/editor/src/store/editor-store.ts` — 오디오 에셋 업로드

---

## Phase 1 세부 구현 명세

### 1.1 타입 변경 (`types.ts`)

```typescript
// Scene에 bgm 필드 추가
export interface Scene {
  // ... 기존 필드
  bgm?: AssetRef;           // 씬 진입 시 재생할 BGM (없으면 이전 BGM 유지)
  bgmStop?: boolean;        // true면 씬 진입 시 BGM 정지
}

// 새 HotspotAction 추가
export interface PlaySoundAction {
  type: 'play_sound';
  assetRef: AssetRef;       // 재생할 사운드 에셋 ID
}

export type HotspotAction =
  | ExamineAction
  | ExamineImageAction
  | WordRevealAction
  | NavigateAction
  | ToggleLayerAction
  | CompositeAction
  | PlaySoundAction;        // 추가

// SideEffect에 BGM 관련 추가
export type SideEffect =
  | { type: 'play_sound'; assetRef: AssetRef }
  | { type: 'play_bgm'; assetRef: AssetRef; loop?: boolean; fadeDuration?: number }
  | { type: 'stop_bgm'; fadeDuration?: number }
  | { type: 'save_game' }
  | { type: 'show_popup'; content: { body: LocalizedText; title?: LocalizedText; image?: AssetRef } }
  | { type: 'close_popup' }
  | { type: 'animation'; target: string; animation: string }
  | { type: 'unlock_case'; caseId: string }
  | { type: 'word_collected_in_popup'; wordId: string };
```

### 1.2 state-machine.ts 변경

```typescript
// NAVIGATE_SCENE 처리에서 onEnter 실행 추가
case 'NAVIGATE_SCENE': {
  const scene = findScene(caseData, event.sceneId);
  // ...기존 코드...

  // onEnter 처리
  if (scene?.onEnter && scene.onEnter.length > 0) {
    for (const action of scene.onEnter) {
      const result = handleHotspotAction(action, nextState, def, save);
      // side effects 누적
      effects.push(...result.effects);
    }
  }

  // BGM 처리 (scene.bgm 있으면 자동 재생)
  if (scene?.bgm) {
    effects.push({ type: 'play_bgm', assetRef: scene.bgm, loop: true });
  } else if (scene?.bgmStop) {
    effects.push({ type: 'stop_bgm', fadeDuration: 1000 });
  }
}
```

### 1.3 engine.ts 변경

```typescript
private executeSideEffect(effect: SideEffect): void {
  switch (effect.type) {
    // 기존 케이스들...
    case 'play_bgm':
      this.audioManager.playBgm(
        effect.assetRef,
        this.definition.assets,
        effect.loop ?? true,
        effect.fadeDuration ?? 1000
      );
      break;
    case 'stop_bgm':
      this.audioManager.stopBgm(effect.fadeDuration ?? 1000);
      break;
  }
}
```

### 1.4 audio-manager.ts 변경

```typescript
async playBgm(
  assetRef: AssetRef,
  assets: AssetManifest,
  loop = true,
  fadeDuration = 1000
): Promise<void> {
  if (!this.audioContext) return;
  if (this.currentBgmRef === assetRef) return; // 같은 BGM 재생 중

  await this.stopBgm(fadeDuration);

  // 새 BGM 로드 및 재생
  const buffer = await this.loadBuffer(assetRef, assets);
  const source = this.audioContext.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;

  this.bgmGain = this.audioContext.createGain();
  this.bgmGain.gain.setValueAtTime(0, this.audioContext.currentTime);
  this.bgmGain.gain.linearRampToValueAtTime(
    this.muted ? 0 : 1,
    this.audioContext.currentTime + fadeDuration / 1000
  );

  source.connect(this.bgmGain);
  this.bgmGain.connect(this.audioContext.destination);
  source.start();

  this.bgmSource = source;
  this.currentBgmRef = assetRef;
}

async stopBgm(fadeDuration = 1000): Promise<void> {
  if (!this.bgmGain || !this.bgmSource || !this.audioContext) return;

  const gain = this.bgmGain;
  const source = this.bgmSource;

  gain.gain.linearRampToValueAtTime(
    0,
    this.audioContext.currentTime + fadeDuration / 1000
  );

  setTimeout(() => {
    source.stop();
    source.disconnect();
    gain.disconnect();
  }, fadeDuration);

  this.bgmSource = null;
  this.bgmGain = null;
  this.currentBgmRef = null;
}
```

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run `/autoplan` for full review pipeline, or individual reviews above.
