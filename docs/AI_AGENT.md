# AI AGENT

## Providers

- `MockAiProvider`
  - Luon san sang cho demo offline
  - Dung heuristic tren products, feedbacks, snapshots
- `GeminiProvider`
  - Bat bang `AI_PROVIDER=gemini`
  - Doc key tu `GEMINI_API_KEY`
  - Neu thieu key thi fallback mock

## Flow da noi

- `generateShopHealthReport()`
- `generateReviewReply()`
- `generateProductDoctor()`

## Shop Health Report schema

```ts
{
  healthScore: number;
  executiveSummary: string;
  kpiSummary: {
    revenueTrend: string;
    orderTrend: string;
    conversionTrend: string;
    reviewRisk: string;
    inventoryRisk: string;
  };
  criticalIssues: Array<{
    title: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    evidence: string;
    recommendation: string;
    relatedSku?: string;
  }>;
  growthOpportunities: Array<{
    title: string;
    expectedImpact: string;
    action: string;
  }>;
  recommendedActions: Array<ActionRecommendation>;
  missingData: string[];
}
```

## Review Reply rules

- Output bang tieng Nga
- Tone cho phep: `polite`, `friendly`, `professional`
- Review tieu cuc: xin loi, de nghi ho tro
- Review tich cuc: cam on ngan gon
- Khong hua hoan tien neu seller chua cho phep

## Product Doctor rules

- Chan doan bang tieng Viet
- SEO draft bang tieng Nga:
  - `seoTitleRu`
  - `seoDescriptionRu`
  - `seoBulletsRu`
  - `keywordsRu`
- Canh bao size, mau, chat lieu neu review co dau hieu

## Gemini implementation

- Goi `generateContent`
- Bat `responseMimeType=application/json`
- Truyen `responseSchema`
- Validate lai bang Zod sau khi parse
- Neu Gemini tra text loi:
  - backend parse an toan lai JSON neu co
  - neu van sai schema thi tra loi debug de hieu
  - log loi nhung khong log API key

## Ngon ngu output

- Health report: tieng Viet
- Review reply: tieng Nga
- Product Doctor: chan doan tieng Viet, SEO draft tieng Nga
