# CLOUD

## Production env checklist

- `JWT_SECRET` manh, rieng cho production
- `ENCRYPTION_KEY` manh, luu backup an toan
- `ENABLE_REAL_WB_API=false` + `WB_WRITE_DRY_RUN=true` la safe mode mac dinh
- `ENABLE_REAL_WB_API=true` + `WB_WRITE_DRY_RUN=true` cho phep doc that nhung write van dry-run
- `ENABLE_REAL_WB_API=true` + `WB_WRITE_DRY_RUN=false` moi cho phep gui `REPLY_REVIEW` that
- `UPDATE_PRICE`, `UPDATE_STOCK`, `UPDATE_PRODUCT_CONTENT`, `UPDATE_AD_BID` van khong mo real-write
- `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY` chi them khi can service that

## Docker deploy

1. Cai Docker Engine va Docker Compose plugin
2. Clone repo
3. Tao `.env` tu `.env.example`
4. Dien secret that
5. Chay:

```bash
docker compose up -d postgres redis
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm build
pnpm --filter @wb/web start
pnpm --filter @wb/api dev
```

## Chat-first deploy note

- `apps/web` va `apps/extension` deu goi cung backend `copilot` API
- Khi deploy VPS, uu tien dam bao:
  - web co the goi `POST /copilot/chat`
  - extension side panel goi duoc cung host API
  - backend co DB migration moi nhat de luu `Conversation` va `ConversationMessage`
- Neu dung reverse proxy:
  - giu websocket / long polling khong bat buoc cho phase nay
  - quan trong nhat la CORS va auth header cho `/copilot/*`

## Nginx

- `app.example.com` -> `web:3000`
- `api.example.com` -> `api:4000`
- Bat proxy header, gzip va basic rate limit

## SSL

- Dung Nginx + Certbot
- Bat HTTPS redirect
- Kiem tra cert renew tu dong

## Backup Postgres

- Backup hang ngay
- Test restore dinh ky
- Tach backup khoi host chay app neu co the

## Rotate ENCRYPTION_KEY warning

- Khong doi `ENCRYPTION_KEY` tren production neu chua co ke hoach re-encrypt token
- Neu can rotate:
  - tam dung connect token moi
  - backup DB
  - re-encrypt toan bo WB token theo quy trinh rieng
  - verify lai connect status

## Turn on real write safely

1. Xac minh token scope `Feedbacks and Questions`
2. Kiem tra `Live Test Safety Checklist` trong dashboard
3. Bat `ENABLE_REAL_WB_API=true`
4. Tat dry-run bang `WB_WRITE_DRY_RUN=false`
5. Trong dashboard, bam `Allow real review reply test`
6. Chon feedback an toan va confirm lan 2

## Rollback to dry-run

- Dat `WB_WRITE_DRY_RUN=true`
- Hoac dat `ENABLE_REAL_WB_API=false`
- Tat `Allow real review reply test` cho shop neu can
- Theo doi `failed actions` va `audit logs` sau rollback

## Telegram job

- Cron noi bo API chay moi 5 phut
- Gui alert khi:
  - `TELEGRAM_DAILY_ALERT_ENABLED=true`
  - Telegram integration cua shop dang `CONNECTED`
  - den dung `alertHour`

## Staging note

- Xem `docs/STAGING_DEPLOY.md` de co checklist VPS, smoke script, rollback va extension config cho staging demo.
