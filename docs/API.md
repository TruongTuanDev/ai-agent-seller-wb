# API

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

## Shops

- `POST /shops/connect-token`
- `GET /shops`
- `GET /shops/:id`

## Wildberries

- `POST /wb/:shopId/sync/products`
- `POST /wb/:shopId/sync/feedbacks`
- `POST /wb/:shopId/sync/analytics`
- `GET /wb/:shopId/status`

## AI

- `POST /ai/:shopId/health-report`
- `POST /ai/:shopId/review-reply-draft`
- `POST /ai/:shopId/product-doctor`

## Reports

- `GET /reports/:shopId/latest`
- `GET /reports/:shopId/history`

## Actions

- `GET /actions/:shopId`
- `POST /actions/:actionId/approve`
- `POST /actions/:actionId/reject`
- `POST /actions/:actionId/execute`

## Telegram

- `POST /telegram/:shopId/connect`
- `POST /telegram/:shopId/test-alert`
