export type SafeActionType =
  | "CREATE_REVIEW_DRAFT"
  | "CREATE_SEO_DRAFT"
  | "SEND_TELEGRAM_ALERT";

export type DangerousActionType =
  | "UPDATE_PRICE"
  | "UPDATE_STOCK"
  | "REPLY_REVIEW"
  | "UPDATE_PRODUCT_CONTENT"
  | "UPDATE_AD_BID";

export type ActionType = SafeActionType | DangerousActionType;

export interface ActionRecommendation {
  type: ActionType;
  title: string;
  reason: string;
  confidence: number;
  requiresApproval: boolean;
  payload: Record<string, unknown>;
}

export type RecommendedAction = ActionRecommendation;

export interface ShopHealthInput {
  shop: Record<string, unknown>;
  kpis: Record<string, unknown>;
  products: Record<string, unknown>[];
  feedbacks: Record<string, unknown>[];
  analytics: Record<string, unknown>;
  inventory: Record<string, unknown>;
  competitors: Record<string, unknown>[];
  productProblems?: ProductProblem[];
}

export interface ShopHealthReport {
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
  recommendedActions: ActionRecommendation[];
  missingData: string[];
}

export interface ReviewReplyInput {
  customerName?: string;
  reviewText: string;
  rating: number;
  productTitle: string;
  tone?: "polite" | "friendly" | "professional";
  allowRefundPromise?: boolean;
}

export interface ReviewReplyOutput {
  reply: string;
  tone: "polite" | "friendly" | "professional";
  detectedSentiment: "positive" | "neutral" | "negative";
  missingData: string[];
}

export interface ProductDoctorInput {
  title: string;
  description?: string;
  category?: string;
  price?: number;
  stock?: number;
  rating?: number;
  attributes?: Record<string, unknown>;
  reviewSnippets?: string[];
}

export interface ProductDoctorOutput {
  seoScore: number;
  imageScore: number;
  titleScore: number;
  descriptionScore: number;
  attributeCompleteness: number;
  reviewRisk: string;
  returnRisk: string;
  diagnosis: string[];
  suggestions: string[];
  seoTitleRu: string;
  seoDescriptionRu: string;
  seoBulletsRu: string[];
  keywordsRu: string[];
  warnings: string[];
  missingData: string[];
}

export interface ProductProblem {
  productId: string;
  wbNmId: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasons: string[];
  metrics: {
    rating: number;
    reviewCount: number;
    stock: number;
    price: number;
    unansweredReviews: number;
  };
}

export interface TelegramAlertSummary {
  healthScore: number;
  criticalLines: string[];
  suggestedLines: string[];
  message: string;
}

export interface WbConnectionResult {
  ok: boolean;
  mode: "mock" | "real";
  seller?: {
    name?: string;
    sid?: string;
    tradeMark?: string;
    tin?: string;
  };
  scopes: string[];
  capabilities: string[];
  errors: string[];
}
