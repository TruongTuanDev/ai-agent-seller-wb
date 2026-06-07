# PRODUCT

## Dinh vi

WB Operator AI Agent la "AI Operations Manager for Wildberries Sellers":

- Giu vai tro bo nao van hanh shop
- Cho seller thay ngay van de doanh thu, ton kho, review, SEO
- Khong auto-hanh-dong nguy hiem khi seller chua approve

## Nguoi dung muc tieu

- Chu shop Wildberries quy mo nho va vua
- Team operations can mot dashboard tong hop
- Team CSKH can AI draft tieng Nga de xu ly review nhanh

## Seller-ready MVP

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
- `REPLY_REVIEW` can confirm lan 2 truoc khi send that

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

## Safety promise

- WB token chi di qua backend va duoc encrypt
- Gemini/WB secret khong hardcode
- Action nguy hiem can approve + confirm lan 2
- Moi approve/reject/execute deu tao AuditLog
- Neu WB analytics loi 400 thi fallback mock, UI van demo duoc
