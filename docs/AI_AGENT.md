# AI AGENT

## Input JSON

```json
{
  "shop": {},
  "kpis": {},
  "products": [],
  "feedbacks": [],
  "analytics": {},
  "inventory": {},
  "competitors": []
}
```

## Output JSON

```json
{
  "healthScore": 0,
  "summary": "",
  "risks": [],
  "opportunities": [],
  "recommendedActions": [
    {
      "type": "REPLY_REVIEW | UPDATE_PRICE | UPDATE_STOCK | SEO_REWRITE | TELEGRAM_ALERT",
      "title": "",
      "reason": "",
      "confidence": 0,
      "requiresApproval": true,
      "payload": {}
    }
  ]
}
```

## Rules

- AI phai tra ve JSON hop le, khong tra ve text tu do.
- Phan tich cho seller bang tieng Viet.
- Neu tao reply cho khach thi viet bang tieng Nga.
- Khong bia so lieu.
- Neu thieu du lieu thi phai ghi ro `missingData`.

## Provider

- `MockAiProvider`
  - Luon san sang cho demo offline
- `GeminiProvider`
  - Bat bang `AI_PROVIDER=gemini`
  - Doc key tu `GEMINI_API_KEY`
  - Neu thieu key thi fallback ve mock

## Gemini implementation

- Goi `models.generateContent`
- Bat `responseMimeType=application/json`
- Truyen `responseSchema`
- Validate lai bang Zod o backend
- Neu Gemini tra ve text loi hoac JSON sai schema:
  - backend log loi
  - khong log API key
  - tra loi tieng Viet de debug de hon

## Ngon ngu output

- `generateShopHealthReport()`: tieng Viet
- `generateReviewReply()`: tieng Nga
- `generateProductDoctor()`: chan doan tieng Viet + de xuat SEO tieng Nga (`seoTitleRu`, `seoBulletsRu`)
