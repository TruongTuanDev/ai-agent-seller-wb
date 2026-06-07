# WB Operator AI Agent

Seller-ready MVP cho "AI Operations Manager for Wildberries Sellers".

Trong phase hien tai, san pham da chuyen sang `extension-first, chat-first`: Chrome extension la trai nghiem chinh de seller hoi va giao viec theo ngon ngu tu nhien, con web dashboard giu vai tro billing, settings nang cao, admin va trang chi tiet.

Ban demo hien tai duoc toi uu cho sale/demo 3 phut:

- co `Demo Mode` ro rang
- co `Chay demo 3 phut`
- co welcome prompts cho Copilot
- co onboarding WB token de seller khong can hieu ky thuat
- co demo data song dong de tra loi thuyet phuc cho cau hoi "Tai sao don giam?"
- co multi-shop switcher ngay trong extension side panel

## Monorepo

- `apps/api`: Express + Prisma + JWT auth + AI/WB/Telegram orchestration
- `apps/web`: Next.js dashboard tieng Viet cho settings nang cao, billing placeholder, admin, Product Doctor chi tiet
- `apps/extension`: Chrome extension MV3, trai nghiem seller chinh, build ra `apps/extension/dist`
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

8. Load extension:

- vao `Chrome -> Extensions -> Load unpacked`
- chon thu muc `apps/extension/dist`
- bam icon extension hoac nut `WB Copilot` tren `seller.wildberries.ru`
- dang nhap ngay trong side panel

Luu y cho Windows/CI:

- `apps/web` dung helper `scripts/next-build-with-retry.cjs` de build Next on dinh hon tren moi truong co file lock tam thoi.

## Demo account

- Email: `demo@wb-agent.local`
- Password: `Demo123456!`
- Admin panel demo: `demo@wb-agent.local`
- Seller FREE demo: `seller@wb-agent.local` / `Demo123456!`

## Seller-ready MVP co gi

- Shop Health Report co `healthScore`, KPI summary, critical issues, growth opportunities, recommended actions
- Extension-first multi-shop Copilot:
  - dang nhap hoan toan trong side panel
  - khong can popup de auth
  - khong can nhap `shopId`, endpoint, raw JWT hay WB token raw vao chat
  - shop switcher, add/reconnect/disconnect/sync ngay trong extension
  - content-aware prompt tu `seller.wildberries.ru` de hieu "san pham nay", "review nay", "trang nay"
- SKU Problem Detector: `GET /products/:shopId/problems`
- Review Reply Queue: AI draft tieng Nga, approve, reject, confirm lan 2 truoc khi send that
- Review Reply Queue mac dinh dry-run, chi gui that khi bat real write ro rang
- Product Doctor: route web `/products/:id/doctor`
- AI Copilot chat-first:
  - API `POST /copilot/chat`
  - conversation memory voi `Conversation` + `ConversationMessage`
  - kien truc: `Message -> Intent Router -> Action Planner -> Safe Tools -> Insight Engine -> Response + Cards + Suggested Actions`
  - tool calling an toan: health, products, product problems, inventory, feedbacks, report, usage, review draft, product doctor
  - intent router: `SHOP_HEALTH | SALES_DROP_ANALYSIS | REVIEW_MANAGEMENT | PRODUCT_DOCTOR | INVENTORY_RISK | SEO_OPTIMIZATION | COMPETITOR_WATCH | ACTION_EXECUTION | USAGE_BILLING | GENERAL_HELP`
  - rich cards: health, insight, product risk, review queue, inventory risk, action plan, usage limit
  - suggested actions chi map sang flow an toan co san, khong tu execute write nguy hiem
- Rich seller cards trong extension:
  - health
  - insight
  - product risk
  - review queue
  - inventory risk
  - action plan
  - usage limit
- Seller operating mode `ASSISTANT | OPERATOR | MANAGER`
- Telegram daily alert: connect chat id, test alert, daily summary, cron 9h server time
- Telegram Copilot command dung chung backend tools: `/health`, `/reviews`, `/inventory`, `/report`
- Action Queue va AuditLog cho approve/reject/execute
- Usage card + plans placeholder + quota enforcement theo plan
- Admin panel: `/admin`
- WB token duoc test va encrypt tai backend
- Gemini provider that neu `AI_PROVIDER=gemini` va co `GEMINI_API_KEY`
- WB real mode chi doc khi `ENABLE_REAL_WB_API=true`, write action van giu luong an toan

## Bien moi truong quan trong

```env
AI_PROVIDER=mock
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

ENABLE_REAL_WB_API=false
WB_WRITE_DRY_RUN=true

TELEGRAM_BOT_TOKEN=
TELEGRAM_DAILY_ALERT_ENABLED=false
TELEGRAM_DAILY_ALERT_HOUR=9
```

Mac dinh:

- Khong co `GEMINI_API_KEY` -> AI fallback mock
- `ENABLE_REAL_WB_API=false` -> he thong van demo day du bang mock data
- `ENABLE_REAL_WB_API=true` + `WB_WRITE_DRY_RUN=true` -> doc that, write dry-run
- `ENABLE_REAL_WB_API=true` + `WB_WRITE_DRY_RUN=false` -> chi `REPLY_REVIEW` duoc phep gui that
- Action nguy hiem khong bao gio tu dong chay khi chua approve + confirm lan 2
- Rollback ve safe mode: dat `WB_WRITE_DRY_RUN=true` hoac `ENABLE_REAL_WB_API=false`
- FREE plan chi dry-run; PRO/AGENCY moi duoc real-write review reply

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

## Demo checklist

Before demo:

- docker services up
- db migrated + seeded
- API health ok
- web ok
- Gemini key ok hoac mock mode ok
- WB dry-run true
- Telegram mock/real configured
- extension loaded

## Smoke test da verify

- `GET http://localhost:4000/health` -> `{ ok: true }`
- Login demo thanh cong
- `GET /reports/shop-demo-1/latest` tra report seed moi
- `GET /products/shop-demo-1/problems` tra danh sach SKU co van de
- `POST /copilot/chat` tra answer + cards + suggestedActions
- `POST /ai/shop-demo-1/review-reply-draft` tao draft review
- `POST /ai/shop-demo-1/product-doctor` tra SEO draft
- `POST /telegram/shop-demo-1/test-alert` gui mock alert thanh cong
- `http://localhost:3000` tra HTTP `200`
- `pnpm copilot:smoke` verify intent routing, follow-up SKU context, missing data response va planner safety
- Smoke helper cho review reply safety: `scripts/smoke-reply-review.ps1`
- Smoke helper health report: `scripts/smoke-health-report.ps1`
- Smoke helper live checklist: `scripts/smoke-live-checklist.ps1`
- Smoke helper usage limit: `scripts/smoke-usage-limit.ps1`

## Tai lieu

- `docs/PRODUCT.md`
- `docs/AI_AGENT.md`
- `docs/EXTENSION.md`
- `docs/DEMO_SCRIPT.md`
- `docs/STAGING_DEPLOY.md`
- `docs/WB_API.md`
- `docs/SECURITY.md`
- `docs/CLOUD.md`
- `docs/PRODUCTION_CHECKLIST.md`
