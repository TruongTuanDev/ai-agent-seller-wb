# ARCHITECTURE

```text
Chrome Extension
    ↓
Backend API
    ↓
PostgreSQL
    ↓
AI Provider
    ↓
Wildberries Official API
```

## Nguyen tac

- Extension khong thao tac nguy hiem truc tiep.
- Backend goi WB API bang token da ma hoa.
- Moi hanh dong sua du lieu phai co approval.
- Co audit log cho approve, reject va execute.

## Thanh phan

- `apps/web`: dashboard van hanh cho seller
- `apps/api`: auth, du lieu shop, mock integrations, action workflow
- `apps/extension`: copilot tren seller.wildberries.ru
- `packages/wb-client`: adapter Wildberries mock-first
- `packages/shared`: contract dung chung cho web, api, extension
