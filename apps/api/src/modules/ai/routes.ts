import { Router } from "express";
import { ActionType, FeedbackStatus, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { requireAuth } from "../../common/auth";
import { getAiProvider } from "./provider";

export const aiRouter = Router();
const aiProvider = getAiProvider();

aiRouter.use(requireAuth);

aiRouter.post("/:shopId/health-report", async (req, res) => {
  const shop = await prisma.shop.findUnique({
    where: { id: req.params.shopId },
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
  const report = await aiProvider.generateShopHealthReport({
    shop,
    kpis: latestSnapshot ?? {},
    products: shop.products,
    feedbacks: shop.feedbacks,
    analytics,
    inventory: { lowStockCount: shop.products.filter((item) => item.stock < 15).length },
    competitors: []
  });

  const savedReport = await prisma.aiReport.create({
    data: {
      shopId: shop.id,
      healthScore: report.healthScore,
      summary: report.summary,
      risksJson: report.risks as Prisma.InputJsonValue,
      opportunitiesJson: report.opportunities as Prisma.InputJsonValue,
      actionsJson: report.recommendedActions as unknown as Prisma.InputJsonValue
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

  return res.json({ report: savedReport, analysis: report });
});

aiRouter.post("/:shopId/review-reply-draft", async (req, res) => {
  const feedback = await prisma.feedback.findFirst({
    where: { shopId: req.params.shopId },
    include: { product: true }
  });

  if (!feedback || !feedback.product) {
    return res.status(404).json({ message: "Feedback not found" });
  }

  const result = await aiProvider.generateReviewReply({
    reviewText: feedback.text,
    rating: feedback.rating,
    productTitle: feedback.product.title
  });

  const updated = await prisma.feedback.update({
    where: { id: feedback.id },
    data: {
      aiReplyDraft: result.reply,
      status: FeedbackStatus.DRAFTED
    }
  });

  return res.json({ feedback: updated, draft: result });
});

aiRouter.post("/:shopId/product-doctor", async (req, res) => {
  const product = await prisma.product.findFirst({ where: { shopId: req.params.shopId } });

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const result = await aiProvider.generateProductDoctor({
    title: product.title,
    category: product.category,
    price: product.price,
    stock: product.stock,
    rating: product.rating
  });

  return res.json({ product, diagnosis: result });
});
