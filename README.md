# Jigeum

Jigeum은 메일, 캘린더, 약속, 업무 맥락을 읽고 **지금 확인해야 할 결정**으로 정리하는 작업 공간입니다. 사용자는 실행 전에 근거를 보고 승인하거나 거절할 수 있고, Jigeum은 그 피드백을 다음 판단에 반영합니다.

## 지금 만드는 것

Jigeum의 첫 화면은 채팅이나 알림함이 아니라 결정함입니다. 흩어진 신호를 모아 “무엇을 봐야 하는지”, “왜 중요한지”, “어떤 행동이 준비됐는지”를 한 카드에서 확인하게 합니다.

- **결정함**: 승인 대기 작업, 약속 장부, 오늘의 리스크를 모읍니다.
- **메일**: 우선순위, 답장 필요 여부, 첨부파일/후보자 신호를 정리합니다.
- **캘린더**: 회의 준비 상태, 충돌, 다음 일정의 맥락을 보여줍니다.
- **브리핑**: 하루의 주요 신호와 상위 행동을 요약합니다.
- **설정**: Google 연결, 알림, 실행 경계, 모델, 데이터 관리 상태를 조정합니다.

## 제품 원칙

- **한국어 우선**: 핵심 사용 흐름은 한국어 UX를 기준으로 다듬습니다.
- **실행 전 승인**: 메일 발송, 캘린더 변경, 외부 전송은 사용자가 확인할 수 있어야 합니다.
- **근거 있는 자동화**: 단순 요약보다 신호, 판단, 실행 내용을 함께 보여줍니다.
- **점진적 신뢰**: 초기에는 관찰과 제안을 중심으로 동작하고, 피드백으로 범위를 넓힙니다.
- **빈 상태도 제품**: 새 사용자와 연결 전 상태에서도 다음 행동이 분명해야 합니다.

## 핵심 흐름

1. 사용자가 이메일 계정으로 로그인하거나 Google을 연결합니다.
2. API가 Gmail, Calendar, 업무 데이터에서 신호를 수집합니다.
3. 분류기와 에이전트가 답장 필요 여부, 약속, 리스크, 후보자 신호를 추출합니다.
4. 웹 앱은 결정함, 메일, 캘린더, 브리핑에 사용자에게 필요한 다음 행동만 노출합니다.
5. 사용자의 승인, 거절, 피드백은 이후 판단 정책에 반영됩니다.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 웹 | Next.js 15, React 19, TypeScript, Tailwind CSS |
| API | Fastify, TypeScript, Prisma |
| DB | PostgreSQL |
| 인증 | JWT, bcrypt, Google OAuth |
| AI | OpenRouter, Gemini fallback |
| 실시간 | WebSocket, Web Push |
| 결제 | Stripe |
| 모노레포 | pnpm workspaces |

## 구조

```text
packages/
  api/   Fastify API, Prisma schema, agent/tool orchestration
  web/   Next.js app: decision inbox, mail, calendar, briefing, settings
  core/  shared utilities and CLI-facing primitives
docs/    screenshots and operational notes
```

## 로컬 개발

### 요구 사항

- Node.js 22 이상
- pnpm
- PostgreSQL 16 권장

### 설치

```bash
git clone https://github.com/k08200/jigeum.git
cd jigeum
pnpm install
```

### API 환경 변수

```bash
cp packages/api/.env.example packages/api/.env
```

최소 실행에는 아래 값이 필요합니다.

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/jigeum"
JWT_SECRET="local-dev-secret"
TOKEN_ENCRYPTION_KEY="" # 아래 명령으로 생성한 32-byte base64 값
OPENROUTER_API_KEY=""
WEB_URL="http://localhost:8001"
PORT=8000
```

`TOKEN_ENCRYPTION_KEY`는 다음처럼 만들 수 있습니다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Google 연동을 테스트하려면 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`도 설정합니다.

### 데이터베이스

로컬 PostgreSQL을 직접 띄우거나 Docker Compose의 Postgres를 사용할 수 있습니다.

```bash
docker compose up -d postgres
pnpm --filter @jigeum/api exec prisma migrate dev
```

### 개발 서버

터미널 1:

```bash
pnpm --filter @jigeum/api dev
```

터미널 2:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000 pnpm --filter @jigeum/web dev
```

기본 포트는 API `8000`, Web `8001`입니다.

## Docker

전체 스택을 컨테이너로 띄우려면 루트 `.env`에 필요한 시크릿을 둔 뒤 실행합니다.

```bash
docker compose up --build
```

Docker Compose 기준 포트는 Web `3000`, API `3001`, PostgreSQL `5432`입니다.

## 자주 쓰는 명령

```bash
pnpm --filter @jigeum/web build
pnpm --filter @jigeum/api build
pnpm --filter @jigeum/api test
packages/api/node_modules/.bin/biome format packages/
packages/api/node_modules/.bin/biome check packages/
```

## 배포 메모

- Vercel Web: `NEXT_PUBLIC_API_URL`을 배포된 API URL로 설정합니다.
- API: `DATABASE_URL`, `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `WEB_URL`, `CORS_ORIGINS`를 환경에 맞게 설정합니다.
- Google OAuth redirect URI는 API의 `/api/auth/google/callback`을 가리켜야 합니다.
- Neon/서버리스 Postgres를 쓰는 경우 `.env.example`의 PgBouncer 메모처럼 connection 옵션을 붙입니다.

## QA 기준

핵심 UX를 바꿀 때는 적어도 아래 흐름을 확인합니다.

- 창업자: 결정함에서 승인 대기 카드를 확인하고 승인/거절까지 진행
- 세일즈: 메일 목록, 메일 상세, 답장 초안/첨부파일 신호 확인
- 운영: 캘린더 준비 상태와 브리핑 확인
- 모바일 사용자: 390px 폭에서 결정함, 메일, 하단/상단 탐색 확인
- 새 사용자: 연결 전 상태, 초기 학습 안내, 설정 첫 화면 확인

## 라이선스

MIT
