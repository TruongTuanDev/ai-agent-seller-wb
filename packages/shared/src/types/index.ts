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

export interface RecommendedAction {
  type: ActionType;
  title: string;
  reason: string;
  confidence: number;
  requiresApproval: boolean;
  payload: Record<string, unknown>;
}

export interface ShopHealthInput {
  shop: Record<string, unknown>;
  kpis: Record<string, unknown>;
  products: Record<string, unknown>[];
  feedbacks: Record<string, unknown>[];
  analytics: Record<string, unknown>;
  inventory: Record<string, unknown>;
  competitors: Record<string, unknown>[];
}

export interface ShopHealthReport {
  healthScore: number;
  summary: string;
  risks: string[];
  opportunities: string[];
  recommendedActions: RecommendedAction[];
  missingData?: string[];
}

export interface ReviewReplyInput {
  customerName?: string;
  reviewText: string;
  rating: number;
  productTitle: string;
}

export interface ReviewReplyOutput {
  reply: string;
  tone: string;
  missingData?: string[];
}

export interface ProductDoctorInput {
  title: string;
  description?: string;
  category?: string;
  price?: number;
  stock?: number;
  rating?: number;
}

export interface ProductDoctorOutput {
  seoScore: number;
  diagnosis: string[];
  suggestions: string[];
  seoTitleRu?: string;
  seoBulletsRu?: string[];
  missingData?: string[];
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
