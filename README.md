# GIEngine

Golden Idol 스타일의 추리/연역 게임 엔진입니다. 에디터로 게임을 제작하고, 런타임으로 플레이하며, 익스포터로 독립 실행 HTML 파일로 배포할 수 있습니다.

## 패키지 구성

| 패키지 | 역할 |
|--------|------|
| `packages/core` | 게임 데이터 타입, 비즈니스 로직 |
| `packages/editor` | 게임 제작 GUI 에디터 (Vite + React) |
| `packages/runtime` | 게임 플레이어 (Vite 라이브러리 빌드) |
| `packages/exporter` | 게임을 독립 실행 HTML로 번들링 |
| `packages/ai` | AI 보조 콘텐츠 생성 (Gemini API) |

## 사용자 가이드

더 자세한 내용은 **[docs/guide/](docs/guide/index.md)** 를 참고하세요.

- [빠른 시작 — AI Quick Create로 5분 안에 첫 게임 만들기](docs/guide/quick-start.md)
- [에디터 기본 조작](docs/guide/editor-basics.md)
- [씬 관리](docs/guide/scene-management.md)
- [오디오 시스템](docs/guide/audio-system.md)
- [게임 익스포트](docs/guide/export.md)
- [키보드 단축키 참조표](docs/guide/keyboard-shortcuts.md)

---

## 빠른 시작

### 사전 요구 사항

- Node.js 18+
- npm 9+

### 설치

```bash
npm install
```

### 에디터 실행

```bash
npm run dev --workspace=@gi-engine/editor
```

브라우저에서 `http://localhost:5174` 접속.

### 샘플 게임 내보내기

1. 에디터에서 게임 프로젝트를 열거나 새로 만듭니다.
2. 상단 메뉴 **File → Export** 를 클릭합니다.
3. 생성된 `game.html` 파일을 브라우저에서 열면 독립 실행됩니다.

또는 프로그래밍 방식으로:

```ts
import { bundle } from '@gi-engine/exporter';

const result = await bundle({ project, outputPath: './game.html' });
```

## 검증 루프

변경 후 아래 커맨드로 모든 검사를 한 번에 실행하세요:

```bash
npm run ci:check
```

이 커맨드는 다음 순서로 실행됩니다:

1. **lint** — `.ts` / `.tsx` 파일 및 테스트 파일 정적 분석
2. **typecheck** — TypeScript 전체 빌드 타입 검사
3. **test** — 각 패키지 단위 테스트
4. **build** — 전체 워크스페이스 프로덕션 빌드

개별 실행:

```bash
npm run lint          # 린트만
npm run typecheck     # 타입 체크만
npm test              # 테스트만
npm run build         # 빌드만
```

특정 패키지 테스트:

```bash
npx vitest run packages/core
npx vitest run packages/editor
```

## 프로젝트 구조

```
gi-engine/
├── packages/
│   ├── core/       # 타입 & 로직 (의존성 없음)
│   ├── editor/     # React 에디터 앱
│   ├── runtime/    # 게임 플레이어 라이브러리
│   ├── exporter/   # HTML 번들러
│   └── ai/         # AI 생성 도우미
├── e2e/            # Playwright E2E 테스트
├── DESIGN.md       # 디자인 시스템 가이드
└── CLAUDE.md       # 에이전트 지침
```

## Vercel 배포

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-org/gi-engine)

에디터를 Vercel에 배포하려면:

1. 이 저장소를 Vercel에 연결합니다.
2. 빌드 설정은 `vercel.json`에 이미 구성되어 있습니다:
   - **Build Command**: `npm install && npm run build --workspace=packages/editor`
   - **Output Directory**: `packages/editor/dist`
3. 환경 변수는 **불필요**합니다. Gemini API 키는 에디터 내 설정 화면에서 입력하며 브라우저 localStorage에 저장됩니다.
4. 배포 후 제공되는 URL로 에디터에 바로 접근할 수 있습니다.

> SPA 라우팅을 위한 fallback(`/* → /index.html`)이 `vercel.json`에 설정되어 있습니다.

## 기여 가이드

- 변경 전 `npm run ci:check` 통과 확인
- 커밋 메시지: `type(scope): description` (Conventional Commits)
- 새 기능은 `packages/<pkg>/tests/` 에 테스트 추가
