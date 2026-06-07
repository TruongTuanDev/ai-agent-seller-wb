import { ConversationRole, FeedbackStatus, Prisma, SellerOperatingMode, type Feedback, type Product, type Shop, type User } from "@prisma/client";
import type {
  CopilotActionPlanner,
  CopilotBusinessInsight,
  CopilotCard,
  CopilotChatResponse,
  CopilotConversationMessage,
  CopilotConversationSummary,
  CopilotIntent,
  CopilotSuggestedAction,
  CopilotToolName,
  ProductDoctorOutput,
  ProductProblem,
  ShopHealthReport
} from "@wb/shared";
import { prisma } from "../../database/prisma";
import { assertUsageAvailable, getUsageSnapshot, incrementUsage } from "../../common/usage";
import { analyzeProductProblems, getProductReviewWarnings } from "../products/service";
import { getAiProvider } from "../ai/provider";

const aiProvider = getAiProvider();
const COPILOT_SYSTEM_PROMPT = [
  "Ban dong vai Wildberries Operations Manager.",
  "Uu tien theo thu tu: doanh thu, conversion, review, inventory, SEO, competitor.",
  "Khong duoc bịa du lieu va chi duoc dua tren tool outputs da lay tu backend.",
  "Planner khong duoc tu execute write action nguy hiem.",
  "Moi cau tra loi phai co 4 phan: ket luan ngan, bang chung, y nghia kinh doanh, viec nen lam tiep theo.",
  "Neu thieu du lieu, phai noi ro thieu du lieu va huong seller sync hoac ket noi token."
].join(" ");

type ConversationContext = {
  activeProductId?: string;
  activeSku?: string;
  activeIntent?: CopilotIntent;
  productQuery?: string;
  feedbackId?: string;
};

type ShopContext = Shop & {
  products: Product[];
  feedbacks: Array<Feedback & { product: Product | null }>;
  aiReports: Array<{
    id: string;
    healthScore: number;
    summary: string;
    risksJson: unknown;
    opportunitiesJson: unknown;
    actionsJson: unknown;
    detailsJson: unknown;
    createdAt: Date;
  }>;
  snapshots: Array<{
    revenue: number;
    ordersCount: number;
    addToCartConversion: number;
    cartToOrderConversion: number;
    buyoutPercent: number;
    rawJson: Prisma.JsonValue;
  }>;
};

type PlannedToolCall = {
  tool: CopilotToolName;
  args?: Record<string, unknown>;
};

type ToolExecutionResult = {
  tool: CopilotToolName;
  summary: string;
  data: Record<string, unknown>;
};

type IntentClassification = {
  intent: CopilotIntent;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion?: string;
};

type InsightBundle = {
  insights: CopilotBusinessInsight[];
  missingData: string[];
};

type UsageSnapshot = Awaited<ReturnType<typeof getUsageSnapshot>>;

function toJsonSafe<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafe(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, toJsonSafe(item)])
    ) as T;
  }

  return value;
}

function normalizeReport(report: ShopContext["aiReports"][number] | null): ShopHealthReport | null {
  if (!report) {
    return null;
  }

  const details = report.detailsJson && typeof report.detailsJson === "object"
    ? (report.detailsJson as Record<string, unknown>)
    : null;

  return {
    healthScore: report.healthScore,
    executiveSummary: String(details?.executiveSummary ?? report.summary),
    kpiSummary: details?.kpiSummary && typeof details.kpiSummary === "object"
      ? (details.kpiSummary as ShopHealthReport["kpiSummary"])
      : {
          revenueTrend: "Chua co du lieu doanh thu.",
          orderTrend: "Chua co du lieu don hang.",
          conversionTrend: "Chua co du lieu conversion.",
          reviewRisk: "Chua co du lieu review risk.",
          inventoryRisk: "Chua co du lieu inventory risk."
        },
    criticalIssues: Array.isArray(details?.criticalIssues)
      ? (details.criticalIssues as ShopHealthReport["criticalIssues"])
      : Array.isArray(report.risksJson)
        ? (report.risksJson as ShopHealthReport["criticalIssues"])
        : [],
    growthOpportunities: Array.isArray(details?.growthOpportunities)
      ? (details.growthOpportunities as ShopHealthReport["growthOpportunities"])
      : Array.isArray(report.opportunitiesJson)
        ? (report.opportunitiesJson as ShopHealthReport["growthOpportunities"])
        : [],
    recommendedActions: Array.isArray(details?.recommendedActions)
      ? (details.recommendedActions as ShopHealthReport["recommendedActions"])
      : Array.isArray(report.actionsJson)
        ? (report.actionsJson as ShopHealthReport["recommendedActions"])
        : [],
    missingData: Array.isArray(details?.missingData) ? details.missingData.map(String) : []
  };
}

function createConversationTitle(message: string) {
  const compact = message.trim().replace(/\s+/g, " ");
  return compact.length > 60 ? `${compact.slice(0, 57)}...` : compact;
}

function normalizeText(value: string) {
  return value.toLowerCase();
}

function severityWeight(severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[severity];
}

function extractSkuQuery(message: string) {
  const match = message.match(/(?:sku|ma sku|wbnmid|vendor code)\s*[:-]?\s*([a-z0-9-]+)/i);
  if (match) {
    return match[1];
  }

  const explicitCode = message.match(/\b[A-Z]{2,}-\d{2,}\b/i);
  if (explicitCode) {
    return explicitCode[0];
  }

  const numeric = message.match(/\b\d{6,}\b/);
  return numeric?.[0];
}

function dedupeToolCalls(calls: PlannedToolCall[]) {
  const seen = new Set<string>();
  return calls.filter((call) => {
    const key = `${call.tool}:${JSON.stringify(call.args ?? {})}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function extractConversationContext(messages: Array<{ metadataJson: Prisma.JsonValue | null }>): ConversationContext {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const metadata = messages[index]?.metadataJson;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      continue;
    }

    const record = metadata as Record<string, unknown>;
    const activeEntity = record.activeEntity;
    if (activeEntity && typeof activeEntity === "object" && !Array.isArray(activeEntity)) {
      const entityRecord = activeEntity as Record<string, unknown>;
      return {
        activeProductId: typeof entityRecord.activeProductId === "string" ? entityRecord.activeProductId : undefined,
        activeSku: typeof entityRecord.activeSku === "string" ? entityRecord.activeSku : undefined,
        activeIntent: typeof entityRecord.activeIntent === "string" ? entityRecord.activeIntent as CopilotIntent : undefined,
        productQuery: typeof entityRecord.activeSku === "string" ? entityRecord.activeSku : undefined,
        feedbackId: typeof entityRecord.feedbackId === "string" ? entityRecord.feedbackId : undefined
      };
    }

    const selectedProduct = record.selectedProduct;
    if (selectedProduct && typeof selectedProduct === "object" && !Array.isArray(selectedProduct)) {
      const productRecord = selectedProduct as Record<string, unknown>;
      return {
        activeProductId: typeof productRecord.productId === "string" ? productRecord.productId : undefined,
        activeSku: typeof productRecord.sku === "string" ? productRecord.sku : undefined,
        productQuery: typeof productRecord.sku === "string" ? productRecord.sku : undefined,
        feedbackId: typeof record.feedbackId === "string" ? record.feedbackId : undefined
      };
    }
  }

  return {};
}

function findProduct(shop: ShopContext, query: string | undefined, context: ConversationContext) {
  if (context.activeProductId) {
    const byId = shop.products.find((product) => product.id === context.activeProductId);
    if (byId) {
      return byId;
    }
  }

  const effectiveQuery = query ?? context.activeSku ?? context.productQuery;
  if (!effectiveQuery) {
    return null;
  }

  const normalized = normalizeText(effectiveQuery);
  return shop.products.find((product) =>
    [product.wbNmId, product.vendorCode, product.title]
      .filter(Boolean)
      .some((value) => normalizeText(String(value)).includes(normalized))
  ) ?? null;
}

function classifyIntent(message: string, context: ConversationContext): IntentClassification {
  const lower = normalizeText(message);
  const skuQuery = extractSkuQuery(message) ?? context.activeSku;

  if (lower.includes("goi") || lower.includes("gui") || lower.includes("thuc thi") || lower.includes("approve")) {
    return { intent: "ACTION_EXECUTION", confidence: 0.72, needsClarification: false };
  }

  if (lower.includes("goi cuoc") || lower.includes("quota") || lower.includes("usage") || lower.includes("billing") || lower.includes("plan")) {
    return { intent: "USAGE_BILLING", confidence: 0.95, needsClarification: false };
  }

  if (lower.includes("doi thu") || lower.includes("competitor")) {
    return { intent: "COMPETITOR_WATCH", confidence: 0.93, needsClarification: false };
  }

  if (lower.includes("review") || lower.includes("feedback") || lower.includes("phan hoi") || lower.includes("tra loi")) {
    return { intent: "REVIEW_MANAGEMENT", confidence: 0.94, needsClarification: false };
  }

  if (lower.includes("ton kho") || lower.includes("het hang") || lower.includes("inventory") || lower.includes("sap het")) {
    return { intent: "INVENTORY_RISK", confidence: 0.94, needsClarification: false };
  }

  if (lower.includes("seo") || lower.includes("toi uu seo")) {
    return { intent: "SEO_OPTIMIZATION", confidence: 0.91, needsClarification: false };
  }

  if (skuQuery || lower.includes("san pham") || lower.includes("product doctor") || lower.includes("toi uu")) {
    return { intent: lower.includes("seo") ? "SEO_OPTIMIZATION" : "PRODUCT_DOCTOR", confidence: 0.89, needsClarification: false };
  }

  if ((lower.includes("tai sao") || lower.includes("giam") || lower.includes("giam")) && (lower.includes("don") || lower.includes("doanh thu"))) {
    return { intent: "SALES_DROP_ANALYSIS", confidence: 0.92, needsClarification: false };
  }

  if (lower.includes("health") || lower.includes("bao cao") || lower.includes("suc khoe")) {
    return { intent: "SHOP_HEALTH", confidence: 0.86, needsClarification: false };
  }

  if ((lower.includes("toi uu") || lower.includes("kiem tra")) && context.activeSku) {
    return { intent: "PRODUCT_DOCTOR", confidence: 0.84, needsClarification: false };
  }

  return {
    intent: "GENERAL_HELP",
    confidence: 0.38,
    needsClarification: true,
    clarificationQuestion: "Toi can ro hon: ban muon xem health shop, review, ton kho hay toi uu SKU nao?"
  };
}

function createActionPlanner(input: {
  intent: IntentClassification;
  message: string;
  mode: SellerOperatingMode;
  context: ConversationContext;
}): CopilotActionPlanner {
  const lower = normalizeText(input.message);
  const query = extractSkuQuery(input.message) ?? input.context.activeSku;
  const steps: PlannedToolCall[] = [];

  switch (input.intent.intent) {
    case "SHOP_HEALTH":
      steps.push({ tool: "getLatestReport" }, { tool: "getShopHealth" }, { tool: "getProductProblems" }, { tool: "getInventoryWarnings" });
      break;
    case "SALES_DROP_ANALYSIS":
      steps.push({ tool: "getLatestReport" }, { tool: "getShopHealth" }, { tool: "getFeedbacks", args: { unansweredOnly: true } }, { tool: "getInventoryWarnings" }, { tool: "getProductProblems" });
      break;
    case "REVIEW_MANAGEMENT":
      steps.push({
        tool: "getFeedbacks",
        args: {
          unansweredOnly: true,
          negativeOnly: lower.includes("tieu cuc") || lower.includes("negative")
        }
      });
      if (lower.includes("viet") || lower.includes("draft") || lower.includes("tra loi")) {
        steps.push({
          tool: "createReviewDraft",
          args: { persist: input.mode !== "ASSISTANT" }
        });
      }
      break;
    case "PRODUCT_DOCTOR":
    case "SEO_OPTIMIZATION":
      steps.push({ tool: "getProducts", args: { query } }, { tool: "getProductProblems", args: { query } }, { tool: "runProductDoctor", args: { query } });
      break;
    case "INVENTORY_RISK":
      steps.push({ tool: "getInventoryWarnings" }, { tool: "getProducts", args: { query } });
      break;
    case "COMPETITOR_WATCH":
      steps.push({ tool: "getLatestReport" }, { tool: "getShopHealth" });
      break;
    case "ACTION_EXECUTION":
      steps.push({ tool: "getFeedbacks", args: { unansweredOnly: true } }, { tool: "getInventoryWarnings" });
      break;
    case "USAGE_BILLING":
      steps.push({ tool: "getUsageInfo" });
      break;
    case "GENERAL_HELP":
    default:
      break;
  }

  if (input.intent.intent !== "USAGE_BILLING") {
    steps.push({ tool: "getUsageInfo" });
  }

  const deduped = dedupeToolCalls(steps);
  return {
    intent: input.intent.intent,
    confidence: input.intent.confidence,
    requiredTools: deduped.map((step) => step.tool),
    plan: deduped.map((step, index) => ({
      step: index + 1,
      tool: step.tool,
      reason:
        step.tool === "getLatestReport" ? "Lay report gan nhat de co boi canh tong quan."
          : step.tool === "getShopHealth" ? "Tinh lai hoac doc health report de co score va critical issues."
            : step.tool === "getFeedbacks" ? "Kiem tra backlog review va review tieu cuc."
              : step.tool === "getInventoryWarnings" ? "Xac dinh SKU sap het hang."
                : step.tool === "getProductProblems" ? "Tong hop SKU co rating, SEO, ton kho hoac review risk."
                  : step.tool === "runProductDoctor" ? "Tao chan doan SEO/Product Doctor cho SKU dang duoc nhac toi."
                    : step.tool === "createReviewDraft" ? "Chi tao draft review hoac action an toan, khong gui that."
                      : step.tool === "getProducts" ? "Tim SKU dang duoc seller hoi toi."
                        : "Doc usage va gioi han hien tai."
    }))
  };
}

async function ensureHealthReport(shop: ShopContext): Promise<ShopHealthReport> {
  const existing = normalizeReport(shop.aiReports[0] ?? null);
  if (existing) {
    return existing;
  }

  const latestSnapshot = shop.snapshots[0];
  return aiProvider.generateShopHealthReport({
    shop: {
      id: shop.id,
      name: shop.name,
      status: shop.status,
      tokenScopes: shop.tokenScopes
    },
    kpis: latestSnapshot
      ? {
          revenue: latestSnapshot.revenue,
          ordersCount: latestSnapshot.ordersCount,
          addToCartConversion: latestSnapshot.addToCartConversion,
          cartToOrderConversion: latestSnapshot.cartToOrderConversion,
          buyoutPercent: latestSnapshot.buyoutPercent
        }
      : {},
    products: shop.products,
    feedbacks: shop.feedbacks,
    analytics: latestSnapshot?.rawJson && typeof latestSnapshot.rawJson === "object"
      ? (latestSnapshot.rawJson as Record<string, unknown>)
      : {},
    inventory: { lowStockCount: shop.products.filter((product) => product.stock <= 12).length },
    competitors: [],
    productProblems: analyzeProductProblems(shop.products, shop.feedbacks)
  });
}

async function createReviewDraftTool(input: {
  shop: ShopContext;
  mode: SellerOperatingMode;
  userId: string;
  persist: boolean;
}): Promise<ToolExecutionResult> {
  const feedback = input.shop.feedbacks
    .filter((item) => item.status !== FeedbackStatus.SENT && item.product)
    .sort((left, right) => left.rating - right.rating || right.createdAt.getTime() - left.createdAt.getTime())[0];

  if (!feedback || !feedback.product) {
    return {
      tool: "createReviewDraft",
      summary: "Khong tim thay review can draft.",
      data: { created: false }
    };
  }

  await assertUsageAvailable(input.userId, "reviewDraft");

  const draft = await aiProvider.generateReviewReply({
    reviewText: feedback.text,
    rating: feedback.rating,
    productTitle: feedback.product.title,
    tone: "professional",
    allowRefundPromise: false
  });

  if (!input.persist) {
    await incrementUsage(input.userId, "reviewDraft");
    return {
      tool: "createReviewDraft",
      summary: `Da tao draft preview cho review ${feedback.wbFeedbackId}.`,
      data: {
        created: true,
        persisted: false,
        feedbackId: feedback.id,
        wbFeedbackId: feedback.wbFeedbackId,
        reply: draft.reply,
        tone: draft.tone,
        detectedSentiment: draft.detectedSentiment,
        productId: feedback.productId,
        productTitle: feedback.product.title
      }
    };
  }

  const updatedFeedback = await prisma.feedback.update({
    where: { id: feedback.id },
    data: {
      aiReplyDraft: draft.reply,
      status: FeedbackStatus.DRAFTED
    }
  });

  const action = await prisma.action.create({
    data: {
      shopId: input.shop.id,
      type: "REPLY_REVIEW",
      title: `Gui reply review cho ${feedback.product.title}`,
      payloadJson: {
        feedbackId: feedback.id,
        wbFeedbackId: feedback.wbFeedbackId,
        productId: feedback.productId,
        replyText: draft.reply,
        draftReply: draft.reply,
        tone: draft.tone
      } as Prisma.InputJsonValue
    }
  });

  await incrementUsage(input.userId, "reviewDraft");

  return {
    tool: "createReviewDraft",
    summary: `Da tao draft va dua vao action queue cho review ${feedback.wbFeedbackId}.`,
    data: {
      created: true,
      persisted: true,
      feedbackId: updatedFeedback.id,
      wbFeedbackId: updatedFeedback.wbFeedbackId,
      actionId: action.id,
      reply: draft.reply,
      tone: draft.tone,
      detectedSentiment: draft.detectedSentiment,
      productId: feedback.productId,
      productTitle: feedback.product.title
    }
  };
}

async function executeToolCall(input: {
  call: PlannedToolCall;
  shop: ShopContext;
  user: User;
  mode: SellerOperatingMode;
  context: ConversationContext;
}): Promise<ToolExecutionResult> {
  const { call, shop, user, mode, context } = input;

  switch (call.tool) {
    case "getShopHealth": {
      const report = await ensureHealthReport(shop);
      return {
        tool: "getShopHealth",
        summary: `Health score hien tai la ${report.healthScore}/100.`,
        data: { report }
      };
    }
    case "getLatestReport": {
      const report = normalizeReport(shop.aiReports[0] ?? null);
      return {
        tool: "getLatestReport",
        summary: report
          ? `Da tim thay report gan nhat voi health score ${report.healthScore}/100.`
          : "Chua co report luu san cho shop nay.",
        data: { report }
      };
    }
    case "getProducts": {
      const query = typeof call.args?.query === "string" ? call.args.query : context.productQuery;
      const products = query
        ? shop.products.filter((product) =>
            [product.wbNmId, product.vendorCode, product.title]
              .filter(Boolean)
              .some((value) => normalizeText(String(value)).includes(normalizeText(query)))
          )
        : shop.products.slice(0, 6);

      return {
        tool: "getProducts",
        summary: query ? `Tim thay ${products.length} san pham cho truy van "${query}".` : `Da lay ${products.length} san pham mau.`,
        data: {
          query: query ?? null,
          products: products.map((product) => ({
            id: product.id,
            wbNmId: product.wbNmId,
            vendorCode: product.vendorCode,
            title: product.title,
            stock: product.stock,
            price: product.price,
            rating: product.rating,
            reviewCount: product.reviewCount
          }))
        }
      };
    }
    case "getProductProblems": {
      const problems = analyzeProductProblems(shop.products, shop.feedbacks);
      const query = typeof call.args?.query === "string" ? call.args.query : context.productQuery;
      const filtered = query
        ? problems.filter((problem) => [problem.wbNmId, problem.title].some((value) => normalizeText(value).includes(normalizeText(query))))
        : problems;

      return {
        tool: "getProductProblems",
        summary: `Da xac dinh ${filtered.length} SKU co van de.`,
        data: {
          query: query ?? null,
          problems: filtered
        }
      };
    }
    case "getInventoryWarnings": {
      const warnings = shop.products
        .filter((product) => product.stock <= 12)
        .sort((left, right) => left.stock - right.stock)
        .map((product) => ({
          productId: product.id,
          sku: product.wbNmId,
          vendorCode: product.vendorCode,
          title: product.title,
          stock: product.stock,
          estimatedDaysLeft: product.stock <= 5 ? 2 : product.stock <= 8 ? 4 : 7
        }));

      return {
        tool: "getInventoryWarnings",
        summary: `Co ${warnings.length} SKU sap het hang.`,
        data: { warnings }
      };
    }
    case "getFeedbacks": {
      const unansweredOnly = Boolean(call.args?.unansweredOnly);
      const negativeOnly = Boolean(call.args?.negativeOnly);
      const feedbacks = shop.feedbacks.filter((feedback) => {
        if (unansweredOnly && feedback.status === FeedbackStatus.SENT) {
          return false;
        }
        if (negativeOnly && feedback.rating > 3) {
          return false;
        }
        return true;
      });

      return {
        tool: "getFeedbacks",
        summary: `Co ${feedbacks.length} review phu hop.`,
        data: {
          unansweredCount: shop.feedbacks.filter((feedback) => feedback.status !== FeedbackStatus.SENT).length,
          negativeCount: shop.feedbacks.filter((feedback) => feedback.rating <= 3 && feedback.status !== FeedbackStatus.SENT).length,
          feedbacks: feedbacks.slice(0, 10).map((feedback) => ({
            id: feedback.id,
            wbFeedbackId: feedback.wbFeedbackId,
            rating: feedback.rating,
            status: feedback.status,
            text: feedback.text,
            productId: feedback.productId,
            productTitle: feedback.product?.title ?? null,
            aiReplyDraft: feedback.aiReplyDraft
          }))
        }
      };
    }
    case "createReviewDraft":
      return createReviewDraftTool({
        shop,
        mode,
        userId: user.id,
        persist: Boolean(call.args?.persist)
      });
    case "runProductDoctor": {
      const query = typeof call.args?.query === "string" ? call.args.query : context.productQuery;
      const product = findProduct(shop, query, context);
      if (!product) {
        return {
          tool: "runProductDoctor",
          summary: "Khong tim thay san pham de chay Product Doctor.",
          data: { productId: null, diagnosis: null }
        };
      }

      const feedbacks = shop.feedbacks.filter((feedback) => feedback.productId === product.id);
      const diagnosis = await aiProvider.generateProductDoctor({
        title: product.title,
        description: product.description ?? undefined,
        category: product.category,
        price: product.price,
        stock: product.stock,
        rating: product.rating,
        attributes: (product.attributesJson as Record<string, unknown> | null) ?? undefined,
        reviewSnippets: feedbacks.slice(0, 6).map((feedback) => feedback.text)
      });

      return {
        tool: "runProductDoctor",
        summary: `Da chay Product Doctor cho ${product.title}.`,
        data: {
          productId: product.id,
          sku: product.wbNmId,
          vendorCode: product.vendorCode,
          title: product.title,
          stock: product.stock,
          rating: product.rating,
          diagnosis: {
            ...diagnosis,
            warnings: diagnosis.warnings.length > 0 ? diagnosis.warnings : getProductReviewWarnings(feedbacks)
          }
        }
      };
    }
    case "getUsageInfo": {
      const usage = await getUsageSnapshot(user.id);
      return {
        tool: "getUsageInfo",
        summary: `Plan hien tai la ${usage.plan}.`,
        data: { usage }
      };
    }
    default:
      return {
        tool: call.tool,
        summary: "Tool chua duoc ho tro.",
        data: {}
      };
  }
}

function createSalesDropInsight(shop: ShopContext, report: ShopHealthReport | null, feedbackResult: ToolExecutionResult | undefined, inventoryResult: ToolExecutionResult | undefined): InsightBundle {
  const missingData: string[] = [];
  const insights: CopilotBusinessInsight[] = [];
  const latest = shop.snapshots[0];
  const previous = shop.snapshots[1];

  if (!latest || !previous) {
    missingData.push("snapshot_history");
  } else {
    const revenueDelta = previous.revenue > 0 ? ((latest.revenue - previous.revenue) / previous.revenue) * 100 : 0;
    const orderDelta = previous.ordersCount > 0 ? ((latest.ordersCount - previous.ordersCount) / previous.ordersCount) * 100 : 0;
    if (revenueDelta < -5 || orderDelta < -5) {
      insights.push({
        title: "Doanh thu va don hang dang giam",
        severity: revenueDelta < -15 || orderDelta < -15 ? "CRITICAL" : "HIGH",
        evidence: [
          `Doanh thu snapshot gan nhat la ${latest.revenue.toLocaleString("en-US")} RUB, truoc do ${previous.revenue.toLocaleString("en-US")} RUB.`,
          `So don giam tu ${previous.ordersCount} xuong ${latest.ordersCount}.`,
          report?.kpiSummary.conversionTrend ?? "Chua co du lieu conversion detail."
        ],
        businessImpact: "Neu xu huong nay tiep tuc, shop se mat doanh thu va giam toc do quay vong SKU ban chay.",
        recommendedAction: "Uu tien xu ly review ton dong, SKU sap het hang va kiem tra lai listing co conversion yeu.",
        estimatedLossRub: Math.max(0, Math.round(previous.revenue - latest.revenue))
      });
    }
  }

  if (feedbackResult) {
    const unansweredCount = Number(feedbackResult.data.unansweredCount ?? 0);
    if (unansweredCount > 0) {
      insights.push({
        title: "Backlog review dang can xu ly",
        severity: unansweredCount >= 15 ? "HIGH" : "MEDIUM",
        evidence: [
          `${unansweredCount} review chua tra loi.`,
          `${Number(feedbackResult.data.negativeCount ?? 0)} review tieu cuc chua duoc xu ly.`
        ],
        businessImpact: "Review ton dong lam giam trust, anh huong conversion va co the lam xau health score.",
        recommendedAction: "Tao AI draft cho review 1-3 sao truoc, sau do day vao approval queue."
      });
    }
  }

  if (inventoryResult) {
    const warnings = Array.isArray(inventoryResult.data.warnings) ? inventoryResult.data.warnings as Array<Record<string, unknown>> : [];
    const top = warnings[0];
    if (top) {
      insights.push({
        title: "SKU ban chay dang sap het hang",
        severity: Number(top.stock ?? 999) <= 5 ? "CRITICAL" : "HIGH",
        evidence: [
          `${String(top.sku ?? "")} chi con ${String(top.stock ?? "--")} san pham.`,
          `Tong cong ${warnings.length} SKU dang duoi nguong canh bao ton kho.`
        ],
        businessImpact: "Het hang o SKU ban chay se lam mat doanh thu ngay va giam do phu listing.",
        recommendedAction: "Lap ke hoach bo sung kho va theo doi lai sau lan sync tiep theo.",
        relatedSku: String(top.sku ?? "")
      });
    }
  }

  return { insights, missingData };
}

function buildBusinessInsights(input: {
  intent: CopilotIntent;
  shop: ShopContext;
  results: ToolExecutionResult[];
}): InsightBundle {
  const report = input.results.find((result) => result.tool === "getShopHealth")?.data.report as ShopHealthReport | undefined;
  const feedbackResult = input.results.find((result) => result.tool === "getFeedbacks");
  const inventoryResult = input.results.find((result) => result.tool === "getInventoryWarnings");
  const problemsResult = input.results.find((result) => result.tool === "getProductProblems");
  const doctorResult = input.results.find((result) => result.tool === "runProductDoctor");
  const usageResult = input.results.find((result) => result.tool === "getUsageInfo");

  if (input.intent === "SALES_DROP_ANALYSIS") {
    return createSalesDropInsight(input.shop, report ?? null, feedbackResult, inventoryResult);
  }

  const insights: CopilotBusinessInsight[] = [];
  const missingData = new Set<string>();

  if (input.intent === "COMPETITOR_WATCH") {
    missingData.add("competitor_data");
    insights.push({
      title: "Chua co data doi thu",
      severity: "MEDIUM",
      evidence: ["He thong hien chua dong bo du lieu competitor tu Wildberries cho shop nay."],
      businessImpact: "Khong nen ket luan doi thu dang lam gi neu chua co bang chung.",
      recommendedAction: "Tam thoi uu tien review, inventory va SEO la nhung du lieu da co san."
    });
    return { insights, missingData: Array.from(missingData) };
  }

  if (input.intent === "REVIEW_MANAGEMENT" && feedbackResult) {
    const feedbacks = Array.isArray(feedbackResult.data.feedbacks) ? feedbackResult.data.feedbacks as Array<Record<string, unknown>> : [];
    insights.push({
      title: "Review queue can xu ly",
      severity: Number(feedbackResult.data.negativeCount ?? 0) >= 5 ? "HIGH" : "MEDIUM",
      evidence: [
        `${Number(feedbackResult.data.unansweredCount ?? 0)} review chua tra loi.`,
        `${Number(feedbackResult.data.negativeCount ?? 0)} review tieu cuc chua xu ly.`,
        feedbacks[0]?.text ? `Vi du review moi nhat: ${String(feedbacks[0].text).slice(0, 120)}` : "Chua co review mau de trich dan."
      ],
      businessImpact: "Tra loi cham lam giam trust va co the anh huong conversion listing.",
      recommendedAction: "Mo review queue, draft AI cho review 1-3 sao truoc va giu approval flow truoc khi gui."
    });
  }

  if ((input.intent === "INVENTORY_RISK" || input.intent === "SHOP_HEALTH") && inventoryResult) {
    const warnings = Array.isArray(inventoryResult.data.warnings) ? inventoryResult.data.warnings as Array<Record<string, unknown>> : [];
    if (warnings.length === 0) {
      missingData.add("inventory_warnings");
    } else {
      warnings.slice(0, 2).forEach((warning) => {
        insights.push({
          title: `${String(warning.sku ?? "")} dang sap het hang`,
          severity: Number(warning.stock ?? 99) <= 5 ? "CRITICAL" : "HIGH",
          evidence: [
            `${String(warning.title ?? "SKU")} con ${String(warning.stock ?? "--")} san pham.`,
            `Vendor code: ${String(warning.vendorCode ?? "--")}.`
          ],
          businessImpact: "Het hang o SKU nay se lam mat doanh thu va co the lam sut hang tim kiem.",
          recommendedAction: "Kiem tra lai ke hoach bo sung kho va mo inventory risk view.",
          relatedSku: String(warning.sku ?? "")
        });
      });
    }
  }

  if ((input.intent === "PRODUCT_DOCTOR" || input.intent === "SEO_OPTIMIZATION") && doctorResult?.data.diagnosis) {
    const diagnosis = doctorResult.data.diagnosis as ProductDoctorOutput;
    insights.push({
      title: "SKU can toi uu SEO va noi dung",
      severity: diagnosis.seoScore < 55 ? "HIGH" : "MEDIUM",
      evidence: [
        `SEO score ${diagnosis.seoScore}/100, title score ${diagnosis.titleScore}/100, description score ${diagnosis.descriptionScore}/100.`,
        `Review risk: ${diagnosis.reviewRisk}`,
        diagnosis.warnings[0] ? `Warning: ${diagnosis.warnings[0]}` : "Chua co warning review bo sung."
      ],
      businessImpact: "Noi dung yeu lam giam kha nang tim thay va co the keo conversion xuong.",
      recommendedAction: "Mo Product Doctor va review draft title/description tieng Nga truoc khi cap nhat listing.",
      relatedSku: String(doctorResult.data.sku ?? "")
    });
    if (diagnosis.missingData.length > 0) {
      diagnosis.missingData.forEach((item) => missingData.add(item));
    }
  }

  if (problemsResult) {
    const problems = Array.isArray(problemsResult.data.problems) ? problemsResult.data.problems as ProductProblem[] : [];
    problems.slice(0, 2).forEach((problem) => {
      insights.push({
        title: `${problem.wbNmId} co van de van hanh`,
        severity: problem.severity,
        evidence: problem.reasons.slice(0, 3),
        businessImpact: "SKU nay co the lam giam danh gia shop neu de ton dong qua lau.",
        recommendedAction: "Uu tien SKU severity cao va chuyen Product Doctor neu lien quan SEO.",
        relatedSku: problem.wbNmId
      });
    });
  }

  if (input.intent === "USAGE_BILLING" && usageResult) {
    const usage = usageResult.data.usage as UsageSnapshot | undefined;
    if (usage) {
      insights.push({
        title: `Plan hien tai: ${usage.plan}`,
        severity: usage.remaining.reviewDrafts <= 5 ? "MEDIUM" : "LOW",
        evidence: [
          `Con ${usage.remaining.reviewDrafts} review draft trong thang.`,
          `Con ${usage.remaining.healthReports} health report trong thang.`,
          `Real write ${usage.limits.realWriteEnabled ? "duoc bat theo plan" : "chua duoc plan cho phep"}.`
        ],
        businessImpact: "Nam quota som giup tranh bi chan khi can tao draft hang loat.",
        recommendedAction: "Theo doi usage card va nang plan neu seller can xu ly nhieu shop hon."
      });
    }
  }

  if (report?.missingData) {
    report.missingData.forEach((item) => missingData.add(item));
  }

  return {
    insights: insights.sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity)).slice(0, 4),
    missingData: Array.from(missingData)
  };
}

function buildCards(input: {
  results: ToolExecutionResult[];
  insights: CopilotBusinessInsight[];
  planner: CopilotActionPlanner;
}): CopilotCard[] {
  const cards: CopilotCard[] = [];
  const health = input.results.find((result) => result.tool === "getShopHealth")?.data.report as ShopHealthReport | undefined;
  const feedbacks = input.results.find((result) => result.tool === "getFeedbacks");
  const inventory = input.results.find((result) => result.tool === "getInventoryWarnings");
  const usage = input.results.find((result) => result.tool === "getUsageInfo")?.data.usage as UsageSnapshot | undefined;
  const draft = input.results.find((result) => result.tool === "createReviewDraft");
  const doctor = input.results.find((result) => result.tool === "runProductDoctor");

  if (health) {
    cards.push({
      type: "health",
      title: "Shop Health",
      healthScore: health.healthScore,
      summary: health.executiveSummary,
      metadata: {
        criticalIssues: health.criticalIssues.slice(0, 3),
        growthOpportunities: health.growthOpportunities.slice(0, 3)
      }
    });
  }

  input.insights.slice(0, 2).forEach((insight) => {
    cards.push({
      type: "insight",
      title: insight.title,
      summary: insight.businessImpact,
      severity: insight.severity,
      ctaTitle: insight.recommendedAction,
      metadata: insight as unknown as Record<string, unknown>
    });
  });

  if (doctor?.data.productId && doctor.data.diagnosis) {
    cards.push({
      type: "productRisk",
      title: String(doctor.data.title ?? "Product Doctor"),
      productId: String(doctor.data.productId),
      sku: String(doctor.data.sku ?? ""),
      summary: `SEO score ${String((doctor.data.diagnosis as ProductDoctorOutput).seoScore)}. Xem draft SEO va warning review.`,
      severity: ((doctor.data.diagnosis as ProductDoctorOutput).seoScore < 55 ? "HIGH" : "MEDIUM"),
      metadata: doctor.data
    });
  }

  if (feedbacks) {
    cards.push({
      type: "reviewQueue",
      title: "Review Queue",
      summary: `${Number(feedbacks.data.unansweredCount ?? 0)} review chua tra loi, ${Number(feedbacks.data.negativeCount ?? 0)} review tieu cuc.`,
      pendingCount: Number(feedbacks.data.unansweredCount ?? 0),
      negativeCount: Number(feedbacks.data.negativeCount ?? 0),
      metadata: feedbacks.data
    });
  }

  if (draft?.data.created) {
    cards.push({
      type: "review",
      title: `Draft review ${String(draft.data.wbFeedbackId ?? "")}`,
      feedbackId: String(draft.data.feedbackId ?? ""),
      summary: String(draft.data.reply ?? ""),
      metadata: draft.data
    });
  }

    if (inventory) {
      const warnings = Array.isArray(inventory.data.warnings) ? inventory.data.warnings as Array<Record<string, unknown>> : [];
      cards.push({
        type: "inventoryRisk",
        title: "Inventory Risk",
        summary: warnings.length > 0
        ? `${warnings.length} SKU dang duoi nguong canh bao ton kho va can xu ly som.`
        : "Chua co SKU nao roi vao nguong canh bao ton kho.",
        affectedSkus: warnings.slice(0, 4).map((item) => String(item.sku ?? "")),
        metadata: { warnings }
      });
    }

  cards.push({
    type: "actionPlan",
    title: "Action Plan",
    summary: `Copilot da lap ${input.planner.plan.length} buoc an toan cho intent ${input.planner.intent}.`,
    steps: input.planner.plan,
    metadata: input.planner as unknown as Record<string, unknown>
  });

  if (usage) {
    cards.push({
      type: "usageLimit",
      title: "Usage",
      summary: `Plan ${usage.plan}. Con ${usage.remaining.reviewDrafts} review drafts va ${usage.remaining.healthReports} health reports.`,
      planName: usage.plan,
      metadata: usage
    });
  }

  return cards.slice(0, 8);
}

function buildSuggestedActions(input: {
  intent: CopilotIntent;
  results: ToolExecutionResult[];
  mode: SellerOperatingMode;
  insights: CopilotBusinessInsight[];
}): CopilotSuggestedAction[] {
  const actions: CopilotSuggestedAction[] = [];
  const feedbacks = input.results.find((result) => result.tool === "getFeedbacks");
  const draft = input.results.find((result) => result.tool === "createReviewDraft");
  const doctor = input.results.find((result) => result.tool === "runProductDoctor");
  const inventory = input.results.find((result) => result.tool === "getInventoryWarnings");

  if (feedbacks && Number(feedbacks.data.unansweredCount ?? 0) > 0) {
    actions.push({
      type: "OPEN_REVIEW_QUEUE",
      title: "Mo Review Queue",
      reason: "Xem backlog review va giu approval flow truoc khi gui.",
      payload: {},
      requiresApproval: false
    });
  }

  if (input.mode !== "ASSISTANT" && feedbacks && Number(feedbacks.data.unansweredCount ?? 0) > 0) {
    actions.push({
      type: "CREATE_REVIEW_DRAFTS",
      title: `Tao draft cho ${Number(feedbacks.data.unansweredCount ?? 0)} review`,
      reason: "Chi tao draft va action an toan, khong gui that.",
      payload: {},
      requiresApproval: true
    });
  }

  if (doctor?.data.productId) {
    actions.push({
      type: "RUN_PRODUCT_DOCTOR",
      title: "Mo Product Doctor",
      reason: "Xem goi y SEO chi tiet cho SKU dang duoc nhac toi.",
      payload: { productId: doctor.data.productId },
      requiresApproval: false
    });
  }

  if (inventory) {
    const warnings = Array.isArray(inventory.data.warnings) ? inventory.data.warnings as Array<Record<string, unknown>> : [];
    if (warnings.length > 0) {
      actions.push({
        type: "VIEW_INVENTORY_RISK",
        title: "Xem Inventory Risk",
        reason: "Kiem tra nhung SKU dang sap het hang.",
        payload: { skus: warnings.slice(0, 5).map((item) => item.sku) },
        requiresApproval: false
      });
    }
  }

  if (draft?.data.actionId || input.intent === "ACTION_EXECUTION") {
    actions.push({
      type: "OPEN_ACTION_QUEUE",
      title: "Mo Action Queue",
      reason: "Moi action nguy hiem van phai approve va confirm lan 2.",
      payload: { actionId: draft?.data.actionId ?? null },
      requiresApproval: true
    });
  }

  if (input.intent === "SHOP_HEALTH" || input.intent === "SALES_DROP_ANALYSIS") {
    actions.push({
      type: "RUN_HEALTH_REPORT",
      title: "Lam moi Health Report",
      reason: "Cap nhat lai health report de co snapshot moi nhat.",
      payload: {},
      requiresApproval: false
    });
  }

  return actions.slice(0, 5);
}

function buildDeterministicAnswer(input: {
  intent: CopilotIntent;
  planner: CopilotActionPlanner;
  insights: CopilotBusinessInsight[];
  missingData: string[];
  results: ToolExecutionResult[];
  clarificationQuestion?: string;
}): string {
  if (input.intent === "GENERAL_HELP" && input.clarificationQuestion) {
    return [
      "Ket luan ngan",
      "Toi chua co du co so de ket luan dung intent cho yeu cau nay.",
      "",
      "Bang chung",
      "- Message hien tai chua ro ban muon xem health shop, review, ton kho hay toi uu SKU cu the.",
      "",
      "Y nghia kinh doanh",
      "Neu chon dung intent ngay tu dau, toi se lay dung tool va tra loi nhanh hon cho seller.",
      "",
      "Viec nen lam tiep theo",
      input.clarificationQuestion
    ].join("\n");
  }

  const topInsight = input.insights[0];
  const usage = input.results.find((result) => result.tool === "getUsageInfo")?.data.usage as UsageSnapshot | undefined;
  const evidenceLines = topInsight
    ? topInsight.evidence.slice(0, 3).map((item, index) => `${index + 1}. ${item}`)
    : ["1. Tool outputs hien tai chua tra ve tin hieu du manh de ket luan sau hon."];

  const nextSteps = [
    ...input.insights.slice(0, 3).map((item) => `- ${item.recommendedAction}`),
    ...input.planner.plan.slice(0, 2).map((step) => `- Buoc ${step.step}: ${step.reason}`)
  ].slice(0, 4);

  const lines = [
    "Ket luan ngan",
    topInsight
      ? `${topInsight.title}.`
      : "Toi chua co du du lieu de ket luan manh. Hay sync them du lieu hoac ket noi WB token neu chua co.",
    "",
    "Bang chung",
    ...evidenceLines,
    ...(input.missingData.length > 0 ? [`- Missing data: ${input.missingData.join(", ")}`] : []),
    "",
    "Y nghia kinh doanh",
    topInsight?.businessImpact ?? "Neu de du lieu thieu qua lau, copilot se chi dua ra khuyen nghi an toan va bao ton thay vi ket luan manh.",
    "",
    "Viec nen lam tiep theo",
    ...(nextSteps.length > 0 ? nextSteps : ["- Hoi cu the hon ve review, inventory, SKU hoac health report."]),
    ...(usage ? [`- Quota hien tai: con ${usage.remaining.reviewDrafts} review drafts va ${usage.remaining.healthReports} health reports.`] : [])
  ];

  return lines.join("\n");
}

async function buildGeminiAnswer(input: {
  intent: CopilotIntent;
  message: string;
  mode: SellerOperatingMode;
  planner: CopilotActionPlanner;
  insights: CopilotBusinessInsight[];
  missingData: string[];
  results: ToolExecutionResult[];
  clarificationQuestion?: string;
}) {
  const { env } = await import("../../config/env");

  if (env.aiProvider !== "gemini" || !env.geminiApiKey) {
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                COPILOT_SYSTEM_PROMPT,
                `Mode: ${input.mode}`,
                `Intent: ${input.intent}`,
                `User message: ${input.message}`,
                `Planner: ${JSON.stringify(input.planner)}`,
                `Insights: ${JSON.stringify(input.insights)}`,
                `Missing data: ${JSON.stringify(input.missingData)}`,
                `Tool outputs: ${JSON.stringify(input.results)}`,
                input.clarificationQuestion ? `Clarification: ${input.clarificationQuestion}` : ""
              ].filter(Boolean).join("\n\n")
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            answer: { type: "string" }
          },
          required: ["answer"]
        }
      }
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Copilot Gemini request failed", {
      status: response.status,
      body: payload
    });
    return null;
  }

  const text = (payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  }).candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();

  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as { answer?: string };
    return typeof parsed.answer === "string" ? parsed.answer : null;
  } catch {
    return null;
  }
}

function deriveActiveEntity(results: ToolExecutionResult[], intent: CopilotIntent, context: ConversationContext) {
  const productResult = results.find((result) => result.tool === "getProducts");
  const doctorResult = results.find((result) => result.tool === "runProductDoctor");
  const draftResult = results.find((result) => result.tool === "createReviewDraft");
  const firstProduct = Array.isArray(productResult?.data.products) ? productResult?.data.products[0] as Record<string, unknown> : null;

  return {
    activeProductId: typeof doctorResult?.data.productId === "string"
      ? doctorResult.data.productId
      : typeof firstProduct?.id === "string"
        ? firstProduct.id
        : context.activeProductId ?? null,
    activeSku: typeof doctorResult?.data.sku === "string"
      ? doctorResult.data.sku
      : typeof firstProduct?.wbNmId === "string"
        ? firstProduct.wbNmId
        : context.activeSku ?? null,
    activeIntent: intent,
    feedbackId: typeof draftResult?.data.feedbackId === "string" ? draftResult.data.feedbackId : context.feedbackId ?? null
  };
}

export async function listCopilotConversations(shopId: string, userId: string): Promise<CopilotConversationSummary[]> {
  const conversations = await prisma.conversation.findMany({
    where: {
      shopId,
      userId
    },
    orderBy: { updatedAt: "desc" },
    take: 20
  });

  return conversations.map((conversation) => ({
    id: conversation.id,
    shopId: conversation.shopId,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString()
  }));
}

export async function getCopilotConversation(conversationId: string, userId: string): Promise<{
  conversation: CopilotConversationSummary;
  messages: CopilotConversationMessage[];
} | null> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!conversation) {
    return null;
  }

  return {
    conversation: {
      id: conversation.id,
      shopId: conversation.shopId,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString()
    },
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role.toLowerCase() as CopilotConversationMessage["role"],
      content: message.content,
      metadataJson: message.metadataJson && typeof message.metadataJson === "object" && !Array.isArray(message.metadataJson)
        ? (message.metadataJson as Record<string, unknown>)
        : null,
      createdAt: message.createdAt.toISOString()
    }))
  };
}

export async function runCopilotChat(input: {
  shopId: string;
  userId: string;
  message: string;
  conversationId?: string;
}): Promise<CopilotChatResponse> {
  const [user, shop] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId } }),
    prisma.shop.findFirst({
      where: { id: input.shopId, userId: input.userId },
      include: {
        products: { orderBy: { updatedAt: "desc" } },
        feedbacks: { include: { product: true }, orderBy: { createdAt: "desc" }, take: 50 },
        aiReports: { orderBy: { createdAt: "desc" }, take: 3 },
        snapshots: { orderBy: { date: "desc" }, take: 7 }
      }
    })
  ]);

  if (!user || !shop) {
    throw new Error("Khong tim thay user hoac shop de mo copilot.");
  }

  let conversation = input.conversationId
    ? await prisma.conversation.findFirst({
        where: {
          id: input.conversationId,
          userId: input.userId,
          shopId: input.shopId
        }
      })
    : null;

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        shopId: input.shopId,
        userId: input.userId,
        title: createConversationTitle(input.message)
      }
    });
  }

  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      role: ConversationRole.USER,
      content: input.message
    }
  });

  const history = await prisma.conversationMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 24
  });

  const context = extractConversationContext(history);
  const mode = user.copilotMode ?? SellerOperatingMode.ASSISTANT;
  const intentResult = classifyIntent(input.message, context);
  const planner = createActionPlanner({
    intent: intentResult,
    message: input.message,
    mode,
    context
  });

  const rawCalls = dedupeToolCalls(
    planner.requiredTools.map((tool) => {
      if (tool === "getProducts" || tool === "getProductProblems" || tool === "runProductDoctor") {
        return { tool, args: { query: extractSkuQuery(input.message) ?? context.activeSku } };
      }
      if (tool === "getFeedbacks") {
        return {
          tool,
          args: {
            unansweredOnly: true,
            negativeOnly: normalizeText(input.message).includes("tieu cuc") || normalizeText(input.message).includes("negative")
          }
        };
      }
      if (tool === "createReviewDraft") {
        return { tool, args: { persist: mode !== "ASSISTANT" } };
      }
      return { tool };
    })
  );

  const results = rawCalls.length > 0
    ? await Promise.all(rawCalls.map((call) => executeToolCall({
      call,
      shop: shop as ShopContext,
      user,
      mode,
      context
    })))
    : [];

  const insightBundle = buildBusinessInsights({
    intent: planner.intent,
    shop: shop as ShopContext,
    results
  });
  const cards = buildCards({
    results,
    insights: insightBundle.insights,
    planner
  });
  const suggestedActions = buildSuggestedActions({
    intent: planner.intent,
    results,
    mode,
    insights: insightBundle.insights
  });

  const geminiAnswer = await buildGeminiAnswer({
    intent: planner.intent,
    message: input.message,
    mode,
    planner,
    insights: insightBundle.insights,
    missingData: insightBundle.missingData,
    results,
    clarificationQuestion: intentResult.clarificationQuestion
  });
  const answer = geminiAnswer ?? buildDeterministicAnswer({
    intent: planner.intent,
    planner,
    insights: insightBundle.insights,
    missingData: insightBundle.missingData,
    results,
    clarificationQuestion: intentResult.clarificationQuestion
  });

  const activeEntity = deriveActiveEntity(results, planner.intent, context);

  await prisma.conversationMessage.createMany({
    data: [
      ...results.map((result) => ({
        conversationId: conversation!.id,
        role: ConversationRole.TOOL,
        content: result.summary,
        metadataJson: toJsonSafe({
          tool: result.tool,
          data: result.data
        }) as Prisma.InputJsonValue
      })),
      {
        conversationId: conversation.id,
        role: ConversationRole.ASSISTANT,
        content: answer,
        metadataJson: toJsonSafe({
          mode,
          intent: planner.intent,
          planner,
          cards,
          insights: insightBundle.insights,
          missingData: insightBundle.missingData,
          suggestedActions,
          activeEntity,
          selectedProduct: activeEntity.activeProductId && activeEntity.activeSku
            ? {
                productId: activeEntity.activeProductId,
                sku: activeEntity.activeSku
              }
            : null
        }) as unknown as Prisma.InputJsonValue
      }
    ]
  });

  return {
    conversationId: conversation.id,
    answer,
    suggestedActions,
    cards,
    intent: planner.intent,
    planner
  };
}

export async function runTelegramCopilotCommand(input: {
  shopId: string;
  userId: string;
  command: "/health" | "/reviews" | "/inventory" | "/report";
}) {
  const commandMap: Record<"/health" | "/reviews" | "/inventory" | "/report", string> = {
    "/health": "Cho toi tinh hinh suc khoe shop hien tai.",
    "/reviews": "Co review nao chua tra loi khong?",
    "/inventory": "SKU nao sap het hang?",
    "/report": "Tai sao don hang giam?"
  };

  return runCopilotChat({
    shopId: input.shopId,
    userId: input.userId,
    message: commandMap[input.command]
  });
}

export const __copilotTestUtils = {
  classifyIntent,
  createActionPlanner,
  buildDeterministicAnswer,
  extractConversationContext
};
