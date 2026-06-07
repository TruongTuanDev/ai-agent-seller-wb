# CLOUD

## Deploy VPS Ubuntu

1. Cai Docker Engine va Docker Compose plugin
2. Clone repo
3. Tao `.env` tu `.env.example`
4. Dien secret that:
   - `JWT_SECRET`
   - `ENCRYPTION_KEY`
   - `GEMINI_API_KEY` neu dung Gemini
   - `TELEGRAM_BOT_TOKEN` neu dung Telegram that
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

## Reverse proxy

- `app.example.com` -> `web:3000`
- `api.example.com` -> `api:4000`

Dung Nginx + Certbot cho SSL.

## Production checklist

- `ENABLE_REAL_WB_API=true` chi bat khi san sang ket noi token shop that
- Gioi han truy cap dashboard bang password manh
- Backup Postgres dinh ky
- Theo doi log API va Nginx
- Khong expose `.env`
- Khong luu WB token o frontend/extension

## Telegram job

- Cron noi bo API chay moi 5 phut
- Gui alert khi:
  - `TELEGRAM_DAILY_ALERT_ENABLED=true`
  - Telegram integration cua shop dang `CONNECTED`
  - den dung `alertHour`

## Goi y nang cap tiep

- Tach `api` va `web` thanh process manager (`pm2`/systemd) hoac container rieng
- Chuyen Postgres len managed service neu can HA
- Them sentry/alerting cho API va job Telegram
