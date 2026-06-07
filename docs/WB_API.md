# WB API

## Che do an toan

- Mac dinh `ENABLE_REAL_WB_API=false`
- Chi khi `ENABLE_REAL_WB_API=true` backend moi goi WB API that
- Read endpoint that loi -> co the fallback mock de dashboard van demo duoc
- Write action van can approval + confirm lan 2

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

- Chua mo endpoint that
- Hien execute theo mock-safe flow trong seller-ready MVP
- Chi mo write mode that sau khi xac nhan endpoint, error cases va audit end-to-end

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
wb.feedbacks.reply()      // mock/TODO
wb.stocks.update()        // mock/TODO
```

## Tai lieu goc

- Seller info / auth basics: `https://dev.wildberries.ru/en/docs/openapi/api-information`
- Products / warehouses / stocks: `https://dev.wildberries.ru/en/docs/openapi/work-with-products`
- Feedbacks: `https://dev.wildberries.ru/en/docs/openapi/user-communication`
- Analytics: `https://dev.wildberries.ru/en/docs/openapi/analytics`
