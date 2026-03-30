# PRD RAG System Design

**Date**: 2026-03-30
**Status**: Draft
**Author**: Claude + devfa

## Overview

GIEngine 프로젝트의 PRD(요구사항), 진행 상황, 남은 작업을 추적하고 조회하는 경량 RAG 시스템.
개발자가 직접 조회하기도 하고, AI 에이전트가 프로젝트 컨텍스트로 활용하기도 한다.

## Goals

1. docs/ 스펙 문서에서 PRD 요구사항을 자동 추출
2. 코드베이스와 git 히스토리를 분석해서 구현 상태를 자동 추론
3. Claude Code 스킬(`/prd`, `/prd progress`, `/prd remaining`)로 자연스럽게 조회
4. 수동 오버라이드로 자동 추론 결과를 보정 가능

## Non-Goals

- 벡터 임베딩이나 외부 AI API 사용 (키워드 + 구조 기반으로 충분)
- 웹 대시보드나 별도 UI (마크다운 출력이면 충분)
- 실시간 파일 감시 (정적 인덱스 리빌드 방식)
- 다른 프로젝트에 범용으로 쓸 수 있는 라이브러리 (GIEngine 전용)

## Architecture

```
[docs/**/*.md] ------+
[packages/*/src/**] -+-- indexer.ts --> project-index.json
[git log] ----------+     (빌드 타임)      (정적 파일)
                                              |
                                              v
                            Claude Code Skill (/prd, /progress, /remaining)
                                              |
                                              v
                                        query-engine.ts
                                              |
                                              v
                                      마크다운 응답 출력
```

### Components

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| Indexer | `scripts/prd-indexer.ts` | 프로젝트 스캔, 인덱스 생성 |
| Query Engine | `scripts/prd-query.ts` | 인덱스 읽기, 질의 처리, 마크다운 출력 |
| Claude Code Skill | `.claude/skills/prd/SKILL.md` | 사용자 인터페이스 (스킬 정의) |
| Index File | `docs/project-index.json` | 정적 인덱스 데이터 |

## Index Schema

```jsonc
{
  "version": "1.0.0",
  "generatedAt": "2026-03-30T12:00:00Z",
  "lastCommit": "30fcfc1",

  // PRD 요구사항 (docs/specs에서 추출)
  "requirements": [
    {
      "id": "REQ-001",
      "title": "게임 구조: Act > Case > Scene > Hotspot",
      "source": "docs/specs/2026-03-29-gi-engine.md",
      "section": "Core Data Model",
      "priority": "high",          // "high" | "medium" | "low"
      "status": "done",            // "done" | "in-progress" | "not-started"
      "statusSource": "auto",      // "auto" | "manual"
      "evidence": [
        "packages/core/src/models/types.ts - Game, Case, Scene, Hotspot 타입 정의",
        "commit 484444b - feat: implement GIEngine"
      ],
      "tags": ["core", "data-model"]
    }
  ],

  // 패키지별 구현 현황
  "packages": {
    "core": {
      "path": "packages/core",
      "files": 12,
      "lines": 1396,
      "testFiles": 5,
      "lastModified": "2026-03-30"
    }
  },

  // 최근 git 활동 요약
  "gitSummary": {
    "totalCommits": 5,
    "recentCommits": [
      {
        "hash": "229ca3f",
        "message": "feat: improve AI generation...",
        "date": "2026-03-30"
      }
    ],
    "activeFiles": [
      "packages/editor/src/components/ai/AIBackgroundModal.tsx"
    ]
  },

  // 수동 오버라이드 (개발자가 직접 편집, 리빌드 시 보존)
  "overrides": {
    "REQ-003": {
      "status": "in-progress",
      "note": "AI 생성 품질 개선 중"
    }
  }
}
```

### Schema Design Decisions

- `requirements[].status`는 indexer가 자동 추론. `overrides`로 수동 덮어쓰기 가능.
- `evidence` 배열로 추론 근거를 투명하게 제공. AI/사람 모두 검증 가능.
- `overrides`는 별도 섹션으로 분리. 인덱스 리빌드해도 수동 설정 보존.
- `statusSource`로 자동 추론인지 수동 오버라이드인지 명시.

## Indexer Logic

`scripts/prd-indexer.ts` 5단계 파이프라인:

### Step 1: PRD 요구사항 추출

```
docs/**/*.md 파싱 (specs, designs, QA reports, reviews 전체)
  -> 헤딩(##, ###) 기준으로 섹션 분리
  -> 각 섹션에서 요구사항 식별:
     - 체크리스트 항목 (- [ ], - [x])
     - 기능 설명 패턴 ("must", "should", "지원", "구현")
     - 넘버링된 목록
  -> REQ-001, REQ-002... ID 자동 부여 (소스파일+섹션 기반 안정 해시)
  -> 태그 추출: 파일명, 헤딩 키워드 기반
  -> 우선순위 추론: 기본 "medium". "critical", "필수", "core" 키워드 -> "high".
     "optional", "nice-to-have", "향후" 키워드 -> "low"
```

ID 생성 규칙: `REQ-{sourceFile}-{sectionIndex}` 패턴의 해시로
같은 문서의 같은 섹션은 리빌드해도 동일한 ID를 유지한다.

### Step 2: 패키지 구현 스캔

```
packages/*/src/** 스캔
  -> 파일 수, 라인 수 집계
  -> 테스트 파일 수 (*.test.ts, *.spec.ts)
  -> export된 타입/함수명 수집 (정규식: export (type|interface|function|const) \w+)
  -> package.json에서 패키지 메타 읽기
```

### Step 3: Git 히스토리 분석

```
git log --oneline -20 파싱
  -> 커밋 메시지에서 feat/fix/chore 분류
  -> git log --name-only로 변경 파일 경로 추출
  -> 커밋 메시지 키워드 -> 관련 요구사항 매핑
  -> 최근 7일 기준 활발한 파일 식별
```

### Step 4: 상태 자동 추론

각 요구사항에 대해 다음 규칙 적용:

| 조건 | 추론 상태 |
|------|-----------|
| 관련 코드 파일 존재 + 테스트 있음 | done |
| 관련 코드 파일 존재 + 테스트 없음 | done (확신도 낮음) |
| 최근 커밋에서 관련 변경 활발 | in-progress |
| 관련 코드 전혀 없음 | not-started |
| overrides에 수동 상태 존재 | 수동 값 우선 |

매칭 방식: 요구사항 제목/태그의 키워드와 코드 파일명/export명/커밋 메시지를 비교.
단순 문자열 포함(includes) 매칭. 정교한 NLP 불필요.

### Step 5: 인덱스 저장

```
1. 기존 docs/project-index.json이 있으면 overrides 섹션 읽기
2. 새 인덱스 객체 생성
3. 보존된 overrides 병합
4. overrides에 해당하는 requirements의 status/statusSource 갱신
5. docs/project-index.json에 JSON.stringify(index, null, 2)로 저장
```

### 실행 방법

```bash
# npm script로 등록
npm run prd:index    # npx tsx scripts/prd-indexer.ts

# 직접 실행
npx tsx scripts/prd-indexer.ts
```

## Query Engine

`scripts/prd-query.ts` - 인덱스를 읽고 마크다운으로 변환.

### 쿼리 타입

| 명령 | 타입 | 설명 |
|------|------|------|
| `/prd` | summary | PRD 전체 요약. 요구사항 목록, 우선순위, 상태 테이블 |
| `/progress` | progress | 진행 대시보드. 완료/진행중/미시작 비율, 패키지별 현황, 최근 git 활동 |
| `/remaining` | remaining | 남은 작업. 미완료 요구사항 + 근거, 추천 다음 작업 |

### 출력 형식

모든 출력은 마크다운. 사람이 읽기 좋고 AI도 파싱 가능.

#### `/prd` 출력 예시

```markdown
# GIEngine PRD 요약

**생성일**: 2026-03-30 | **마지막 커밋**: 30fcfc1 | **총 요구사항**: 24개

## 요구사항 목록

| ID | 제목 | 우선순위 | 상태 | 소스 |
|----|------|----------|------|------|
| REQ-001 | 게임 구조 (Act>Case>Scene) | high | done | gi-engine.md |
| REQ-002 | 디덕션 퍼즐 시스템 | high | done | gi-engine.md |
| REQ-015 | 다국어 런타임 전환 | medium | in-progress | gi-editor.md |
```

#### `/progress` 출력 예시

```markdown
# 진행 현황

## 전체: 78% (19/24 완료)
- done: 19
- in-progress: 3
- not-started: 2

## 패키지별 현황

| 패키지 | 파일 | 라인 | 테스트 | 최근 수정 |
|--------|------|------|--------|-----------|
| core | 12 | 1,396 | 5 | 2026-03-30 |
| editor | 45 | 7,255 | 3 | 2026-03-30 |
| runtime | 15 | 3,847 | 0 | 2026-03-30 |
| ai | 8 | 620 | 0 | 2026-03-30 |
| exporter | 3 | 180 | 0 | 2026-03-30 |

## 최근 git 활동
- 229ca3f feat: improve AI generation, model settings UI, and runtime deduction UX
- 32ddcf7 fix: inline assets on export, fix word display names, fix drag-drop DOM update
- d21c80e fix: wire runtime IIFE to export pipeline and fix composite action handling
```

#### `/remaining` 출력 예시

```markdown
# 남은 작업

## in-progress (3개)

1. **REQ-015**: 다국어 런타임 전환
   - 근거: i18n.ts 존재하나 runtime에서 언어 전환 UI 미구현
   - 추천: packages/runtime/src/renderer/ 에 언어 전환 로직 추가

2. **REQ-018**: AI 생성 품질 개선
   - 근거: 최근 커밋 229ca3f에서 활발히 작업 중 (수동 오버라이드)
   - 추천: 현재 진행 중, 계속 작업

## not-started (2개)

3. **REQ-022**: 게임 공유/배포 플랫폼
   - 근거: 관련 코드 없음
   - 추천: 우선순위 재평가 필요 (scope 축소 고려)
```

### 실행 방법

```bash
# npm script로 등록
npm run prd:query -- summary     # /prd
npm run prd:query -- progress    # /progress
npm run prd:query -- remaining   # /remaining

# 직접 실행
npx tsx scripts/prd-query.ts summary
npx tsx scripts/prd-query.ts progress
npx tsx scripts/prd-query.ts remaining
```

## Claude Code Skill

`.claude/skills/prd/SKILL.md` 정의:

스킬은 5가지 서브커맨드를 지원한다:

- `/prd` (인자 없음) - PRD 전체 요약 출력
- `/prd progress` - 진행 상황 대시보드
- `/prd remaining` - 남은 작업 목록
- `/prd rebuild` - 인덱스 리빌드 실행
- `/prd override <REQ-ID> <status> [note]` - 수동 상태 오버라이드

스킬 내부에서는 Bash로 스크립트를 실행하고 결과를 그대로 출력한다.
인덱스가 없으면 자동으로 리빌드를 먼저 실행한다.

## Manual Override

개발자가 자동 추론 결과를 보정하는 두 가지 방법:

1. **직접 편집**: `docs/project-index.json`의 `overrides` 섹션을 수동 편집
2. **스킬 명령**: `/prd override REQ-003 in-progress "AI 품질 개선 중"`

오버라이드는 인덱스 리빌드 시에도 보존된다.
오버라이드를 제거하려면 해당 키를 overrides에서 삭제하면 된다.

## File Structure

```
GIEngine/
  scripts/
    prd-indexer.ts       # 인덱스 생성 스크립트
    prd-query.ts         # 쿼리 엔진 스크립트
  docs/
    project-index.json   # 생성된 인덱스 (git 커밋 가능)
  .claude/
    skills/
      prd/
        SKILL.md         # Claude Code 스킬 정의
```

## Dependencies

- `tsx` (이미 devDependencies에 있다면 추가 설치 불필요)
- Node.js 내장 모듈만 사용: `fs`, `path`, `child_process` (git 명령 실행)
- 외부 패키지 의존성 없음

## Testing

- `scripts/prd-indexer.ts`와 `scripts/prd-query.ts`는 독립 스크립트로 단위 테스트보다 통합 테스트가 적합
- 테스트 방법: sample-games/의 튜토리얼 게임 데이터로 인덱스 생성 후 쿼리 결과 검증
- 스킬 테스트: `/prd`, `/prd progress`, `/prd remaining` 실행 후 출력 형식 확인

## Future Extensions

현재 설계에서 나중에 확장 가능한 부분:

- 임베딩 백엔드 추가 (키워드 매칭을 벡터 검색으로 교체)
- git delta 기반 증분 업데이트 (하이브리드 방식 C로 진화)
- 웹 대시보드 출력 (마크다운 -> HTML 변환)
- CI/CD 파이프라인에서 자동 인덱스 리빌드
