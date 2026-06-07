# SECURITY

## Secrets

- WB API token duoc encrypt AES-256-CBC tai backend
- JWT secret, encryption key, Gemini key, Telegram bot token deu doc tu env
- Khong hardcode secret trong repo

## Token safety

- Dashboard chi gui WB token len backend cho flow test/connect
- Backend khong bao gio tra WB token tho ve frontend hoac extension
- Extension chi luu backend JWT, khong luu WB token
- Khi log loi WB/Gemini/Telegram, chi log status/message can thiet

## Approval safety

- Action nguy hiem:
  - `UPDATE_PRICE`
  - `UPDATE_STOCK`
  - `REPLY_REVIEW`
  - `UPDATE_PRODUCT_CONTENT`
  - `UPDATE_AD_BID`
- Tat ca action tren can:
  - `APPROVE`
  - `NEEDS_CONFIRMATION`
  - `EXECUTE`

## Audit

- Moi `approve`
- Moi `reject`
- Moi `execute`
- Moi `fail`
- Telegram connect/test/send
- WB token connect

Tat ca deu ghi `AuditLog`.

## Runtime safety

- `ENABLE_REAL_WB_API=false` la mac dinh
- Real WB write endpoint van giu che do an toan/mock neu chua chac endpoint
- Neu analytics WB loi `400`, backend fallback mock va UI van demo duoc
- Neu thieu `GEMINI_API_KEY` hoac `TELEGRAM_BOT_TOKEN`, he thong fallback mock thay vi crash
