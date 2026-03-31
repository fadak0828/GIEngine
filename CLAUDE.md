# GIEngine

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Git Workflow Policy (필수)

모든 에이전트는 작업 완료 후 반드시 아래 절차를 따라야 합니다.

### 커밋 규칙

1. **작업 단위 커밋**: 하나의 작업(기능, 버그 수정, 리팩토링)이 완료되면 즉시 커밋합니다.
2. **커밋 메시지 형식**: `type(scope): description` (Conventional Commits)
   - type: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`
   - scope: 패키지명 (`core`, `editor`, `runtime`, `exporter`)
   - 예: `feat(editor): add scene property editor`
3. **Co-author 필수**: 모든 커밋에 아래 라인을 추가합니다.
   ```
   Co-Authored-By: Paperclip <noreply@paperclip.ing>
   ```
4. **커밋 전 검증**: `npm run typecheck` 또는 관련 테스트가 통과해야 커밋합니다.
5. **미커밋 작업 금지**: heartbeat 종료 시 작업 중인 변경사항이 있으면 반드시 커밋하고 푸시합니다.

### 푸시 규칙

1. **커밋 후 즉시 푸시**: 커밋 후 `git push origin main`을 실행합니다.
2. **충돌 시**: `git pull --rebase origin main` 후 다시 푸시합니다.
3. **실패 시 보고**: 푸시가 실패하면 Paperclip 이슈에 blocked 상태로 보고합니다.

### QA 검증 절차

1. **타입 체크**: `npm run typecheck` 통과 필수
2. **관련 테스트**: 변경된 패키지의 테스트 실행 (`npx vitest run packages/<pkg>`)
3. **빌드 검증**: 주요 변경 시 `npm run build` 확인
4. **커밋 순서**: 검증 통과 → 커밋 → 푸시

### 위반 시

- 미커밋 작업이 발견되면 해당 에이전트의 다음 heartbeat에서 최우선으로 커밋/푸시를 수행합니다.
- 반복 위반 시 CEO가 에이전트 지침을 강화합니다.

## Windows UTF-8 인코딩 (필수)

이 프로젝트는 Windows CP949 환경에서 실행됩니다. curl 인라인 데이터(-d)에 한글을 포함하면
인코딩이 깨집니다. **반드시 아래 패턴을 사용하세요.**

### curl로 한글 포함 JSON 전송 시

```bash
# 잘못된 방법 (인코딩 깨짐)
curl -d '{"body":"한글 텍스트"}' ...

# 올바른 방법 (파일 기반 전송)
TMPFILE=$(mktemp /tmp/paperclip-XXXXXX.json)
printf '{"body":"한글 텍스트"}' > "$TMPFILE"
curl --data-binary "@$TMPFILE" -H "Content-Type: application/json" ...
rm -f "$TMPFILE"
```

이 규칙은 Paperclip API 호출(코멘트, 이슈 생성/수정, 문서 업데이트 등) 뿐만 아니라
한글이 포함된 모든 HTTP 요청에 적용됩니다.
