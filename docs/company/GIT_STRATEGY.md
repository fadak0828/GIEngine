# Git 활용 전략 — GIEngine

**Effective Date:** 2026-04-05  
**Document Owner:** CEO  
**Status:** Active

---

## 1. 개요

본 문서는 GIEngine 프로젝트에서 Git을 효과적으로 활용하기 위한 전략을 정의합니다. 
복수 에이전트 및 작업자가 병렬로 작업할 때 충돌과混乱을 방지하고,高效적인 개발을 위한 지침을 제공합니다.

---

## 2. Git 워크트리 (Git Worktree) 전략

### 2.1 워크트란 무엇인가

Git 워크트리는 하나의 Git 저장소를 여러 작업 디렉토리(working trees)로分裂하여 
각각 별도의 브랜치에서 작업할 수 있게 합니다. 이를 통해:

- 브랜치 전환을 위해 `git checkout`할 필요가 없음
- 여러 브랜치를 동시에 열어놓고 작업 가능
- 메인 작업 디렉토리의 깨끗한 상태 유지

### 2.2 워크트리 사용 규칙

#### 생성 규칙

```
# 기본 형식
git worktree add ../GIEngine-feature-XXX feature/xxx

# 예: 새 기능 작업용 워크트ree 생성
git worktree add ../GIEngine-worktree-scene-editor feature/scene-editor

# 예: 버그 수정용 워크트ree 생성
git worktree add ../GIEngine-hotfix-audio-bug fix/audio-crash
```

#### 워크트리 명명 규칙

| 용도 | 패턴 | 예시 |
|------|------|------|
| 기능 개발 | `GIEngine-worktree-{기능명}` | `GIEngine-worktree-scene-editor` |
| 버그 수정 | `GIEngine-hotfix-{수정사항}` | `GIEngine-hotfix-audio-crash` |
| 리팩토링 | `GIEngine-refactor-{영역}` | `GIEngine-refactor-store-types` |
| 문서 작업 | `GIEngine-docs-{주제}` | `GIEngine-docs-api-spec` |

#### 작업 완료 후 정리

```bash
# 워크트리 제거
git worktree remove ../GIEngine-worktree-XXX

# 목록 확인
git worktree list
```

### 2.3 워크트리 활용 시나리오

#### 시나리오 A: 두 개의 기능을 동시에 개발

```
메인 디렉토리 (main 브랜치)          → 현재 작업 중
../GIEngine-feature-ui              → UI 개선 작업 중
../GIEngine-feature-ai              → AI 기능 작업 중
```

#### 시나리오 B: 메인 브랜치 보호

- `main` 브랜치는 항상 배포 가능한 상태로 유지
- 모든 기능 개발은 워크트리와 feature 브랜치에서 수행
- 워크트리에서 `npm run ci:check` 통과 후 main으로 병합

#### 시나리오 C: 급한 버그 수정 중 다른 기능 작업

```
# 현재 scene-editor 기능 작업 중
# 갑자기 audio 버그 보고

# 1. 현재 작업 커밋
git add . && git commit -m "feat(editor): start scene editor panel"

# 2. 메인에서 hotfix 브랜치 워크트ree 생성
git worktree add ../GIEngine-hotfix-audio ../main -b fix/audio-bug

# 3. audio 버그 수정
cd ../GIEngine-hotfix-audio
# ... 버그 수정 작업 ...
git commit -m "fix(runtime): prevent audio crash on scene unload"
git push origin fix/audio-bug

# 4. 원래 워크트리로 복귀
cd ../GIEngine-worktree-scene-editor
```

---

## 3. Git 플로우 (Git Flow) 전략

### 3.1 브랜치 구조

```
main                    → 배포 가능한 최신 버전 (protected)
  │
  ├── feature/*         → 새 기능 개발
  │     例: feature/scene-editor, feature/ai-integration
  │
  ├── fix/*             → 버그 수정
  │     例: fix/audio-crash, fix/editor-memory-leak
  │
  ├── refactor/*        → 리팩토링 (기능 변경 없음)
  │     例: refactor/store-types, refactor/editor-state
  │
  ├── docs/*            → 문서 작업
  │     例: docs/api-spec, docs/contributing-guide
  │
  └── release/*         → 배포 준비 (버전 릴리스)
        例: release/v1.2.0
```

### 3.2 브랜치命名 규칙

```
{type}/{간단한-설명}

types:
- feature: 新기능
- fix: 버그 수정
- refactor: 코드 리팩토링
- docs: 문서
- test: 테스트 추가/수정
- chore: 빌드, 설정, 의존성 등
- perf: 성능 개선
```

### 3.3 워크플로우 단계

#### 기능 개발流程

```
1. 메인에서 새 브랜치 생성 (또는 워크트ree 생성)
   git checkout main
   git pull origin main
   git checkout -b feature/my-feature
   
   # 또는 워크트ree 사용
   git worktree add ../GIEngine-worktree-my-feature main -b feature/my-feature

2. 개발 후 검증
   npm run ci:check

3. 커밋 (Conventional Commits)
   git add .
   git commit -m "feat(editor): add new feature for scene management"
   
   Co-Authored-By: Paperclip <noreply@paperclip.ing>

4. 푸시
   git push origin feature/my-feature

5. 코드 리뷰 후 main에 병합
   git checkout main
   git pull origin main
   git merge feature/my-feature
   git push origin main

6. 필요시 워크트ree 정리
   git worktree remove ../GIEngine-worktree-my-feature
```

#### 버그 수정流程

```
1. 메인에서 fix 브랜치 생성
   git checkout main
   git pull origin main
   git checkout -b fix/issue-number-brief-description

2. 문제 재현 및 수정
   # ... 수정 작업 ...
   
3. 검증
   npm run ci:check

4. 커밋 및 푸시
   git add .
   git commit -m "fix(runtime): resolve audio crash on scene unload (FAD-123)"
   
   Co-Authored-By: Paperclip <noreply@paperclip.ing>
   
   git push origin fix/issue-number-brief-description

5. 즉시 병합 (버그 수정은 빠른 처리 필수)
   # 코드 리뷰 또는 자체 검토 후
   git checkout main
   git pull origin main
   git merge fix/issue-number-brief-description
   git push origin main
```

### 3.4 병합 전략

#### Fast-Forward 병합 (권장)

feature 브랜치에 병합 대상(main) 대비 추가 커밋만 있는 경우:

```bash
git checkout main
git merge --ff-only feature/my-feature
```

#### Squash 병합 (복잡한 커밋 히스토리 정리)

여러 작은 커밋을 하나의 의미있는 단위로 압축:

```bash
git checkout main
git merge --squash feature/my-feature
git commit -m "feat(editor): implement scene editor (closes #XX)"
```

#### Merge 병합 (커밋 히스토리 보존)

다른 사람이 작업한 브랜치와 병합할 때:

```bash
git checkout main
git merge --no-ff feature/my-feature
```

### 3.5 충돌 해결

```bash
# 1. 충돌 발생 시
git merge feature/my-feature
# CONFLICT 메시지 표시

# 2. 충돌 파일 확인
git status

# 3. 충돌 해결
#编辑器에서 수동으로 충돌 마커 제거 및 해결

# 4. 해결된 파일 staging
git add .

# 5. 병합 커밋
git commit -m "merge: resolve conflicts in store-types (refactor/store-types)"

# 6. 푸시
git push origin main
```

---

## 4. 병렬 작업 시注意事项

### 4.1 작업 전 확인

```bash
# 현재 브랜치 상태
git branch -v

# 워크트리 목록
git worktree list

# 원격 브랜치 상태
git fetch origin
git branch -r
```

### 4.2 동시에 작업해야 할 경우

두 명의 작업자가 같은 파일을 수정해야 하는 경우:

1. **미리 협의**: 어느 작업자가 어느 영역을 담당할지分配
2. **작업 영역 분리**: 가능한 한 파일/모듈 단위로 분리
3. **자주 풀**: `git pull --rebase origin main`을 자주 실행하여 변경 사항 동기화
4. **병합 빈도 증가**: 작은 단위로 자주 병합하여 충돌 규모 축소

### 4.3 공통으로 수정해야 하는 파일

`packages/core/src/types.ts`, `packages/editor/src/store/*.ts` 등 공통 파일 수정이 필요한 경우:

1. 한 명이 먼저 수정 후 커밋/푸시
2. 다른 작업자가 풀 후 자신의 수정 적용
3. 충돌 발생 시协商解决

---

## 5. 커밋 메시지 규칙 (상세)

### 5.1 형식

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### 5.2 Type 종류

| Type | 설명 | 예시 |
|------|------|------|
| feat | 새 기능 | `feat(editor): add scene property panel` |
| fix | 버그 수정 | `fix(runtime): prevent memory leak on scene unload` |
| refactor | 리팩토링 | `refactor(core): extract validation logic` |
| docs | 문서 | `docs: update API documentation` |
| test | 테스트 | `test(editor): add tests for selection store` |
| chore | 빌드/의존성 | `chore: upgrade TypeScript to 5.4` |
| style | 코드 포맷 | `style(editor): fix lint warnings` |
| perf | 성능 | `perf(runtime): optimize scene rendering` |

### 5.3 좋은 커밋 메시지 예시

```
# 좋은 예
feat(editor): add keyboard shortcuts for scene navigation

Implements Ctrl+1-9 for quick scene switching in the editor.
Supports customizable shortcuts via preferences.

Closes #45

# 나쁜 예
fix stuff
updates
WIP
```

---

## 6. 롤백 정책

### 6.1 최근 커밋 롤백

```bash
# 마지막 커밋 취소 (작업 디렉토리 유지)
git reset --soft HEAD~1

# 마지막 커밋 취소 (작업 디렉토리 भी 원복)
git reset --hard HEAD~1
```

### 6.2 배포된 커밋 롤백

```bash
# 되돌릴 커밋 찾기
git log --oneline

# 특정 커밋으로 되돌리기 (새 커밋으로)
git revert <commit-hash>

# 예: fix/audio-crash 커밋을 되돌리는 새 커밋 생성
git revert abc123

# 푸시
git push origin main
```

---

## 7. Git 설정 확인

### 7.1 권장 설정

```bash
# 사용자 정보
git config user.name "Your Name"
git config user.email "you@example.com"

# 기본 브랜치
git config init.defaultBranch main

# Pull 전략
git config pull.rebase true

# 커밋 메시지 편집기
git config core.editor vim
```

### 7.2 상태 확인

```bash
git config --list --local
```

---

## 8. 실전命令 치트시트

```bash
# ===== 기본 =====
git status              # 현재 상태
git log --oneline      # 커밋 히스토리
git diff               # 변경사항 확인

# ===== 브랜치 =====
git branch                    # 로컬 브랜치 목록
git branch -r                 # 원격 브랜치 목록
git checkout -b feature/xxx   # 새 브랜치 생성 및 전환
git checkout main             # 메인으로 전환

# ===== 워크트ree =====
git worktree list                    # 워크트리 목록
git worktree add ../wt-name main -b feature/xxx  # 새 워크트ree
git worktree remove ../wt-name       # 워크트리 제거

# ===== 동기화 =====
git fetch origin           # 원격 정보 가져오기
git pull origin main       # 풀 (리베이스 모드)
git push origin main       # 푸시

# ===== 병합 =====
git merge feature/xxx      # 병합
git merge --squash feature/xxx  # 스쿼시 병합
git merge --abort          # 병합 취소

# ===== 정리 =====
git branch -d feature/xxx  # 로컬 브랜치 삭제
git push origin --delete feature/xxx  # 원격 브랜치 삭제
```

---

## 9. 위반 시 처리

- 본 지침을 따르지 않은 커밋은 CEO가 검토 후 롤백 또는 수정 要求
- 반복적 위반 시 해당 에이전트에 환류(REF) 태스크 할당
- 심각한 경우 AGENTS.md 및 본 문서 업데이트

---

## 10. 변경 이력

| Date | Change | Author |
|------|--------|--------|
| 2026-04-05 | Initial version | CEO |

---

*본 문서는 모든 GIEngine 작업자에 필수적으로 적용됩니다.*
