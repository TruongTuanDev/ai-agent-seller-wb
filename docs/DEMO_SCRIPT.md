# DEMO SCRIPT

## Muc tieu 3 phut

- Cho seller thay rang WB Operator AI co the giai thich don giam bang du lieu shop
- Cho seller thay review queue, Product Doctor, Telegram alert va safety flow
- Khong can seller hieu `shopId`, endpoint hay WB token structure

## Chuan bi truoc demo

1. Chay:
   - `docker compose up -d postgres redis`
   - `pnpm db:migrate`
   - `pnpm db:seed`
   - `pnpm dev`
2. Dang nhap bang:
   - `demo@wb-agent.local`
   - `Demo123456!`
3. Xac nhan dashboard dang hien `Demo Mode`

## Luong demo 3 phut

### 1. Mo dashboard

- Chi cho seller thay:
  - `Demo Mode`
  - trang thai shop da ket noi
  - nut `Chay demo 3 phut`
- Noi:
  - seller khong can nho endpoint hay ID
  - co the chat va giao viec bang ngon ngu tu nhien

### 2. Hoi: "Tai sao don giam?"

- Mo tab `AI Copilot`
- Bam prompt hoac go: `Tai sao don giam?`
- Nhan manh:
  - AI tra loi co `Ket luan ngan`
  - co `Bang chung`
  - co `Y nghia kinh doanh`
  - co `Viec nen lam tiep theo`
- Chi cho seller thay:
  - `InsightCard`
  - `ReviewQueueCard`
  - `InventoryRiskCard`
  - `ActionPlanCard`

### 3. Mo Review Queue

- Bam CTA `Mo Review Queue`
- Noi:
  - AI co the soan draft review tieng Nga
  - seller van phai approve
  - `REPLY_REVIEW` van can confirm lan 2

### 4. Tao draft tieng Nga

- Bam `Tao AI Draft`
- Chi cho seller thay:
  - draft review bang tieng Nga
  - status `AI Draft`
  - action vao queue
- Nhac ro:
  - he thong dang dry-run/mock-safe
  - khong tu dong gui action nguy hiem

### 5. Mo Product Doctor

- Quay lai `AI Copilot` hoac `Tong quan`
- Bam CTA `Mo Product Doctor`
- Noi:
  - AI danh gia SEO score
  - phat hien warning ve size, mau, chat lieu neu review nhac den
  - chi tao draft, chua auto update listing

### 6. Telegram alert

- Mo `Cai dat`
- Chi cho seller thay:
  - huong dan ket noi token
  - Telegram integration
  - nut `Test alert` va `Gui daily summary`
- Noi:
  - seller co the nhan tom tat buoi sang luc 9h

### 7. Ket dong bang safety

- Nhac 3 diem:
  - WB token duoc encrypt o backend
  - action nguy hiem can approval + confirm lan 2
  - co the demo bang mock data ngay ca khi chua co token that

## Cau noi de chot sale

- "Thay vi vao tung trang Wildberries de kiem tra review, ton kho va SEO, anh chi co the hoi Copilot va nhan ngay plan hanh dong."
- "He thong uu tien an toan: AI de xuat va soan draft, con seller van giu quyen approve cuoi cung."
- "Ban demo nay da du de team shop hieu gia tri truoc khi mo ket noi real API."
