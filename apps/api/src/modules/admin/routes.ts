import { Router } from "express";
import { ShopStatus } from "@prisma/client";
import { updateUserPlanSchema } from "@wb/shared";
import { prisma } from "../../database/prisma";
import { requireAuth, type AuthenticatedRequest } from "../../common/auth";
import { requireAdmin } from "../../common/permissions";
import { createAuditLog } from "../../common/audit";
import { getUsageSnapshot, resetUsage } from "../../common/usage";

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);

adminRouter.get("/overview", async (_req: AuthenticatedRequest, res) => {
  const [users, shops, latestReports, latestActions, failedActions, auditLogs] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        shops: {
          orderBy: { createdAt: "desc" },
          include: {
            actions: { orderBy: { createdAt: "desc" }, take: 3 },
            aiReports: { orderBy: { createdAt: "desc" }, take: 1 }
          }
        }
      }
    }),
    prisma.shop.findMany({
      orderBy: { createdAt: "desc" }
    }),
    prisma.aiReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { shop: true }
    }),
    prisma.action.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { shop: true, approvedByUser: true }
    }),
    prisma.action.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { shop: true }
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: true, shop: true }
    })
  ]);

  const usageByUser = await Promise.all(users.map(async (user) => [user.id, await getUsageSnapshot(user.id)] as const));

  return res.json({
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
      createdAt: user.createdAt,
      usage: Object.fromEntries(usageByUser)[user.id],
      shops: user.shops.map((shop) => ({
        id: shop.id,
        name: shop.name,
        status: shop.status,
        allowRealReplyTest: shop.allowRealReplyTest,
        tokenConnected: Boolean(shop.encryptedWbToken),
        tokenScopes: shop.tokenScopes,
        latestAction: shop.actions[0] ?? null,
        latestReport: shop.aiReports[0] ?? null
      }))
    })),
    shops: shops.map((shop) => ({
      id: shop.id,
      name: shop.name,
      userId: shop.userId,
      status: shop.status,
      allowRealReplyTest: shop.allowRealReplyTest,
      tokenConnected: Boolean(shop.encryptedWbToken),
      tokenScopes: shop.tokenScopes
    })),
    latestReports,
    latestActions,
    failedActions,
    auditLogs
  });
});

adminRouter.post("/users/:userId/plan", async (req: AuthenticatedRequest, res) => {
  const parsed = updateUserPlanSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const user = await prisma.user.update({
    where: { id: String(req.params.userId) },
    data: { plan: parsed.data.plan }
  });

  await createAuditLog({
    userId: req.user!.id,
    action: "ADMIN_UPDATE_USER_PLAN",
    entityType: "User",
    entityId: user.id,
    metadataJson: {
      nextPlan: user.plan
    }
  });

  return res.json({ ok: true, user });
});

adminRouter.post("/users/:userId/reset-usage", async (req: AuthenticatedRequest, res) => {
  const user = await resetUsage(String(req.params.userId));

  await createAuditLog({
    userId: req.user!.id,
    action: "ADMIN_RESET_USAGE",
    entityType: "User",
    entityId: user.id,
    metadataJson: {
      resetAt: user.usageResetAt.toISOString()
    }
  });

  return res.json({ ok: true, user });
});

adminRouter.post("/shops/:shopId/disable", async (req: AuthenticatedRequest, res) => {
  const shop = await prisma.shop.update({
    where: { id: String(req.params.shopId) },
    data: {
      status: ShopStatus.DISCONNECTED,
      allowRealReplyTest: false
    }
  });

  await createAuditLog({
    userId: req.user!.id,
    shopId: shop.id,
    action: "ADMIN_DISABLE_SHOP",
    entityType: "Shop",
    entityId: shop.id,
    metadataJson: {
      status: shop.status
    }
  });

  return res.json({ ok: true, shop });
});

adminRouter.get("/audit-logs", async (_req: AuthenticatedRequest, res) => {
  const auditLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, shop: true }
  });

  return res.json({ auditLogs });
});
