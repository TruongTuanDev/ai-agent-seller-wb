# WB API

## Che do an toan

- Mac dinh `ENABLE_REAL_WB_API=false`
- Mac dinh `WB_WRITE_DRY_RUN=true`
- Chi khi `ENABLE_REAL_WB_API=true` backend moi goi WB API that
- `ENABLE_REAL_WB_API=true` + `WB_WRITE_DRY_RUN=true` -> read that, write dry-run
- `ENABLE_REAL_WB_API=true` + `WB_WRITE_DRY_RUN=false` -> read/write that cho `REPLY_REVIEW`
- Read endpoint that loi -> co the fallback mock de dashboard van demo duoc
- Write action van can approval + confirm lan 2
- Copilot/Telegram/Extension khong goi WB API truc tiep; tat ca di qua backend tools va van dung chung guard an toan nay

## Da noi that

### 1. Seller info

- `GET https://common-api.wildberries.ru/api/v1/seller-info`
- Dung de test token va lay thong tin seller

### 2. Products

- `POST https://content-api.wildberries.ru/content/v2/get/cards/list`
- Doc danh sach card san pham
- Backend map title, description neu co, category, attributes, chrt ids

### 3. Stocks

- `GET https://marketplace-api.wildberries.ru/api/v3/warehouses`
- `POST https://marketplace-api.wildberries.ru/api/v3/stocks/{warehouseId}`
- Doc kho va tong hop ton theo `nmId`

### 4. Feedbacks

- `GET https://feedbacks-api.wildberries.ru/api/v1/feedbacks`
- Doc ca `isAnswered=false` va `isAnswered=true`

## Da map that nhung van fallback mock khi can

### Analytics sales funnel

- `POST https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products`
- Da map payload `selectedPeriod` / `pastPeriod`
- Neu token/response khong hop le hoac WB tra `400`, backend fallback mock snapshot va UI hien canh bao

## Van giu mock / TODO

### `wb.feedbacks.reply()`

- Official doc: `POST https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer`
- Request body:

```json
{
  "id": "feedback-id",
  "text": "Ответ на отзыв"
}
```

- Token scope: Feedbacks and Questions
- Success response: `204 No Content`
- Request limit cho nhom Feedbacks and Questions: `3 req/s`, interval `333 ms`, burst `6`
- WB doc ghi ro endpoint nay khong validate theo `feedback ID`; neu id sai co the khong tra loi ro rang
- Error theo doc:
  - `400` bad request
  - `401` unauthorized
  - `402` payment required
  - `403` access denied
  - `429` too many requests
- Backend bo sung guard truoc khi goi:
  - feedback khong ton tai trong DB
  - feedback da `SENT`
  - token khong giai ma duoc / shop chua co token
  - `replyText` ngoai gioi han `20..1000`
- Runtime:
  - `mock` -> khong goi WB that
  - `dry_run` -> khong goi WB that, tra `wouldCall=wb.feedbacks.reply`
  - `real_write` -> goi that, timeout 10s, retry nhe cho `429` va `5xx`, khong retry `400/401/403`

### `wb.prices.update()`

- TODO xac nhan endpoint ghi, rate limit va idempotency

### `wb.stocks.update()`

- TODO xac nhan write flow that truoc khi mo execute that

### `wb.updateProductContent()`

- Product Doctor hien chi tao draft, chua push content len WB

### `wb.ads.updateBid()`

- Chua noi that trong phase nay

## Client surface

```ts
wb.products.list()
wb.stocks.list()
wb.feedbacks.list()
wb.analytics.salesFunnel()

wb.prices.update()        // mock/TODO
wb.feedbacks.reply()      // mock/dry-run/real_write
wb.stocks.update()        // mock/TODO
```

Trong phase hien tai:

- `wb.feedbacks.reply()` da mo `real_write` an toan cho `REPLY_REVIEW`
- `UPDATE_PRICE`, `UPDATE_STOCK`, `UPDATE_PRODUCT_CONTENT`, `UPDATE_AD_BID` van giu mock-safe

## Tai lieu goc

- Seller info / auth basics: `https://dev.wildberries.ru/en/docs/openapi/api-information`
- Products / warehouses / stocks: `https://dev.wildberries.ru/en/docs/openapi/work-with-products`
- Feedbacks: `https://dev.wildberries.ru/en/docs/openapi/user-communication`
- Analytics: `https://dev.wildberries.ru/en/docs/openapi/analytics`
