# PRODUCTION CHECKLIST

## Security checklist

- Khong hardcode secret
- WB token chi luu backend va da encrypt
- Khong expose token tho tren dashboard, extension, log
- Review real-write chi mo cho `REPLY_REVIEW`
- `UPDATE_PRICE`, `UPDATE_STOCK`, `UPDATE_PRODUCT_CONTENT`, `UPDATE_AD_BID` van giu mock-safe
- Admin route chi cho `ADMIN`

## Env checklist

- `JWT_SECRET` manh va rieng cho moi moi truong
- `ENCRYPTION_KEY` manh va backup an toan
- `ENABLE_REAL_WB_API=false` neu chua san sang live test
- `WB_WRITE_DRY_RUN=true` la mac dinh an toan
- `NEXT_PUBLIC_API_BASE_URL` / `API_BASE_URL` dung domain production
- `WEB_BASE_URL` dung domain production/staging

## WB token checklist

- Shop da connect token hop le
- Token co scope `Feedbacks and Questions`
- Chi bat `WB_WRITE_DRY_RUN=false` khi da xac minh scope
- Khong test real write tren shop production neu seller chua dong y

## AI key checklist

- Neu dung Gemini that: co `GEMINI_API_KEY`
- Neu chua co key: he thong fallback mock, khong crash

## Telegram checklist

- `TELEGRAM_BOT_TOKEN` da duoc set neu can gui that
- Telegram integration cua shop o trang thai `CONNECTED`

## Monitoring checklist

- Theo doi failed actions
- Theo doi audit logs
- Theo doi API / Nginx log
- Theo doi quota usage theo user
- Theo doi `GET /health` va `GET /ready`

## Backup checklist

- Backup Postgres dinh ky
- Luu quy trinh restore
- Backup file `.env` o noi an toan

## Live test checklist

- `ENABLE_REAL_WB_API=true`
- `WB_WRITE_DRY_RUN=false`
- Shop bat `Allow real review reply test`
- Feedback target chua `SENT`
- Reply da duoc seller approve
- Confirm lan 2 da duoc xac nhan
- Audit log dang hoat dong

## Before demo

- docker services up
- db migrated + seeded
- API health ok
- web ok
- Gemini key ok hoac mock mode ok
- WB dry-run true
- Telegram mock/real configured
- extension loaded
