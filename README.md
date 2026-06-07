# WB Operator AI Agent

Monorepo demo-that cho "AI Operations Manager for Wildberries Sellers".

## Stack

- `apps/web`: Next.js 14, TypeScript, TailwindCSS
- `apps/api`: Express.js, TypeScript, Prisma, JWT auth
- `apps/extension`: Chrome Extension Manifest V3, React, Vite
- `packages/shared`: shared types + schemas
- `packages/wb-client`: Wildberries client mock-first, real-read khi bat flag

## Chay local tu dau

1. Kiem tra Docker Desktop dang chay.
2. Dung file `.env` hien co hoac copy `.env.example` thanh `.env`.
3. Cai dependencies:

```bash
pnpm install
```

4. Chay ha tang local:

```bash
docker compose up -d postgres redis
```

PostgreSQL cua repo nay map ra host port `5440` de khong dung voi PostgreSQL khac tren may.

5. Apply migration:

```bash
pnpm db:migrate
```

6. Seed demo data:

```bash
pnpm db:seed
```

7. Chay web + api:

```bash
pnpm dev
```

8. Build extension:

```bash
pnpm --filter @wb/extension build
```

## Demo account

- Email: `demo@wb-agent.local`
- Password: `Demo123456!`

## Flags quan trong

- `AI_PROVIDER=mock|gemini`
- `GEMINI_API_KEY=...`
- `ENABLE_REAL_WB_API=false|true`

Mac dinh:

- AI dung mock neu khong bat `AI_PROVIDER=gemini` hoac thieu `GEMINI_API_KEY`
- WB API chi goi that khi `ENABLE_REAL_WB_API=true`
- Moi action nguy hiem deu can approval va confirm lan 2 truoc khi execute

## Trang thai hien tai

- `/health` tra `{ ok: true }`
- Login demo thanh cong
- Dashboard hien thi du lieu seed
- Extension build ra `apps/extension/dist` va co the load unpacked
- WB token duoc test va ma hoa o backend, khong tra token tho ve frontend
- Real WB mode hien uu tien read-only cho `seller-info`, `products`, `stocks`, `feedbacks`
- Analytics real da map endpoint chinh thuc, nhung van co fallback mock neu token/response khong hop le

Tai lieu chi tiet nam trong [docs/README.md](/C:/Users/admin/ai-agent-seller-wb/docs/README.md).
