<!-- /autoplan restore point: /c/Users/devfa/.gstack/projects/GIEngine/main-autoplan-restore-20260331-131235.md -->
# 서브 퍼즐 UX 개선 — 스마트 피커 + 에셋 관리

**Date:** 2026-03-31
**Branch:** main
**Status:** reviewed (autoplan)

---

## Problem Statement

서브 퍼즐 편집기의 모든 ID 필드가 raw 텍스트 입력 형식이다. 게임 디자이너(개발자가 아닌)는 어떤 단어 ID, 에셋 ID가 존재하는지 알 수 없어 서브 퍼즐 컨텐츠 작성이 막혀 있다.

현재 고통점:
- `answerId` / `correctWordId`: 단어 ID를 직접 타이핑 (어떤 단어들이 있는지 목록이 없음)
- `portrait`: 에셋 ID를 직접 타이핑 (어떤 이미지들이 있는지 목록이 없음)
- `slotId`, `nameSlotId`: 직접 입력 (실수 유발)
- `fromNodeId`, `toNodeId`: 직접 입력 (어떤 노드가 있는지 목록이 없음)
- 에셋 업로드/뷰/편집 기능이 서브 퍼즐 컨텍스트에 전무

---

## Scope

### In Scope

**Task 1: WordDropdown에 singleSelect 모드 추가**
- `packages/editor/src/components/words/WordDropdown.tsx` 수정
- 기존 multi-select WordDropdown에 union type prop 추가:
  ```ts
  type WordDropdownProps =
    | { caseId: string; singleSelect: true; wordId: string; onChangeSingle: (id: string) => void; label?: string }
    | { caseId: string; singleSelect?: false; wordIds: string[]; onChange: (ids: string[]) => void; label?: string }
  ```
- 컴포넌트 내부: `if (props.singleSelect)` 로 TypeScript 타입 내로우잉 사용
- `singleSelect=true` 시: `string` 단일 값으로 동작, 선택 즉시 드롭다운 닫힘, 칩 하나만 표시
  - **선택된 칩**: `border: 1px solid var(--accent)` (흐리게 처리 없음, 강조)
  - **× 버튼**: 칩에 포함, 클릭 시 `onChangeSingle('')` 호출 (clear)
  - **항상 표시되는 검색 input**: 드롭다운 패널 상단 (multi-select와 동일)
  - **ESC 키**: `useClickOutside` 훅으로 처리 (Task 1-Hook 참고)
- **dangling ref 스타일링**: 현재 wordId가 케이스 단어 목록에 없는 경우 칩을 `color: var(--danger), borderColor: var(--danger)`로 표시
- 성능: 드롭다운 내 케이스 단어 필터링: **⚠️ ENG-2**: `useEditorStore(s => s.words.filter(w => w.caseId === caseId), shallow)` — `shallow` comparator 필수 (`import { shallow } from 'zustand/shallow'`). `.filter()`는 매 render마다 새 배열을 만들어 `Object.is` 비교 실패 → shallow 없이는 성능 이점 없음
- 기존 `#f59e0b` 하드코딩 색상 → `var(--accent)`으로 교체 (ENG-13)
- **단어 없을 때 empty state**: "이 사건에 단어가 없습니다" 메시지 + "→ 단어 관리 열기" 버튼 (`setActivePanel('words')` 호출)

**Task 1-Hook: useClickOutside 훅 추출 (신규)**
- **⚠️ ENG-8**: WordDropdown, ImageAssetPicker, NodeSelect 3곳에서 outside-click + ESC 로직 중복
- 신규: `packages/editor/src/hooks/useClickOutside.ts`
  ```ts
  export function useClickOutside(
    ref: React.RefObject<HTMLElement | null>,
    onClose: () => void,
    isOpen: boolean
  ): void
  ```
  - `document.addEventListener('mousedown', handler)` — ref 외부 클릭 시 `onClose()`
  - `document.addEventListener('keydown', handler)` — `Escape` 키 시 `onClose()`
  - `isOpen=false` 시 이벤트 리스너 등록 안 함
  - `useEffect` cleanup으로 리스너 제거 (메모리 누수 방지)
- WordDropdown의 기존 outside-click useEffect를 이 훅으로 교체

**Task 2: ImageAssetPicker 컴포넌트**
- 신규: `packages/editor/src/components/shared/ImageAssetPicker.tsx`
- Props: `{ assetId: string, onChange: (id: string) => void }`
- 선택된 에셋 있을 때: 썸네일 미리보기 (48x48px, object-fit: cover) + 에셋 ID (작은 글씨, JetBrains Mono 11px `var(--text-muted)`) + × 버튼 (clear)
- 선택 안 됨: 점선 박스 + "이미지 선택 또는 업로드" 텍스트
- **⚠️ CRITICAL (Design #1)**: 피커 wrapper에 `position: relative` 적용. 패널은 absolute + 방향 로직:
  - 기본: wrapper 아래로 열림 (top: 100%)
  - 아래 공간 < 280px 일 때: 위로 열림 (bottom: 100%) — `ref.getBoundingClientRect()` 사용
  - z-index: 100 (dropdown 50보다 위, modal 200보다 아래)
- 패널 내부: 이미지 에셋 그리드 `grid-template-columns: repeat(auto-fill, minmax(40px, 1fr))`, max-height: 240px, overflow-y: auto
  - 썸네일: 40x40px object-fit: cover, border-radius: 2px
  - 선택된 항목: `border: 2px solid var(--accent)` (강조, 흐리게 처리 없음)
  - hover: tooltip으로 에셋 ID 표시 (`title={asset.id}`)
- 업로드 버튼 + 파일 input (image/*)
  - **업로드 진행 중**: 버튼 비활성화 + "업로드 중..." 텍스트 + 스피너 (`opacity: 0.6, pointerEvents: 'none'`)
  - **업로드 에러**: 빨간 테두리 (`border-color: var(--danger)`) + 에러 메시지 텍스트
- FileReader → inline base64로 에셋 추가
  - ID 생성: `` `asset_img_${Date.now()}-${Math.random().toString(36).slice(2, 7)}` `` (충돌 방지)
  - `addAsset({ id, type: 'image', src: '', inline: base64, mimeType: file.type, size: file.size })`
  - **업로드 완료 후 자동 선택**: `onChange(newId)` 즉시 호출 + 패널 닫힘
- 썸네일 src: `inline` base64 우선, 없으면 `src` URL
  - **깨진 이미지 처리**: `onError` 핸들러로 회색 placeholder + 깨진 아이콘 표시 (`background: var(--bg-primary), content: '🖼'`)
- outside-click + ESC 닫힘: `useClickOutside(panelRef, () => setOpen(false), isOpen)` 훅 사용
- **⚠️ ENG-7**: `Object.values(assets.items).filter(a => a.type === 'image')` — 이미지 에셋만 표시 (audio, font 제외)
- 에셋 없는 프로젝트: 그리드 대신 "에셋이 없습니다" + 업로드 버튼만

**Task 3: 슬롯 ID 자동 생성 + 읽기 전용 표시**
- `CharacterIdFields.tsx`: `nameSlotId` 필드 → 읽기 전용 작은 라벨 (JetBrains Mono 11px, `var(--text-muted)`)
  - **위치**: `answerId` 필드 아래로 이동 (현재 위치에서 변경, Design #15)
- `TimelineFields.tsx`: `slotId` 필드 → 읽기 전용 라벨 (JetBrains Mono 11px, `var(--text-muted)`)
- `RelationshipFields.tsx`: `edge.slotId` → 읽기 전용 라벨 (JetBrains Mono 11px, `var(--text-muted)`)
- ⚠️ `ScenarioFields.tsx`: 슬롯 키는 **편집 가능 유지** — template.segments의 slotId와 바인딩되므로 자동 생성 불가. `correctWordId`만 WordSelect로 개선.
- 생성 시: `slot_${Date.now()}` (기존 동일, 단 UI에서 읽기전용 라벨로 표시)
- 모든 읽기 전용 ID 표시: JetBrains Mono 11px, `var(--text-muted)`, padding: '2px 4px', background: 'var(--bg-primary)', borderRadius: 2

**Task 4: CharacterIdFields 개선**
- `portrait` → `ImageAssetPicker` 사용
- `answerId` → WordDropdown singleSelect 모드 사용
- `nameSlotId` → 자동 생성된 ID 읽기 전용 표시

**Task 5: TimelineFields 개선**
- `answerId` → WordDropdown singleSelect 모드 사용
- `slotId` → 읽기 전용 표시

**Task 6: RelationshipFields 개선**
- `fromNodeId`, `toNodeId` → 퍼즐 자체의 nodes 배열에서 선택하는 NodeSelect 인라인 컴포넌트 (RelationshipFields.tsx 내부 local function)
  - WordDropdown 패널 아키텍처/스타일 재사용 (별도 피커 아님)
  - 옵션 표시: label.ko가 있으면 `${node.label.ko} (${node.id})`, 없으면 `(${node.id})` — Design #11
  - `value=''` 일 때: "노드 선택..." placeholder 텍스트 표시 — Design #4b
  - **⚠️ CRITICAL (Design #2)**: 노드 없을 때 empty state: "노드가 없습니다" 메시지 + "+ 노드 추가" 버튼
  - **⚠️ ENG-5**: 노드 삭제 시 해당 노드를 참조하는 edge의 fromNodeId/toNodeId를 `''`로 리셋. `removeNode` 핸들러 내부에서: `puzzle.edges.map(e => ({ ...e, fromNodeId: e.fromNodeId === nodeId ? '' : e.fromNodeId, toNodeId: e.toNodeId === nodeId ? '' : e.toNodeId }))` 실행
  - outside-click + ESC: `useClickOutside` 훅 사용
- `edge.slotId` → 읽기 전용 (JetBrains Mono)
- `edge.answerId` → WordDropdown singleSelect 사용
- node `id` 직접 편집 제거 → 자동 생성 후 label.ko만 편집 가능
- node `id` 읽기 전용 표시: JetBrains Mono 11px `var(--text-muted)`
- **node `portrait` 추가**: `nodes` 배열의 `portrait?: AssetRef` 필드 — `ImageAssetPicker`로 편집
  (types.ts에 이미 정의된 필드인데 현재 UI에서 편집 불가)

**Task 7: ScenarioFields 개선**
- 슬롯 키: 편집 가능 유지 (template 참조 키이므로 자동 생성 불적합)
- `correctWordId` → WordDropdown singleSelect 사용

**Task 8: styles.ts CSS 변수 교체**
- `packages/editor/src/components/puzzle/sub-puzzle-fields/styles.ts`
- `dangerBtnStyle`: `color: '#ef4444'` → `color: 'var(--danger)'`, `borderColor: '#ef4444'` → `borderColor: 'var(--danger)'`
- `var(--partial)` 변수 사용: 부분 정답 스타일이 있을 경우 `#d4963a` 하드코딩 → `var(--partial)` 또는 `var(--accent)`로 교체

### Out of Scope (TODOS)
- 참조 무결성 검증 (answerId/portrait가 삭제된 단어/에셋을 가리킬 때 경고) — 내보내기/저장 시 검증으로 별도 작업
- 관계 퍼즐 시각적 그래프 편집기
- 에셋 에디터 패널 전체 재설계
- 시나리오 template-answer 자동 동기화
- 단어 인라인 생성 (서브 퍼즐 컨텍스트에서 바로 새 단어 만들기)
- partial correct words (시나리오 퍼즐)

---

## Affected Files

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `packages/editor/src/hooks/useClickOutside.ts` | 신규 | outside-click + ESC 공유 훅 (ENG-8) |
| `packages/editor/src/components/words/WordDropdown.tsx` | 수정 | singleSelect 모드 추가, shallow memoized selector (ENG-2), #f59e0b→var(--accent) (ENG-13) |
| `packages/editor/src/components/shared/ImageAssetPicker.tsx` | 신규 | 이미지 에셋 선택 + 업로드, image 필터 (ENG-7) |
| `packages/editor/src/components/puzzle/sub-puzzle-fields/CharacterIdFields.tsx` | 수정 | ImageAssetPicker, WordDropdown singleSelect, 슬롯ID 읽기전용 |
| `packages/editor/src/components/puzzle/sub-puzzle-fields/TimelineFields.tsx` | 수정 | WordDropdown singleSelect, 슬롯ID 읽기전용 |
| `packages/editor/src/components/puzzle/sub-puzzle-fields/RelationshipFields.tsx` | 수정 | NodeSelect(인라인), node portrait, WordDropdown singleSelect, ID 읽기전용, removeNode 캐스케이드 (ENG-5) |
| `packages/editor/src/components/puzzle/sub-puzzle-fields/ScenarioFields.tsx` | 수정 | WordDropdown singleSelect (correctWordId만) |
| `packages/editor/src/components/puzzle/sub-puzzle-fields/styles.ts` | 수정 | #ef4444 → var(--danger) (Task 8) |

---

## Verification

1. `npx tsc --build` — 타입 에러 없음
2. 서브 퍼즐 탭 → Character ID 퍼즐 → 초상화 필드가 이미지 피커로 표시
3. 이미지 업로드 → 그리드에 나타남 → 선택 → 썸네일 표시
4. answerId 필드 → 단어 드롭다운 → 케이스 단어 목록 표시 → 선택
5. Timeline/Scenario/Relationship answerId 모두 WordDropdown singleSelect
6. 관계 퍼즐 엣지 fromNodeId/toNodeId → 노드 라벨+ID 드롭다운 표시
7. 관계 퍼즐 노드 portrait → ImageAssetPicker 표시
8. CharacterIdFields/TimelineFields/RelationshipFields 슬롯 ID 읽기 전용 확인
9. ScenarioFields 슬롯 키 편집 가능 (답안 correctWordId는 WordSelect)
10. 단어 없는 케이스 → "단어 없음" 안내 메시지 표시
11. 에셋 없는 프로젝트 → 이미지 피커 빈 그리드 + 업로드 버튼
12. 노드 삭제 후 해당 노드 참조 엣지 fromNodeId/toNodeId가 ''로 리셋 확인

---

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | WordSelect 신규 생성 → WordDropdown singleSelect 확장 | Mechanical | P4 (DRY) | 신규 컴포넌트는 WordDropdown의 80%를 중복 | WordSelect.tsx 신규 파일 |
| 2 | CEO | RelationshipPuzzle node portrait → Task 6에 추가 | Mechanical | P2 (boil lakes) | blast radius 내 (RelationshipFields 수정 중), types.ts에 이미 정의된 필드 | 별도 태스크로 분리 |
| 3 | CEO | ScenarioFields label 필드 → 제거 | Mechanical | P5 (explicit) | "types 수정 불필요"와 모순. 슬롯 키를 편집 가능으로 유지하면 label 불필요 | label?: string 타입 추가 |
| 4 | CEO | ScenarioFields 슬롯 키 자동 생성 → 제거 | Mechanical | P3 (pragmatic) | template.segments slotId와 answers 키 바인딩 필요, 자동 생성 시 template 편집 필요 | 슬롯 키 자동 생성 |
| 5 | CEO | 에셋 업로드 ID → Date.now()-random | Mechanical | P5 (explicit) | 단순 Date.now()은 동일 밀리초 충돌 가능 | Date.now() 단독 |
| 6 | CEO | ImageAssetPicker 오버레이 → absolute + outside-click | Mechanical | P5 (explicit) | WordDropdown 패턴과 일관성, portal 불필요 (z-index: 100으로 충분) | portal rendering |
| 7 | CEO | WordDropdown 케이스 필터 → memoized store selector | Mechanical | P5 (explicit) | useWords() 전체 배열 구독 → 모든 단어 변경 시 재렌더링 (N개 인스턴스 환경) | useMemo 유지 |
| 8 | CEO | NodeSelect 표시 → label+id 조합, 노드 삭제 시 dangling ref 클리어 | Mechanical | P5 (explicit) | 동일 라벨 노드 구분 필요, stale ref 방지 | 라벨만 표시 |
| 9 | CEO | 참조 무결성 검증 → TODOS.md defer | Mechanical | P3 (pragmatic) | blast radius 외부, 별도 내보내기 검증 피처 | 이번 플랜에 포함 |
| 10 | CEO | Template-scenario 자동 동기화 → TODOS.md defer | Mechanical | P3 (pragmatic) | 별도 기능, ScenarioFields 슬롯 키 편집 유지로 현재 워크플로우 보전 | 이번 플랜에 포함 |
| 11 | Design | ImageAssetPicker: position:relative on wrapper + 방향 로직 | Mechanical | P1 (complete) | 스크롤 컨테이너 내 absolute 패널이 clipping됨 (CRITICAL) | overflow:visible hack |
| 12 | Design | NodeSelect: empty state "노드가 없습니다" + "+ 노드 추가" | Mechanical | P1 (complete) | 노드 없는 RelationshipPuzzle에서 fromNodeId/toNodeId 선택 불가 (CRITICAL) | 에러 없이 빈 드롭다운 |
| 13 | Design | WordDropdown singleSelect: 선택된 칩 accent border, 흐리게 처리 없음 | Mechanical | P1 (complete) | 선택된 항목을 dimmed 처리하면 "선택됨"이 아닌 "사용 불가"로 오해 | 나머지 항목 dimming |
| 14 | Design | WordDropdown singleSelect: empty state에 "단어 관리 열기" 버튼 추가 | Mechanical | P1 (complete) | 단어가 없을 때 사용자가 다음 행동을 모름 | 텍스트 메시지만 |
| 15 | Design | WordDropdown singleSelect: dangling ref → var(--danger) 스타일 | Mechanical | P5 (explicit) | 존재하지 않는 단어 ID 참조 시 사용자에게 명확한 경고 필요 | 일반 칩과 동일 스타일 |
| 16 | Design | WordDropdown singleSelect: 검색 input 항상 표시 | Mechanical | P5 (explicit) | multi-select 패턴과 일관성, 단어 목록이 길 수 있음 | 단어 10개 이상일 때만 |
| 17 | Design | ImageAssetPicker: 업로드 진행 중 상태 (spinner/disabled) | Mechanical | P1 (complete) | 업로드 중 중복 클릭 방지, 진행 상태 피드백 | 진행 상태 없음 |
| 18 | Design | ImageAssetPicker: 업로드 에러 상태 (var(--danger) border + 메시지) | Mechanical | P1 (complete) | 업로드 실패 시 사용자 피드백 없으면 혼란 | 오류 무시 |
| 19 | Design | ImageAssetPicker: 깨진 이미지 onError fallback | Mechanical | P1 (complete) | src가 유효하지 않을 때 broken 이미지 아이콘이 UI 깨트림 | onError 미처리 |
| 20 | Design | ImageAssetPicker: 업로드 완료 후 자동 선택 + 패널 닫힘 | Mechanical | P1 (complete) | 업로드 후 수동으로 방금 업로드한 이미지를 다시 찾아 클릭해야 하는 불필요한 단계 | 수동 선택 |
| 21 | Design | NodeSelect: empty label.ko fallback → `(${node.id})` | Mechanical | P5 (explicit) | 라벨 없는 노드는 옵션 목록에서 빈 텍스트로 표시됨 | 빈 문자열 표시 |
| 22 | Design | 모든 읽기 전용 ID: JetBrains Mono 11px var(--text-muted) | Mechanical | P5 (explicit) | DESIGN.md: ID는 JetBrains Mono 표시 규칙 | 기본 폰트 |
| 23 | Design | styles.ts dangerBtnStyle: 하드코딩 #ef4444 → var(--danger) | Mechanical | P5 (explicit) | DESIGN.md: var(--danger: #c44040) 사용 규칙, 테마 일관성 | #ef4444 하드코딩 |
| 24 | Design | CharacterIdFields: nameSlotId를 answerId 아래로 이동 | Mechanical | P1 (complete) | 편집 중인 답안 ID가 자동 생성 슬롯 ID보다 사용 빈도 높음, 위에 배치가 더 자연스러움 | 기존 순서 유지 |
| 25 | Design | NodeSelect: value='' → "노드 선택..." placeholder | Mechanical | P5 (explicit) | 빈 값 상태와 선택됨 상태를 시각적으로 구분 | 빈 칩 |
| 26 | Design | z-index 스케일 문서화: 50(드롭다운), 100(피커), 200(모달) | Mechanical | P5 (explicit) | 일관된 레이어링, 기존 모달 위에 피커가 열리지 않도록 | 임시 z-index |
| 27 | Design | ImageAssetPicker: 그리드 minmax(40px,1fr) + max-height 240px | Mechanical | P5 (explicit) | 에셋 그리드가 컨테이너를 넘치지 않도록 | 고정 크기 |
| 28 | Design | 선택된 에셋 항목: 2px accent border 하이라이트 | Mechanical | P5 (explicit) | 어떤 이미지가 현재 선택됐는지 그리드에서 즉시 식별 | 스타일 없음 |
| 29 | Design | ImageAssetPicker: thumbnail title={asset.id} tooltip | Mechanical | P3 (pragmatic) | 에셋 ID 확인 방법 제공 (저비용, 선택 안 해도 됨) | tooltip 없음 |
| 30 | Design | ESC 키: 모든 드롭다운/피커 닫힘 | Mechanical | P5 (explicit) | 표준 UX 패턴, 키보드 사용자 지원 | ESC 미지원 |
| 31 | Design | WordDropdown singleSelect: 칩에 × 버튼 (onChangeSingle('') clear) | Mechanical | P5 (explicit) | 선택 해제 방법 필요, × 없으면 갇힘 | 재선택으로 제거 |
| 32 | Eng | Zustand selector shallow comparator 필수 (ENG-2) | Mechanical | P5 (explicit) | .filter()는 새 배열 참조 생성 → Object.is 실패 → shallow 없으면 성능 이점 없음 | useSelector without shallow |
| 33 | Eng | removeNode에서 edge 댕글링 ref 캐스케이드 클리어 (ENG-5) | Mechanical | P1 (complete) | 삭제된 노드를 참조하는 edge가 빈 fromNodeId/toNodeId=''로 리셋되어야 stale ref 방지 | 수동 처리 |
| 34 | Eng | ImageAssetPicker: type==='image' 필터 (ENG-7) | Mechanical | P5 (explicit) | assets.items에 audio/font도 포함됨, 이미지만 표시해야 함 | 필터 없음 |
| 35 | Eng | useClickOutside 훅 추출 (ENG-8) | Mechanical | P4 (DRY) | WordDropdown+ImageAssetPicker+NodeSelect 3곳 동일 outside-click+ESC 로직 → 훅으로 추출 | 인라인 중복 |
| 36 | Eng | WordDropdown #f59e0b → var(--accent) (ENG-13) | Mechanical | P5 (explicit) | DESIGN.md: 하드코딩 색상 금지 규칙 | #f59e0b 유지 |
| 37 | Eng | AssetDefinition 타입 호환성 확인 (ENG-1) | Mechanical | P5 (explicit) | addAsset({id, type:'image', src:'', inline:base64, mimeType, size}) — types.ts와 완전 호환 확인됨 | 타입 변경 불필요 |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | issues_open → resolved | 10 findings (1 critical, 3 high, 6 medium), all addressed |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | issues_open → resolved | 25 findings (2 critical, 11 high, 9 medium, 3 low), all addressed as mechanical auto-decisions |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | issues_open → resolved | 15 findings (2 high, 7 medium, 6 low), all addressed as mechanical auto-decisions. Test plan artifact written. |
| Dual Voices | autoplan-voices | Independent challenge | 2 (subagent-only) | complete | Codex unavailable both runs |

**VERDICT:** FULLY REVIEWED — CEO + Design + Eng. 37 auto-decisions (all mechanical), 1 taste decision (탭 vs 통합 — user-directed). 0 user challenges outstanding. Ready for implementation.
