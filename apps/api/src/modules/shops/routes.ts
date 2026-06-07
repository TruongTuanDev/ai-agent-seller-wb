import { Router } from "express";
import { connectShopSchema, testWbTokenSchema } from "@wb/shared";
import { prisma } from "../../database/prisma";
import { requireAuth, type AuthenticatedRequest } from "../../common/auth";
import { encrypt } from "../../common/crypto";
import { env } from "../../config/env";
import { createAuditLog } from "../../common/audit";
import { WbClient } from "@wb/wb-client";
import { assertShopQuota } from "../../common/usage";

export const shopsRouter = Router();

shopsRouter.use(requireAuth);

shopsRouter.post("/test-connection", async (req: AuthenticatedRequest, res) => {
  const parsed = testWbTokenSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const client = new WbClient({
    token: parsed.data.token,
    mock: !env.enableRealWbApi,
    enableRealApi: env.enableRealWbApi,
    writeDryRun: env.wbWriteDryRun
  });

  try {
    const connection = await client.testConnection();
    return res.json({
      ok: true,
      mode: client.getMode(),
      seller: connection.seller,
      scopes: connection.scopes,
      capabilities: connection.capabilities,
      errors: connection.errors
    });
  } catch (error) {
    const normalized = client.normalizeError(error);
    return res.status(400).json({
      ok: false,
      mode: client.getMode(),
      scopes: [],
      capabilities: [],
      errors: [normalized.message || "Khong the ket noi Wildberries API"]
    });
  }
});

shopsRouter.post("/connect-token", async (req: AuthenticatedRequest, res) => {
  const parsed = connectShopSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const client = new WbClient({
    token: parsed.data.token,
    mock: !env.enableRealWbApi,
    enableRealApi: env.enableRealWbApi,
    writeDryRun: env.wbWriteDryRun
  });

  const connection = await client.testConnection().catch((error) => {
    const normalized = client.normalizeError(error);
    return {
      seller: undefined,
      scopes: parsed.data.tokenScopes,
      capabilities: [],
      errors: [normalized.message]
    };
  });

  if (env.enableRealWbApi && connection.errors.length > 0 && !connection.seller) {
    return res.status(400).json({
      message: "Token Wildberries khong hop le hoac khong du quyen doc du lieu.",
      errors: connection.errors
    });
  }

  const encryptedToken = encrypt(parsed.data.token, env.encryptionKey);
  const mergedScopes = Array.from(new Set([...parsed.data.tokenScopes, ...connection.scopes]));

  if (!parsed.data.shopId) {
    try {
      await assertShopQuota(req.user!.id);
    } catch (error) {
      return res.status(403).json({
        message: error instanceof Error ? error.message : "Khong the them shop moi luc nay."
      });
    }
  }

  const shop = parsed.data.shopId
    ? await prisma.shop.update({
        where: { id: parsed.data.shopId },
        data: {
          name: parsed.data.name,
          wbSellerId: connection.seller?.sid ?? parsed.data.wbSellerId,
          encryptedWbToken: encryptedToken,
          tokenScopes: mergedScopes
        }
      })
    : await prisma.shop.create({
        data: {
          userId: req.user!.id,
          name: parsed.data.name,
          wbSellerId: connection.seller?.sid ?? parsed.data.wbSellerId,
          encryptedWbToken: encryptedToken,
          tokenScopes: mergedScopes
        }
      });

  await createAuditLog({
    userId: req.user!.id,
    shopId: shop.id,
    action: "CONNECT_WB_TOKEN",
    entityType: "Shop",
    entityId: shop.id,
    metadataJson: {
      scopes: connection.scopes,
      mode: client.getMode()
    }
  });

  return res.status(201).json({
    shop,
    connection: {
      ok: Boolean(connection.seller) || client.getMode() === "mock",
      mode: client.getMode(),
      seller: connection.seller,
      scopes: connection.scopes,
      capabilities: connection.capabilities,
      errors: connection.errors
    }
  });
});

shopsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const shops = await prisma.shop.findMany({
    where: { userId: req.user!.id },
    include: {
      products: true,
      aiReports: { orderBy: { createdAt: "desc" }, take: 1 },
      telegramIntegrations: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  return res.json({ shops });
});

shopsRouter.get("/:id", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.id);
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, userId: req.user!.id },
    include: {
      products: true,
      feedbacks: { orderBy: { createdAt: "desc" }, take: 50, include: { product: true } },
      aiReports: { orderBy: { createdAt: "desc" }, take: 5 },
      actions: { orderBy: { createdAt: "desc" }, take: 50 },
      snapshots: { orderBy: { date: "desc" }, take: 7 },
      telegramIntegrations: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  if (!shop) {
    return res.status(404).json({ message: "Shop not found" });
  }

  return res.json({ shop });
});
