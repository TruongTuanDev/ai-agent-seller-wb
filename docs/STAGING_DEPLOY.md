# STAGING DEPLOY

## Muc tieu

- Chay duoc ban seller-ready demo tren VPS
- Mac dinh an toan: `WB_WRITE_DRY_RUN=true`
- De rollback nhanh neu demo gap su co

## VPS requirements

- Ubuntu 22.04 LTS hoac tuong duong
- 2 vCPU
- 4 GB RAM
- 30 GB SSD
- Docker Engine + Docker Compose plugin
- Domain cho web va API

## Docker va Compose

1. Cai Docker va Compose plugin
2. Clone repo
3. Tao file `.env` tu `.env.staging.example`
4. Chay:

```bash
docker compose config
docker compose build
docker compose up -d postgres redis
```

Neu staging chay ca API/Web bang Docker, co the dung compose hien tai lam baseline va them service production rieng theo nhu cau VPS.

## Env checklist

- `NODE_ENV=production`
- `DATABASE_URL` dung host DB staging
- `REDIS_URL` dung host Redis staging
- `JWT_SECRET` manh
- `ENCRYPTION_KEY` manh va backup an toan
- `API_BASE_URL` va `WEB_BASE_URL` dung domain staging
- `AI_PROVIDER=gemini` neu co key, neu khong co the dung `mock`
- `GEMINI_API_KEY` co hoac de trong de fallback mock
- `ENABLE_REAL_WB_API=true` chi khi can doc WB that
- `WB_WRITE_DRY_RUN=true` bat buoc de giu che do demo an toan
- `TELEGRAM_BOT_TOKEN` chi can neu muon gui that

## Database migrate va seed

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
```

Seed staging nay duoc toi uu de demo:

- Demo Mode
- Copilot prompts
- review queue tieng Nga
- snapshots 14 ngay cho cau hoi "Tai sao don giam?"

## Nginx reverse proxy

Map:

- `app.example.com` -> web `:3000`
- `api.example.com` -> api `:4000`

Can bat:

- `proxy_set_header Host $host;`
- `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
- `proxy_set_header X-Forwarded-Proto $scheme;`

## SSL

- Dung Let's Encrypt
- Renew tu dong bang certbot hoac reverse proxy manager

## Extension config cho staging

1. `pnpm --filter @wb/extension build`
2. Load unpacked `apps/extension/dist`
3. Trong popup, set API URL = staging API, vi du `https://api.example.com`
4. Login bang demo account staging
5. Mo side panel
6. Chay prompt `Tai sao don giam?`

## Rollback guide

1. Dat `WB_WRITE_DRY_RUN=true`
2. Neu can, dat `ENABLE_REAL_WB_API=false`
3. Redeploy image/commit truoc do
4. Restart API
5. Verify:
   - `GET /health`
   - `GET /ready`
   - login demo
   - copilot chat

## Dry-run safety guide

- Khong tat `WB_WRITE_DRY_RUN` trong staging demo thong thuong
- Khong mo real write cho `UPDATE_PRICE`, `UPDATE_STOCK`, `UPDATE_PRODUCT_CONTENT`, `UPDATE_AD_BID`
- `REPLY_REVIEW` van can:
  - approve
  - confirm lan 2
  - live checklist pass

## Smoke sau deploy

```bash
powershell -ExecutionPolicy Bypass -File scripts/staging-smoke.ps1 `
  -ApiBaseUrl https://api.example.com `
  -WebBaseUrl https://app.example.com `
  -Email demo@wb-agent.local `
  -Password Demo123456!
```
