# SECURITY

## Secrets

- WB API token duoc encrypt AES-256-CBC tai backend
- JWT secret, encryption key, Gemini key, Telegram bot token deu doc tu env
- Khong hardcode secret trong repo

## Token safety

- Dashboard chi gui WB token len backend cho flow test/connect
- Backend khong bao gio tra WB token tho ve frontend hoac extension
- Extension chi luu backend JWT, khong luu WB token
- Copilot chat, Telegram command va extension side panel deu dung lai backend token / session; khong co luong nao expose WB token trong card, conversation memory hay suggested action
- Khi log loi WB/Gemini/Telegram, chi log status/message can thiet
- Extension side panel mac dinh an `debug details`; khong hien raw JSON cho seller neu khong chu dong mo
- Demo Mode va onboarding token cung khong hien token tho; chi hien seller info, scopes va trang thai ket noi

## Approval safety

- Action nguy hiem:
  - `UPDATE_PRICE`
  - `UPDATE_STOCK`
  - `REPLY_REVIEW`
  - `UPDATE_PRODUCT_CONTENT`
  - `UPDATE_AD_BID`
- Tat ca action tren can:
  - `APPROVE`
  - `EXECUTE`
  - `CONFIRM LAN 2` cho `REPLY_REVIEW`
- `REPLY_REVIEW` real-write con can:
  - shop da bat `Allow real review reply test`
  - plan cho phep real write
  - live checklist pass

## Audit

- Moi `approve`
- Moi `reject`
- Moi `execute`
- Moi `fail`
- Moi admin change plan / reset usage / disable shop
- Telegram connect/test/send
- WB token connect
- Copilot-created action / draft review
- Copilot conversation tool metadata chi luu output can thiet, khong luu secret
- Copilot planner chi lap ke hoach va de xuat CTA; khong tu mo write mode nguy hiem

Tat ca deu ghi `AuditLog`.

## Runtime safety

- `ENABLE_REAL_WB_API=false` la mac dinh
- `WB_WRITE_DRY_RUN=true` la mac dinh ke ca khi da bat `ENABLE_REAL_WB_API=true`
- Real WB write chi mo khi dong thoi bat `ENABLE_REAL_WB_API=true` va `WB_WRITE_DRY_RUN=false`
- Neu analytics WB loi `400`, backend fallback mock va UI van demo duoc
- Neu thieu `GEMINI_API_KEY` hoac `TELEGRAM_BOT_TOKEN`, he thong fallback mock thay vi crash
- Copilot chi duoc phep dung read tools mac dinh; write-ish flow nhu `createReviewDraft` va `REPLY_REVIEW` van di qua approval + confirm lan 2 theo operating mode va action queue hien co
- Neu khong du data de phan tich, copilot phai tra loi ro la thieu du lieu thay vi suy doan
