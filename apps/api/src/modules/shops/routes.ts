import { ShopStatus } from "@prisma/client";
import { Router } from "express";
import { connectShopSchema, testWbTokenSchema, updateShopSchema } from "@wb/shared";
import { prisma } from "../../database/prisma";
import { requireAuth, type AuthenticatedRequest } from "../../common/auth";
import { encrypt } from "../../common/crypto";
import { env } from "../../config/env";
import { createAuditLog } from "../../common/audit";
import { WbClient } from "@wb/wb-client";
import { assertShopQuota } from "../../common/usage";

export const shopsRouter = Router();

shopsRouter.use(requireAuth);

async function runTokenConnectionTest(req: AuthenticatedRequest, res: {
  status(code: number): { json(payload: unknown): unknown };
  json(payload: unknown): unknown;
}) {
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
}

shopsRouter.post("/test-connection", async (req: AuthenticatedRequest, res) => runTokenConnectionTest(req, res));
shopsRouter.post("/test-token", async (req: AuthenticatedRequest, res) => runTokenConnectionTest(req, res));

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

  const duplicateShop = connection.seller?.sid
    ? await prisma.shop.findFirst({
        where: {
          userId: req.user!.id,
          wbSellerId: connection.seller.sid,
          ...(parsed.data.shopId ? { id: { not: parsed.data.shopId } } : {})
        }
      })
    : null;

  const targetShopId = parsed.data.shopId ?? duplicateShop?.id;

  if (!targetShopId) {
    try {
      await assertShopQuota(req.user!.id);
    } catch (error) {
      return res.status(403).json({
        message: error instanceof Error ? error.message : "Khong the them shop moi luc nay."
      });
    }
  }

  const shop = targetShopId
    ? await prisma.shop.update({
        where: { id: targetShopId },
        data: {
          name: parsed.data.name,
          wbSellerId: connection.seller?.sid ?? parsed.data.wbSellerId,
          encryptedWbToken: encryptedToken,
          tokenScopes: mergedScopes,
          status: ShopStatus.ACTIVE
        }
      })
    : await prisma.shop.create({
        data: {
          userId: req.user!.id,
          name: parsed.data.name,
          wbSellerId: connection.seller?.sid ?? parsed.data.wbSellerId,
          encryptedWbToken: encryptedToken,
          tokenScopes: mergedScopes,
          status: ShopStatus.ACTIVE
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

  return res.status(targetShopId ? 200 : 201).json({
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

shopsRouter.patch("/:id", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.id);
  const parsed = updateShopSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const existing = await prisma.shop.findFirst({
    where: { id: shopId, userId: req.user!.id }
  });

  if (!existing) {
    return res.status(404).json({ message: "Shop not found" });
  }

  const shop = await prisma.shop.update({
    where: { id: shopId },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {})
    }
  });

  await createAuditLog({
    userId: req.user!.id,
    shopId: shop.id,
    action: "UPDATE_SHOP_SETTINGS",
    entityType: "Shop",
    entityId: shop.id,
    metadataJson: {
      changed: parsed.data
    }
  });

  return res.json({ shop });
});

shopsRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.id);
  const existing = await prisma.shop.findFirst({
    where: { id: shopId, userId: req.user!.id }
  });

  if (!existing) {
    return res.status(404).json({ message: "Shop not found" });
  }

  const shop = await prisma.shop.update({
    where: { id: shopId },
    data: {
      status: ShopStatus.DISCONNECTED,
      tokenScopes: [],
      encryptedWbToken: encrypt("disconnected-shop-token", env.encryptionKey)
    }
  });

  await createAuditLog({
    userId: req.user!.id,
    shopId: shop.id,
    action: "DISCONNECT_SHOP",
    entityType: "Shop",
    entityId: shop.id,
    metadataJson: {
      previousStatus: existing.status
    }
  });

  return res.json({
    ok: true,
    shop
  });
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
