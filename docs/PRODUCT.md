# PRODUCT

## Dinh vi

WB Operator AI Agent la "AI Operations Manager for Wildberries Sellers":

- Giu vai tro bo nao van hanh shop
- Cho seller thay ngay van de doanh thu, ton kho, review, SEO
- Khong auto-hanh-dong nguy hiem khi seller chua approve
- Trong phase hien tai, seller uu tien chat thay vi dashboard-driven thao tac tay
- Chrome extension la trai nghiem chinh; web dashboard la lop ho tro cho settings nang cao, billing, admin va audit

## Nguoi dung muc tieu

- Chu shop Wildberries quy mo nho va vua
- Team operations can mot dashboard tong hop
- Team CSKH can AI draft tieng Nga de xu ly review nhanh

## Seller-ready MVP

### 0. AI Copilot chat-first

- Trung tam trai nghiem: `Chrome Extension Side Panel`
- Web dashboard van co `AI Copilot`, nhung khong con la diem vao chinh
- Welcome screen co prompt mau va huong dan seller hoi bang ngon ngu tu nhien
- Seller co the hoi bang ngon ngu tu nhien:
  - "Tai sao don hang giam?"
  - "Co bao nhieu review chua tra loi?"
  - "SKU nao sap het hang?"
  - "Kiem tra san pham ma SKU-123"
- Copilot tu goi tools phia sau thay vi bat seller nho `shopId`, endpoint hoac nut sync
- Co conversation memory de hieu follow-up
- Co intent router + action planner de phan loai "tai sao don giam", "review nao chua tra loi", "SKU nao sap het hang", "toi uu SKU-123"
- Co explainable response theo 4 phan: ket luan ngan, bang chung, y nghia kinh doanh, viec nen lam tiep theo
- Co rich cards va suggested actions an toan
- Co `Demo Mode`, nut `Chay demo 3 phut` va onboarding ro rang ngay khi login
- Co 3 mode:
  - `ASSISTANT`: chi tra loi
  - `OPERATOR`: co the tao action
  - `MANAGER`: tao action + de xuat chu dong hon

### 0.2 Extension-first multi-shop UX

- Dang nhap ngay trong side panel
- Neu chua co shop:
  - `Them Shop`
  - `Dung Demo Shop`
- Shop switcher tren header:
  - dropdown shop
  - health score
  - connect status
  - sync nhanh
- Add shop modal:
  - `Shop Name`
  - `WB API Key`
  - `Test Key`
  - `Save Shop`
- Khong luu WB API key trong extension
- Context awareness tu `seller.wildberries.ru`:
  - `pageType`
  - `productId`
  - `sku`
  - `visibleTextSummary`

### 0.1 Demo-first UX

- Dashboard hien ro:
  - shop da ket noi hay chua
  - huong dan 3 buoc neu seller chua co WB token
  - `Demo Mode`
  - `Chay demo 3 phut`
- Demo flow:
  1. AI phan tich shop
  2. AI chi ra 3 van de
  3. AI tao draft review
  4. AI kiem tra 1 SKU co van de
  5. AI de xuat hanh dong tiep theo

### 1. Shop Health Report

- Health Score 0-100
- KPI cards: doanh thu, don hang, chuyen doi, review risk
- Top 3 van de nguy hiem nhat
- Top 3 co hoi tang truong
- Danh sach SKU can xu ly ngay
- Recommended actions dua vao approval queue

### 2. Review Reply Queue

- Trang thai: chua tra loi, AI Draft, approve, reject, send
- AI draft tieng Nga voi tone `polite | friendly | professional`
- Review tieu cuc: xin loi + de nghi ho tro
- Review tich cuc: cam on ngan gon
- Badge mode ro rang: `MOCK`, `DRY-RUN`, `REAL WRITE`
- `REPLY_REVIEW` can confirm lan 2 truoc khi send that
- Dry-run la mac dinh, khong doi feedback sang `SENT`

### 3. Product Doctor

- Route demo: `/products/:id/doctor`
- Score: SEO, image placeholder, title, description, attribute completeness
- Risk: review risk, return risk placeholder
- Draft tieng Nga: title, description, bullet points, keywords
- Canh bao size/mau/chat lieu neu review co dau hieu rui ro
- Chi tao draft, chua auto update listing

### 4. Telegram Daily Alert

- Seller nhap `chat_id`
- Test alert mock/real
- Daily summary cho shop
- Cron 9h sang server time hoac gio cau hinh
- Telegram command dung chung Copilot backend:
  - `/health`
  - `/reviews`
  - `/inventory`
  - `/report`

### 5. Plans va Usage

- Plan `FREE | PRO | AGENCY`
- Dashboard co usage card
- API chan khi vuot quota AI draft / health report
- FREE chi duoc dry-run review reply

### 6. Admin Panel

- Route `/admin`
- Chi `ADMIN` moi vao duoc
- Xem users, shops, usage, latest reports, latest actions, failed actions, audit logs
- Co the doi plan, reset usage, disable shop

## Safety promise

- WB token chi di qua backend va duoc encrypt
- Extension chi luu backend auth token va active shop id
- Gemini/WB secret khong hardcode
- Action nguy hiem can approve + confirm lan 2
- Moi approve/reject/execute deu tao AuditLog
- Neu WB analytics loi 400 thi fallback mock, UI van demo duoc
- Copilot khong tu nhan da gui review hoac sua gia/kho neu action chua execute that
