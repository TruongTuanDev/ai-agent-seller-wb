import { Router } from "express";
import { WbClient } from "@wb/wb-client";
import { prisma } from "../../database/prisma";
import { requireAuth } from "../../common/auth";
import { env } from "../../config/env";
import { decrypt } from "../../common/crypto";
import { persistAnalyticsSnapshot, persistFeedbacks, persistProducts } from "./service";

export const wbRouter = Router();

wbRouter.use(requireAuth);

async function getClient(shopId: string) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });

  if (!shop) {
    throw new Error("Shop not found");
  }

  return new WbClient({
    token: decrypt(shop.encryptedWbToken, env.encryptionKey),
    mock: !env.enableRealWbApi,
    enableRealApi: env.enableRealWbApi
  });
}

wbRouter.post("/:shopId/sync/products", async (req, res) => {
  const client = await getClient(req.params.shopId);
  const products = await client.withRateLimit(() => client.products.list());
  const stocks = await client.withRateLimit(() => client.stocks.list());
  const savedProducts = await persistProducts(req.params.shopId, products, stocks);
  return res.json({ mode: client.getMode(), products, stocks, savedProducts });
});

wbRouter.post("/:shopId/sync/feedbacks", async (req, res) => {
  const client = await getClient(req.params.shopId);
  const feedbacks = await client.withRateLimit(() => client.feedbacks.list());
  const savedFeedbacks = await persistFeedbacks(req.params.shopId, feedbacks);
  return res.json({ mode: client.getMode(), feedbacks, savedFeedbacks });
});

wbRouter.post("/:shopId/sync/analytics", async (req, res) => {
  const client = await getClient(req.params.shopId);
  try {
    const analytics = await client.withRateLimit(() => client.analytics.salesFunnel());
    const snapshot = await persistAnalyticsSnapshot(req.params.shopId, analytics as unknown as Record<string, unknown>);
    return res.json({ mode: client.getMode(), analytics, snapshot });
  } catch (error) {
    const fallbackClient = new WbClient({
      token: "mock-fallback",
      mock: true,
      enableRealApi: false
    });
    const analytics = await fallbackClient.analytics.salesFunnel();
    const snapshot = await persistAnalyticsSnapshot(req.params.shopId, analytics as unknown as Record<string, unknown>);
    return res.json({
      mode: "mock",
      analytics,
      snapshot,
      warning: client.normalizeError(error).message
    });
  }
});

wbRouter.get("/:shopId/status", async (req, res) => {
  const client = await getClient(req.params.shopId);
  const connection = await client.testConnection().catch((error) => ({
    seller: undefined,
    scopes: [],
    capabilities: [],
    errors: [client.normalizeError(error).message]
  }));

  return res.json({
    shopId: req.params.shopId,
    mode: client.getMode(),
    canWrite: false,
    approvalRequired: true,
    connection
  });
});
