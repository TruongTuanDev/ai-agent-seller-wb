# CLOUD

## Deploy VPS Ubuntu

1. Cai Docker va Docker Compose plugin.
2. Copy `.env.example` thanh `.env` va cap nhat bien moi truong.
3. Chay `docker compose up -d --build`.
4. Cau hinh Nginx reverse proxy cho web va api.
5. Cap SSL bang Certbot.
6. Cau hinh backup PostgreSQL dinh ky.
7. Bat log monitoring cho container va Nginx.

## Nginx goi y

- `web.example.com` -> `web:3000`
- `api.example.com` -> `api:4000`

## Bien moi truong production

- `AI_PROVIDER=gemini` neu muon dung Gemini that
- `ENABLE_REAL_WB_API=true` chi khi da san sang ket noi token seller that
- `GEMINI_API_KEY` va `JWT_SECRET` phai duoc cap qua secret manager hoac file `.env` tren server, khong hardcode trong image
- `DATABASE_URL` production co the dung host noi bo Docker hoac managed Postgres

## Backup

- Dung `pg_dump` hang ngay
- Luu file backup ra volume hoac object storage
- Kiem tra restore dinh ky
