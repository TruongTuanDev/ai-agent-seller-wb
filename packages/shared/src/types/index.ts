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

export type WbExecutionMode = "mock" | "dry_run" | "real_write";

export type UserPlan = "FREE" | "PRO" | "AGENCY";

export type SellerOperatingMode = "ASSISTANT" | "OPERATOR" | "MANAGER";

export type CopilotIntent =
  | "SHOP_HEALTH"
  | "SALES_DROP_ANALYSIS"
  | "REVIEW_MANAGEMENT"
  | "PRODUCT_DOCTOR"
  | "INVENTORY_RISK"
  | "SEO_OPTIMIZATION"
  | "COMPETITOR_WATCH"
  | "ACTION_EXECUTION"
  | "USAGE_BILLING"
  | "GENERAL_HELP";

export type CopilotToolName =
  | "getShopHealth"
  | "getProducts"
  | "getProductProblems"
  | "getInventoryWarnings"
  | "getFeedbacks"
  | "getLatestReport"
  | "createReviewDraft"
  | "runProductDoctor"
  | "getUsageInfo";

export interface CopilotActionPlanStep {
  step: number;
  tool: CopilotToolName;
  reason: string;
}

export interface CopilotActionPlanner {
  intent: CopilotIntent;
  confidence: number;
  requiredTools: CopilotToolName[];
  plan: CopilotActionPlanStep[];
}

export interface CopilotBusinessInsight {
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  evidence: string[];
  businessImpact: string;
  recommendedAction: string;
  relatedSku?: string;
  estimatedLossRub?: number;
}

export type CopilotCard =
  | {
      type: "health";
      title: string;
      healthScore: number;
      summary: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "insight";
      title: string;
      summary: string;
      severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      ctaTitle?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "product";
      title: string;
      productId: string;
      sku: string;
      summary: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "review";
      title: string;
      feedbackId: string;
      summary: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "review";
      title: string;
      feedbackId: string;
      summary: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "inventory";
      title: string;
      sku: string;
      summary: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "productRisk";
      title: string;
      productId: string;
      sku: string;
      summary: string;
      severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      metadata?: Record<string, unknown>;
    }
  | {
      type: "reviewQueue";
      title: string;
      summary: string;
      pendingCount: number;
      negativeCount: number;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "inventoryRisk";
      title: string;
      summary: string;
      affectedSkus: string[];
      metadata?: Record<string, unknown>;
    }
  | {
      type: "actionPlan";
      title: string;
      summary: string;
      steps: CopilotActionPlanStep[];
      metadata?: Record<string, unknown>;
    }
  | {
      type: "usageLimit";
      title: string;
      summary: string;
      planName: UserPlan;
      metadata?: Record<string, unknown>;
    };

export interface CopilotSuggestedAction {
  type:
    | "OPEN_REVIEW_QUEUE"
    | "RUN_PRODUCT_DOCTOR"
    | "CREATE_REVIEW_DRAFTS"
    | "VIEW_INVENTORY_RISK"
    | "OPEN_ACTION_QUEUE"
    | "RUN_HEALTH_REPORT"
    | "GENERATE_HEALTH_REPORT"
    | "OPEN_WEB_DASHBOARD";
  title: string;
  reason: string;
  payload: Record<string, unknown>;
  requiresApproval: boolean;
}

export interface CopilotConversationSummary {
  id: string;
  shopId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface CopilotConversationMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
}

export interface CopilotChatResponse {
  conversationId: string;
  answer: string;
  suggestedActions: CopilotSuggestedAction[];
  cards: CopilotCard[];
  intent?: CopilotIntent;
  planner?: CopilotActionPlanner;
}
