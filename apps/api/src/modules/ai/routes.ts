import { ActionType, FeedbackStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import { reviewDraftSchema } from "@wb/shared";
import { prisma } from "../../database/prisma";
import { requireAuth, type AuthenticatedRequest } from "../../common/auth";
import { assertUsageAvailable, incrementUsage } from "../../common/usage";
import { analyzeProductProblems, getProductReviewWarnings } from "../products/service";
import { getAiProvider } from "./provider";

export const aiRouter = Router();
const aiProvider = getAiProvider();

aiRouter.use(requireAuth);

aiRouter.post("/:shopId/health-report", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.shopId);

  try {
    await assertUsageAvailable(req.user!.id, "healthReport");
  } catch (error) {
    return res.status(403).json({ message: error instanceof Error ? error.message : "Vuot quota health report." });
  }

  const shop = await prisma.shop.findFirst({
    where: { id: shopId, userId: req.user!.id },
    include: {
      products: true,
      feedbacks: true,
      snapshots: { orderBy: { date: "desc" }, take: 7 }
    }
  });

  if (!shop) {
    return res.status(404).json({ message: "Shop not found" });
  }

  const latestSnapshot = shop.snapshots[0];
  const analytics = (latestSnapshot?.rawJson ?? {}) as Prisma.JsonObject;
  const productProblems = analyzeProductProblems(shop.products, shop.feedbacks);
  const report = await aiProvider.generateShopHealthReport({
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
    analytics,
    inventory: { lowStockCount: shop.products.filter((item) => item.stock < 15).length },
    competitors: [],
    productProblems
  });

  const savedReport = await prisma.aiReport.create({
    data: {
      shopId: shop.id,
      healthScore: report.healthScore,
      summary: report.executiveSummary,
      risksJson: report.criticalIssues as unknown as Prisma.InputJsonValue,
      opportunitiesJson: report.growthOpportunities as unknown as Prisma.InputJsonValue,
      actionsJson: report.recommendedActions as unknown as Prisma.InputJsonValue,
      detailsJson: report as unknown as Prisma.InputJsonValue
    }
  });

  if (report.recommendedActions.length > 0) {
    await prisma.action.createMany({
      data: report.recommendedActions.map((action) => ({
        shopId: shop.id,
        type: action.type as ActionType,
        title: action.title,
        payloadJson: action.payload as Prisma.InputJsonValue,
        createdByAiReportId: savedReport.id
      }))
    });
  }

  await incrementUsage(req.user!.id, "healthReport");

  return res.json({ report: savedReport, analysis: report });
});

aiRouter.post("/:shopId/review-reply-draft", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.shopId);
  const parsed = reviewDraftSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  try {
    await assertUsageAvailable(req.user!.id, "reviewDraft");
  } catch (error) {
    return res.status(403).json({ message: error instanceof Error ? error.message : "Vuot quota AI review draft." });
  }

  const feedback = await prisma.feedback.findFirst({
    where: {
      shopId,
      ...(parsed.data.feedbackId ? { id: parsed.data.feedbackId } : { status: FeedbackStatus.NEW })
    },
    include: { product: true },
    orderBy: { createdAt: "desc" }
  });

  if (!feedback || !feedback.product) {
    return res.status(404).json({ message: "Khong tim thay review phu hop de tao draft." });
  }

  const result = await aiProvider.generateReviewReply({
    reviewText: feedback.text,
    rating: feedback.rating,
    productTitle: feedback.product.title,
    tone: parsed.data.tone,
    allowRefundPromise: parsed.data.allowRefundPromise
  });

  const updated = await prisma.feedback.update({
    where: { id: feedback.id },
    data: {
      aiReplyDraft: result.reply,
      status: FeedbackStatus.DRAFTED
    }
  });

  const existingAction = await prisma.action.findFirst({
    where: {
      shopId: feedback.shopId,
      type: ActionType.REPLY_REVIEW,
      status: { in: ["PENDING", "APPROVED", "NEEDS_CONFIRMATION"] },
      payloadJson: {
        path: ["feedbackId"],
        equals: feedback.id
      }
    }
  });

  const actionPayload = {
    feedbackId: feedback.id,
    wbFeedbackId: feedback.wbFeedbackId,
    productId: feedback.productId,
    replyText: result.reply,
    draftReply: result.reply,
    tone: result.tone
  };

  const action = existingAction
    ? await prisma.action.update({
        where: { id: existingAction.id },
        data: {
          title: `Gui reply review cho ${feedback.product.title}`,
          payloadJson: actionPayload as Prisma.InputJsonValue
        }
      })
    : await prisma.action.create({
        data: {
          shopId: feedback.shopId,
          type: ActionType.REPLY_REVIEW,
          title: `Gui reply review cho ${feedback.product.title}`,
          payloadJson: actionPayload as Prisma.InputJsonValue
        }
      });

  await incrementUsage(req.user!.id, "reviewDraft");

  return res.json({ feedback: updated, draft: result, action });
});

aiRouter.post("/:shopId/product-doctor", async (req, res) => {
  const shopId = String(req.params.shopId);
  const product = await prisma.product.findFirst({
    where: { shopId },
    include: { feedbacks: { orderBy: { createdAt: "desc" }, take: 12 } }
  });

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const result = await aiProvider.generateProductDoctor({
    title: product.title,
    description: product.description ?? undefined,
    category: product.category,
    price: product.price,
    stock: product.stock,
    rating: product.rating,
    attributes: (product.attributesJson as Record<string, unknown> | null) ?? undefined,
    reviewSnippets: product.feedbacks.slice(0, 6).map((feedback) => feedback.text)
  });

  return res.json({
    product,
    diagnosis: {
      ...result,
      warnings: result.warnings.length > 0 ? result.warnings : getProductReviewWarnings(product.feedbacks)
    }
  });
});
