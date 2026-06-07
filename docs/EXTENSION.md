# EXTENSION

## Extension-first architecture

- Extension la trai nghiem seller chinh
- Side panel la noi dang nhap, chon shop, chat, sync, review queue va action queue
- Web dashboard giu vai tro:
  - billing placeholder
  - admin
  - settings nang cao
  - audit logs
  - Product Doctor chi tiet

## Seller flow

1. Mo side panel
2. Dang nhap bang email/password hoac `Dung Demo`
3. Chon shop hoac `Them Shop`
4. Bam `Test Key` va `Save Shop`
5. Bat dau hoi:
   - `Tai sao don giam?`
   - `Review nao chua tra loi?`
   - `SKU nao sap het hang?`
   - `Toi uu san pham nay`

## Multi-shop

- `GET /shops`
- `POST /shops/test-token`
- `POST /shops/connect-token`
- `PATCH /shops/:id`
- `DELETE /shops/:id`
- active shop duoc luu trong extension storage, khong can nhap `shopId`

## Context awareness

Content script luu:

```ts
{
  url,
  pageType,
  productId,
  sku,
  visibleTextSummary
}
```

`pageType`:

- `dashboard`
- `product`
- `feedbacks`
- `analytics`
- `orders`
- `unknown`

Copilot chi dung context nay de bo sung prompt, khong tu tao du lieu ngoai tool outputs.

## Security

- Extension khong luu WB API key
- WB API key chi gui mot lan len backend khi `Test Key`/`Save Shop`
- Backend encrypt token va khong bao gio tra token tho ve lai
- Side panel mac dinh an raw JSON/debug details
- Action nguy hiem van di qua approval + confirm lan 2

## Popup

- Popup khong con dung cho auth
- Popup chi de:
  - mo side panel nhanh
  - doi `API URL` / `Web URL` cho local hoac staging
