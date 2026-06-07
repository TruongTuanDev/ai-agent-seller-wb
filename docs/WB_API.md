# WB API

## Nhom API can tich hop

- Product Management: content, cards, attributes
- Prices and Discounts: update price, discount
- Warehouse / Inventory: stocks, warehouses
- Customer Communication: feedbacks, questions, chats
- Analytics and Data: sales funnel, search queries, stocks report
- Reports: financial/reporting data
- Marketing and Promotions: ads, bids, campaigns
- Documents and Accounting: balance, finance reports

## Che do an toan

- Mac dinh `ENABLE_REAL_WB_API=false`
- Chi khi `ENABLE_REAL_WB_API=true` backend moi goi WB API that
- Neu endpoint read that loi, he thong co the fallback ve mock de demo khong bi dung
- Endpoint write van bi khoa sau approval + confirm lan 2

## Da noi that

- Seller info:
  - `GET https://common-api.wildberries.ru/api/v1/seller-info`
  - Dung de test token va lay metadata seller
- Product cards list:
  - `POST https://content-api.wildberries.ru/content/v2/get/cards/list`
  - Dung de doc danh sach card san pham
- Seller warehouses:
  - `GET https://marketplace-api.wildberries.ru/api/v3/warehouses`
- Stocks by warehouse:
  - `POST https://marketplace-api.wildberries.ru/api/v3/stocks/{warehouseId}`
- Feedbacks list:
  - `GET https://feedbacks-api.wildberries.ru/api/v1/feedbacks`
  - Doc ca `isAnswered=false` va `isAnswered=true`

## Da map endpoint that nhung van fallback mock khi can

- Sales funnel:
  - `POST https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products`
  - Dung schema `selectedPeriod` / `pastPeriod` theo doc chinh thuc
  - Neu token khong du quyen hoac response khong hop le, dashboard van nhan snapshot mock de khong vo demo

## Van de dang giu mock / TODO

- `wb.prices.update()`
  - TODO: xac nhan endpoint ghi, error cases va idempotency truoc khi mo execute that
- `wb.feedbacks.reply()`
  - TODO: mo chi sau khi execute flow audit + approval hoan tat
- `wb.stocks.update()`
  - TODO: endpoint chinh thuc da biet (`PUT /api/v3/stocks/{warehouseId}`) nhung van khoa write mode trong phase nay
- `wb.reports.finance()`
  - TODO: map theo group reports/finances chinh thuc
- `wb.ads.campaigns()`
  - TODO: map advert API chinh thuc

## Client surface

```ts
wb.products.list()
wb.prices.update()
wb.stocks.list()
wb.feedbacks.list()
wb.feedbacks.reply()
wb.analytics.salesFunnel()
wb.reports.finance()
wb.ads.campaigns()
```

## Ghi chu endpoint chinh thuc

- Wildberries yeu cau token trong header `Authorization: Bearer <token>`
- Tai lieu goc:
  - Seller info va token basics: `https://dev.wildberries.ru/en/docs/openapi/api-information`
  - Product cards / warehouses / stocks: `https://dev.wildberries.ru/en/docs/openapi/work-with-products`
  - Feedbacks: `https://dev.wildberries.ru/en/docs/openapi/user-communication`
  - Analytics sales funnel: `https://dev.wildberries.ru/en/docs/openapi/analytics`
