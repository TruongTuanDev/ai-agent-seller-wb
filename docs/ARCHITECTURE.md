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
- Extension la giao dien seller chinh; web dashboard la lop ho tro cho settings nang cao va admin.

## Thanh phan

- `apps/web`: dashboard ho tro settings, billing placeholder, admin, Product Doctor chi tiet
- `apps/api`: auth, du lieu shop, mock integrations, action workflow
- `apps/extension`: giao dien seller chinh, multi-shop side panel, chat-first Copilot, sync va action queue
- `packages/wb-client`: adapter Wildberries mock-first
- `packages/shared`: contract dung chung cho web, api, extension
