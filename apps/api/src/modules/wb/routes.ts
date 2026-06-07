import { ActionType, ActionStatus, type Shop } from "@prisma/client";
import { Router } from "express";
import { toggleLiveTestSchema } from "@wb/shared";
import { WbClient } from "@wb/wb-client";
import { prisma } from "../../database/prisma";
import { requireAuth, type AuthenticatedRequest } from "../../common/auth";
import { env } from "../../config/env";
import { decrypt } from "../../common/crypto";
import { buildLiveTestChecklist } from "../../common/liveTest";
import { getUsageSnapshot } from "../../common/usage";
import { createAuditLog } from "../../common/audit";
import { persistAnalyticsSnapshot, persistFeedbacks, persistProducts } from "./service";

export const wbRouter = Router();

wbRouter.use(requireAuth);

async function getShopForUser(shopId: string, userId: string) {
  return prisma.shop.findFirst({
    where: {
      id: shopId,
      userId
    }
  });
}

async function getClient(shop: Shop) {
  return new WbClient({
    token: decrypt(shop.encryptedWbToken, env.encryptionKey),
    mock: !env.enableRealWbApi,
    enableRealApi: env.enableRealWbApi,
    writeDryRun: env.wbWriteDryRun
  });
}

async function getChecklistPayload(shopId: string, userId: string) {
  const shop = await getShopForUser(shopId, userId);
  if (!shop) {
    return null;
  }

  const feedback = await prisma.feedback.findFirst({
    where: {
      shopId,
      status: { not: "SENT" }
    },
    orderBy: { createdAt: "desc" }
  });

  const action = await prisma.action.findFirst({
    where: {
      shopId,
      type: ActionType.REPLY_REVIEW,
      status: { in: [ActionStatus.APPROVED, ActionStatus.EXECUTED, ActionStatus.EXECUTED_DRY_RUN] }
    },
    orderBy: { createdAt: "desc" }
  });

  const usage = await getUsageSnapshot(userId);
  const checklist = buildLiveTestChecklist({
    shop,
    plan: usage.plan,
    feedback,
    action,
    replyReviewed: Boolean(action?.status === ActionStatus.APPROVED),
    confirmReplySend: true,
    auditLoggingEnabled: true
  });

  return {
    shop,
    action,
    feedback,
    usage,
    checklist
  };
}

wbRouter.post("/:shopId/sync/products", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.shopId);
  const shop = await getShopForUser(shopId, req.user!.id);
  if (!shop) {
    return res.status(404).json({ message: "Shop not found" });
  }

  const client = await getClient(shop);
  const products = await client.withRateLimit(() => client.products.list());
  const stocks = await client.withRateLimit(() => client.stocks.list());
  const savedProducts = await persistProducts(shopId, products, stocks);
  return res.json({ mode: client.getMode(), products, stocks, savedProducts });
});

wbRouter.post("/:shopId/sync/feedbacks", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.shopId);
  const shop = await getShopForUser(shopId, req.user!.id);
  if (!shop) {
    return res.status(404).json({ message: "Shop not found" });
  }

  const client = await getClient(shop);
  const feedbacks = await client.withRateLimit(() => client.feedbacks.list());
  const savedFeedbacks = await persistFeedbacks(shopId, feedbacks);
  return res.json({ mode: client.getMode(), feedbacks, savedFeedbacks });
});

wbRouter.post("/:shopId/sync/analytics", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.shopId);
  const shop = await getShopForUser(shopId, req.user!.id);
  if (!shop) {
    return res.status(404).json({ message: "Shop not found" });
  }

  const client = await getClient(shop);
  try {
    const analytics = await client.withRateLimit(() => client.analytics.salesFunnel());
    const snapshot = await persistAnalyticsSnapshot(shopId, analytics as unknown as Record<string, unknown>);
    return res.json({ mode: client.getMode(), analytics, snapshot });
  } catch (error) {
    const fallbackClient = new WbClient({
      token: "mock-fallback",
      mock: true,
      enableRealApi: false
    });
    const analytics = await fallbackClient.analytics.salesFunnel();
    const snapshot = await persistAnalyticsSnapshot(shopId, analytics as unknown as Record<string, unknown>);
    return res.json({
      mode: "mock",
      analytics,
      snapshot,
      warning: client.normalizeError(error).message
    });
  }
});

wbRouter.get("/:shopId/status", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.shopId);
  const shop = await getShopForUser(shopId, req.user!.id);
  if (!shop) {
    return res.status(404).json({ message: "Shop not found" });
  }

  const client = await getClient(shop);
  const connection = await client.testConnection().catch((error) => ({
    seller: undefined,
    scopes: [],
    capabilities: [],
    errors: [client.normalizeError(error).message]
  }));

  return res.json({
    shopId,
    mode: client.getMode(),
    writeMode: client.getWriteMode(),
    canWrite: client.getWriteMode() === "real_write",
    approvalRequired: true,
    allowRealReplyTest: shop.allowRealReplyTest,
    connection
  });
});

wbRouter.get("/:shopId/live-test-checklist", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.shopId);
  const payload = await getChecklistPayload(shopId, req.user!.id);
  if (!payload) {
    return res.status(404).json({ message: "Shop not found" });
  }

  return res.json({
    shopId: payload.shop.id,
    allowRealReplyTest: payload.shop.allowRealReplyTest,
    checklist: payload.checklist,
    preview: {
      feedbackId: payload.feedback?.id ?? null,
      actionId: payload.action?.id ?? null,
      userPlan: payload.usage.plan
    }
  });
});

wbRouter.post("/:shopId/live-test-allow", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.shopId);
  const parsed = toggleLiveTestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const payload = await getChecklistPayload(shopId, req.user!.id);
  if (!payload) {
    return res.status(404).json({ message: "Shop not found" });
  }

  if (parsed.data.enabled && !payload.checklist.allPassed) {
    return res.status(400).json({
      message: "Live Test Safety Checklist chua dat day du. Chua the mo real review reply test.",
      checklist: payload.checklist
    });
  }

  const shop = await prisma.shop.update({
    where: { id: payload.shop.id },
    data: {
      allowRealReplyTest: parsed.data.enabled
    }
  });

  await createAuditLog({
    userId: req.user!.id,
    shopId: shop.id,
    action: parsed.data.enabled ? "ENABLE_REAL_REPLY_TEST" : "DISABLE_REAL_REPLY_TEST",
    entityType: "Shop",
    entityId: shop.id,
    metadataJson: {
      enabled: parsed.data.enabled
    }
  });

  return res.json({
    ok: true,
    allowRealReplyTest: shop.allowRealReplyTest,
    checklist: payload.checklist
  });
});
