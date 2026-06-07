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

## Copilot chat-first

- API trung tam: `POST /copilot/chat`
- Extension side panel la host UI uu tien cho Copilot
- Kien truc:
  - `Message -> Intent Router -> Action Planner -> Safe Tools -> Insight Engine -> Response + Cards + Suggested Actions`
- Demo-first UX:
  - welcome card cho dashboard va extension
  - prompt buttons cho cac cau hoi mau
  - `Chay demo 3 phut` de tao mot conversation sale-ready
- Extension-first UX:
  - login ngay trong side panel
  - active shop duoc luu rieng va moi request chat bat buoc di kem `activeShopId`
  - neu user hoi "toi uu san pham nay", extension se them page context thay vi bat user nho `productId`
- AI tool surface:
  - `getShopHealth()`
  - `getProducts()`
  - `getProductProblems()`
  - `getInventoryWarnings()`
  - `getFeedbacks()`
  - `getLatestReport()`
  - `createReviewDraft()`
  - `runProductDoctor()`
  - `getUsageInfo()`
- Intent router:
  - `SHOP_HEALTH`
  - `SALES_DROP_ANALYSIS`
  - `REVIEW_MANAGEMENT`
  - `PRODUCT_DOCTOR`
  - `INVENTORY_RISK`
  - `SEO_OPTIMIZATION`
  - `COMPETITOR_WATCH`
  - `ACTION_EXECUTION`
  - `USAGE_BILLING`
  - `GENERAL_HELP`
- Action planner:
  - tra ve `intent`, `confidence`, `requiredTools`, `plan`
  - khong tu execute write action nguy hiem
- Business insight engine:
  - bien data thanh insight seller doc nhanh duoc
  - moi insight co `evidence`, `businessImpact`, `recommendedAction`
- Seller operating mode:
  - `ASSISTANT`: chi tra loi, khong persist action
  - `OPERATOR`: duoc tao action/AI draft khi phu hop
  - `MANAGER`: nhu `OPERATOR` va co xu huong de xuat hanh dong tiep theo
- Conversation memory:
  - `Conversation`
  - `ConversationMessage`
  - metadata co `activeEntity` gom `activeProductId`, `activeSku`, `activeIntent`
  - Copilot co the hieu follow-up nhu "Toi uu giup toi" sau khi seller vua noi ve mot SKU cu the

## Explainable response

- Moi cau tra loi cua copilot phai co:
  - `Ket luan ngan`
  - `Bang chung`
  - `Y nghia kinh doanh`
  - `Viec nen lam tiep theo`
- Neu thieu du lieu, copilot phai noi ro `missingData` thay vi suy doan

## Rich cards va actions

- Cards:
  - `health`
  - `insight`
  - `productRisk`
  - `reviewQueue`
  - `inventoryRisk`
  - `actionPlan`
  - `usageLimit`
- Khong render raw JSON mac dinh cho seller; debug details chi hien khi chu dong mo
- Suggested action chi map sang flow an toan:
  - `OPEN_REVIEW_QUEUE`
  - `RUN_PRODUCT_DOCTOR`
  - `CREATE_REVIEW_DRAFTS`
  - `VIEW_INVENTORY_RISK`
  - `OPEN_ACTION_QUEUE`
  - `RUN_HEALTH_REPORT`
  - `OPEN_WEB_DASHBOARD`
- Extension khong render raw JSON mac dinh; debug details chi mo khi seller chu dong bam

## Copilot system prompt

- Vai tro: `Wildberries Operations Manager`
- Uu tien:
  1. Doanh thu
  2. Conversion
  3. Review
  4. Inventory
  5. SEO
  6. Competitor
- Rule:
  - khong bịa data
  - chi tra loi dua tren tool outputs
  - luon neu `nguyen nhan`, `bang chung`, `hanh dong de xuat`

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
- Copilot answer cung co the duoc tong hop boi Gemini, nhung van bi rang buoc chi dua tren tool outputs da lay tu backend

## Ngon ngu output

- Health report: tieng Viet
- Review reply: tieng Nga
- Product Doctor: chan doan tieng Viet, SEO draft tieng Nga
