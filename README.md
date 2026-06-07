# WB Operator AI Agent

Seller-ready MVP cho "AI Operations Manager for Wildberries Sellers".

## Monorepo

- `apps/api`: Express + Prisma + JWT auth + AI/WB/Telegram orchestration
- `apps/web`: Next.js dashboard tieng Viet
- `apps/extension`: Chrome extension MV3, build ra `apps/extension/dist`
- `packages/shared`: shared types + Zod schemas
- `packages/wb-client`: Wildberries client, mac dinh mock-first

## Chay local tu dau

1. Cai dependency:

```bash
pnpm install
```

2. Dung `.env` hien co hoac copy tu `.env.example`.

3. Khoi dong Postgres + Redis:

```bash
docker compose up -d postgres redis
```

Luu y: Postgres map ra host port `5440` de tranh conflict local.

4. Apply schema:

```bash
pnpm db:migrate
```

5. Seed data demo:

```bash
pnpm db:seed
```

6. Chay web + api:

```bash
pnpm dev
```

7. Build extension unpacked:

```bash
pnpm --filter @wb/extension build
```

## Demo account

- Email: `demo@wb-agent.local`
- Password: `Demo123456!`

## Seller-ready MVP co gi

- Shop Health Report co `healthScore`, KPI summary, critical issues, growth opportunities, recommended actions
- SKU Problem Detector: `GET /products/:shopId/problems`
- Review Reply Queue: AI draft tieng Nga, approve, reject, confirm lan 2 truoc khi send that
- Product Doctor: route web `/products/:id/doctor`
- Telegram daily alert: connect chat id, test alert, daily summary, cron 9h server time
- Action Queue va AuditLog cho approve/reject/execute
- WB token duoc test va encrypt tai backend
- Gemini provider that neu `AI_PROVIDER=gemini` va co `GEMINI_API_KEY`
- WB real mode chi doc khi `ENABLE_REAL_WB_API=true`, write action van giu luong an toan

## Bien moi truong quan trong

```env
AI_PROVIDER=mock
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

ENABLE_REAL_WB_API=false

TELEGRAM_BOT_TOKEN=
TELEGRAM_DAILY_ALERT_ENABLED=false
TELEGRAM_DAILY_ALERT_HOUR=9
```

Mac dinh:

- Khong co `GEMINI_API_KEY` -> AI fallback mock
- `ENABLE_REAL_WB_API=false` -> he thong van demo day du bang mock data
- Action nguy hiem khong bao gio tu dong chay khi chua approve + confirm lan 2

## Lenh acceptance

```bash
pnpm install
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm -r lint
pnpm build
pnpm --filter @wb/extension build
```

## Smoke test da verify

- `GET http://localhost:4000/health` -> `{ ok: true }`
- Login demo thanh cong
- `GET /reports/shop-demo-1/latest` tra report seed moi
- `GET /products/shop-demo-1/problems` tra danh sach SKU co van de
- `POST /ai/shop-demo-1/review-reply-draft` tao draft review
- `POST /ai/shop-demo-1/product-doctor` tra SEO draft
- `POST /telegram/shop-demo-1/test-alert` gui mock alert thanh cong
- `http://localhost:3000` tra HTTP `200`

## Tai lieu

- `docs/PRODUCT.md`
- `docs/AI_AGENT.md`
- `docs/WB_API.md`
- `docs/SECURITY.md`
- `docs/CLOUD.md`
