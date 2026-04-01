# GIEngine 사용자 가이드

GIEngine은 **Golden Idol 스타일의 추리·연역 게임**을 만들기 위한 오픈 소스 게임 엔진입니다.
에디터로 씬과 퍼즐을 제작하고, 완성된 게임을 독립 실행 HTML 파일 하나로 배포할 수 있습니다.

---

## 무엇을 만들 수 있나요?

| 기능 | 설명 |
|------|------|
| **씬 탐색** | 배경 이미지 위에 핫스팟을 배치해 클릭 탐색 게임을 구성합니다 |
| **단어 수집** | 장면을 조사하면 단어(증거, 인물, 시간 등)를 수집할 수 있습니다 |
| **퍼즐 풀기** | 수집한 단어를 정답 슬롯에 배치해 "누가, 왜, 어떻게"를 완성합니다 |
| **AI 보조 제작** | Gemini API를 이용해 한 문장으로 게임 전체 구조를 자동 생성합니다 |
| **독립 HTML 배포** | 외부 서버 없이 단일 `.html` 파일로 게임을 공유할 수 있습니다 |

---

## 목차

1. [빠른 시작 — AI Quick Create로 5분 안에 첫 게임 만들기](quick-start.md)
2. [에디터 기본 조작 — 패널 구성과 네비게이션](editor-basics.md)
3. [씬 관리 — 생성, 핫스팟, 레이어](scene-management.md)
4. [오디오 시스템 — BGM과 효과음](audio-system.md)
5. [게임 익스포트 — 독립 실행 HTML 만들기](export.md)
6. [키보드 단축키 참조표](keyboard-shortcuts.md)

---

## 시스템 요구 사항

- **브라우저**: Chrome 108+, Firefox 110+, Safari 16+ (WebAudio API 필요)
- **개발 환경**: Node.js 18+, npm 9+ (직접 빌드 시)
- **AI Quick Create**: Gemini API 키 필요 (에디터 내 설정에서 입력)

---

## 에디터 실행

```bash
# 저장소 복제 후
npm install
npm run dev --workspace=packages/editor
```

브라우저에서 `http://localhost:5174` 접속.

또는 [배포된 에디터](https://gi-engine.vercel.app)를 바로 사용할 수도 있습니다.
