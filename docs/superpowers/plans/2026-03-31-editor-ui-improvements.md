# Editor UI Improvements Plan
<!-- /autoplan restore point: see ~/.gstack/projects/GIEngine/main-autoplan-restore.md -->

**Date:** 2026-03-31
**Branch:** main
**Author:** autoplan
**Status:** draft

---

## Problem Statement

에디터의 오른쪽 사이드 패널(PropertiesPanel)이 과부하 상태다.

- **SceneProperties** (275줄): 씬 메타 + 배경 이미지 + BGM + LayerPanel이 수직으로 나열
- **CaseProperties + SubPuzzleEditor** (644줄): 4가지 서브 퍼즐 타입 편집기 전부가 280px 패널에
- **LayerPanel** (153줄): SceneProperties 안에 인라인으로 박혀있어 독립적으로 활용 불가능
- BGM 컨트롤: 업로드/제거만 있고 미리듣기 없음, 파일 메타데이터 부족

게임 디자이너가 관계도(relationship) 서브 퍼즐을 편집할 때 노드, 엣지, 슬롯, 정답을 모두 280px 너비에서 해야 한다. 이건 기능이 있어도 쓸 수 없는 것이다.

---

## Goals

1. **서브 퍼즐 편집 UX 개선**: SubPuzzleEditor를 풀스크린 모달로 분리
2. **레이어 관리 UX 개선**: 드래그-리오더, 이미지 썸네일, 레이어 속성 인라인 편집
3. **BGM 미리듣기**: 에디터 내에서 오디오 재생/정지
4. **SceneProperties 슬림화**: 섹션 접기/펼치기로 세로 스크롤 감소
5. **속성 패널 너비 스마트 조정**: 복잡한 콘텐츠 선택 시 자동 확장

---

## Scope

### In Scope

**Task A: SubPuzzle Editor Modal**
- SubPuzzleEditor를 전용 모달로 추출
- 모달은 `min-width: 640px`, `max-width: 900px` (복잡한 서브 퍼즐용 공간 확보)
- CaseProperties에서 각 서브 퍼즐 카드에 "편집" 버튼 추가
- 서브 퍼즐 추가(+) 버튼 클릭 시 바로 모달 오픈
- 모달 내부: 퍼즐 타입별 레이아웃 최적화
  - `character_id`: 2열 그리드 (초상화 | 이름/정답)
  - `timeline`: 좌우 분할 (슬롯 목록 | 정답 배정)
  - `relationship`: 3분할 (노드 | 엣지 | 시각 프리뷰)
  - `scenario`: 기존 Key-Value 유지 (단순)
- 파일: `packages/editor/src/components/properties/SubPuzzleModal.tsx` (신규)
- 수정: `packages/editor/src/components/properties/CaseProperties.tsx`

**Task B: LayerPanel 개선**
- 드래그-리오더 (HTML5 drag-and-drop, 외부 라이브러리 없이)
- 레이어 아이템에 이미지 썸네일 (24×24px, `object-fit: cover`)
- 레이어 선택 시 우측 패널에 LayerProperties 표시 (현재 동작) + 이름 인라인 편집
- 레이어 패널 섹션 접기/펼치기 (기본: 펼침)
- z-index 수동 입력 추가 (현재 배지로만 표시)
- 파일: `packages/editor/src/components/layers/LayerPanel.tsx` (수정)
- 파일: `packages/editor/src/components/layers/LayerProperties.tsx` (수정, 현재 상태 미확인)
- store: `reorderLayers` 액션 추가 (`packages/editor/src/store/editor-store.ts`)

**Task C: BGM 미리듣기**
- SceneProperties BGM 섹션에 "▶ 재생" / "■ 정지" 버튼 추가
- Web Audio API 또는 `<audio>` 태그 활용 (에디터 전용)
- 재생 중일 때 버튼 상태 토글
- inline base64 오디오를 data URL로 재생
- 파일: `packages/editor/src/components/properties/SceneProperties.tsx` (수정)

**Task D: SceneProperties 섹션 접기/펼치기**
- "배경 이미지", "BGM", "레이어" 각 섹션에 토글 버튼 추가
- 로컬 state로 각 섹션 open/closed 관리 (persist 불필요)
- 파일: `packages/editor/src/components/properties/SceneProperties.tsx` (수정)

**Task E: 속성 패널 너비 자동 확장**
- 현재: `rightPanelWidth` 고정 (min 240px)
- 개선: SubPuzzleModal은 독립 모달이므로 패널 너비 영향 없음
- 대신: HotspotProperties의 경우 `examine_image` 또는 `composite` 선택 시 패널 너비 300px로 자동 확장 (store `setRightPanelWidth` 호출)
- 파일: `packages/editor/src/components/properties/HotspotProperties.tsx` (수정)

### Out of Scope (TODOS)

- 레이어 간 드래그로 씬 레이어 시각화 캔버스 (Phase 2)
- 퍼즐 미리보기 in SubPuzzleModal (Phase 2)
- 관계도(relationship) 서브 퍼즐 시각적 그래프 편집기 (Phase 3)
- 핫스팟 액션 composite 서브액션 편집 개선 (Phase 2)
- BGM 파형(waveform) 시각화 (not needed)

---

## Implementation Details

### A. SubPuzzleModal

```tsx
// SubPuzzleModal.tsx
interface SubPuzzleModalProps {
  caseId: string;
  puzzle: SubPuzzle;
  onClose: () => void;
}
// Radix UI Dialog (이미 사용 중) 활용
// 편집 저장은 updateSubPuzzle store action 사용
```

CaseProperties 변경:
- SubPuzzleCard에 "편집" 버튼 추가
- `useState<SubPuzzle | null>(null)` → editingPuzzle
- editingPuzzle이 있으면 SubPuzzleModal 렌더링
- 추가 버튼 클릭 → addSubPuzzle 후 새 퍼즐로 editingPuzzle set

### B. LayerPanel 드래그-리오더

```tsx
// HTML5 DnD: onDragStart, onDragOver, onDrop
// dragItem: string | null (layerId)
// dropTarget: string | null
// store.reorderLayers(caseId, sceneId, fromIndex, toIndex)
```

editor-store.ts에 추가:
```ts
reorderLayers: (caseId, sceneId, fromIndex, toIndex) => { ... }
```

### C. BGM 미리듣기

```tsx
// SceneProperties 내부 useState
const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
const [playing, setPlaying] = useState(false);

const handleBgmPlay = () => {
  if (!bgmAsset) return;
  const src = bgmAsset.inline
    ? `data:${bgmAsset.mimeType};base64,${bgmAsset.inline}`
    : bgmAsset.src;
  if (!audioEl) {
    const el = new Audio(src);
    el.loop = false;
    el.onended = () => setPlaying(false);
    setAudioEl(el);
    el.play();
  } else {
    audioEl.pause();
    audioEl.currentTime = 0;
    setAudioEl(null);
  }
  setPlaying(p => !p);
};
// useEffect cleanup: return () => audioEl?.pause()
```

---

## Affected Files

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `packages/editor/src/components/properties/SubPuzzleModal.tsx` | 신규 | 서브퍼즐 전용 모달 |
| `packages/editor/src/components/properties/CaseProperties.tsx` | 수정 | 모달 연동, SubPuzzleEditor 인라인 제거 |
| `packages/editor/src/components/properties/SubPuzzleEditor.tsx` | 리팩터 | 모달 내부용으로 레이아웃 조정 |
| `packages/editor/src/components/layers/LayerPanel.tsx` | 수정 | DnD 리오더, 썸네일, 접기/펼치기 |
| `packages/editor/src/store/editor-store.ts` | 수정 | `reorderLayers` 액션 추가 |
| `packages/editor/src/components/properties/SceneProperties.tsx` | 수정 | BGM 미리듣기, 섹션 접기 |
| `packages/editor/src/components/properties/HotspotProperties.tsx` | 수정 | 패널 너비 자동 조정 |

---

## Test Plan

- SubPuzzleModal: 4가지 퍼즐 타입 각각 추가/편집/삭제 동작 검증
- LayerPanel DnD: 레이어 순서 변경 후 씬 렌더링 순서 일치 확인
- BGM 미리듣기: base64 인라인 오디오 재생/정지, 컴포넌트 unmount 시 정지
- SceneProperties 섹션 접기: 상태 토글 후 재선택 시 초기화 (local state)
- 빌드: `tsc --build` 에러 없음

---

## Design Additions (from Phase 2)

- SubPuzzleModal: 닫기 전 `isDirty` 체크 + 변경사항 확인 다이얼로그
- BGM 미리듣기: 로딩 상태 (버튼 disabled + "로딩 중..." 텍스트)
- LayerPanel DnD: 드래그 중 아이템 opacity 0.5, drop target 하이라이트
- `character_id` 레이아웃: 초상화 열 160px, 나머지 flex
- `relationship` 레이아웃: 2분할 (노드 | 엣지) — 시각 그래프는 Out of Scope
- 모달 높이: `max-height: 80vh`, `overflow-y: auto`

## Eng Additions (from Phase 3)

- `reorderLayers` store 액션 + 단위 테스트 1개 추가
- BGM Audio `useEffect` cleanup 필수 (메모리 누수 방지)
- Radix Dialog 이미 설치됨 — 신규 의존성 없음

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | SubPuzzle: 모달 vs 탭 → 모달 선택 | Mechanical | P5 | PuzzleEditorPanel 선례, 탭 폭발 방지 | 전용 탭 추가 |
| 2 | CEO | BGM Audio() API 사용 | Mechanical | P4 | 외부 의존성 없이 브라우저 내장 API | Web Audio API |
| 3 | CEO | relationship 시각 그래프 → Out of Scope | Mechanical | P3 | Phase 3 수준 복잡도 | 즉시 구현 |
| 4 | Design | asset picker → defer | Mechanical | P3 | Out of scope | 즉시 구현 |
| 5 | Design | 모달 닫기 전 isDirty 확인 추가 | Mechanical | P1 | 데이터 손실 방지 | 확인 없이 닫기 |
| 6 | Design | BGM 로딩 상태 추가 | Mechanical | P1 | 사용자 피드백 | 무시 |
| 7 | Design | relationship 2분할 (프리뷰 없음) | Mechanical | P3 | 프리뷰 Out of Scope | 3분할 |
| 8 | Design | 모달 max-height 80vh | Mechanical | P5 | 표준 모달 패턴 | 고정 height |
| 9 | Eng | reorderLayers 단위 테스트 추가 | Mechanical | P1 | 새 store 액션 테스트 커버 | 수동 검증만 |
| 10 | Eng | BGM Audio useEffect cleanup 명시 | Mechanical | P5 | 메모리 누수 방지 | 주석만 |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | clean | 3 auto-decisions, 0 unresolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | issues_open → resolved | 5 decisions, isDirty + loading state added |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | clean | reorderLayers test + BGM cleanup flagged |

**VERDICT:** APPROVED — 10 auto-decisions, 0 taste decisions, 0 user challenges. Ready to implement.

