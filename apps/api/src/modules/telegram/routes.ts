import { Router } from "express";
import { TelegramStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { requireAuth, type AuthenticatedRequest } from "../../common/auth";
import { createAuditLog } from "../../common/audit";

export const telegramRouter = Router();

telegramRouter.use(requireAuth);

telegramRouter.post("/:shopId/connect", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.shopId);
  const chatId = String(req.body.chatId ?? "@wb_demo_alerts");

  const integration = await prisma.telegramIntegration.create({
    data: {
      shopId,
      chatId,
      status: TelegramStatus.CONNECTED
    }
  });

  await createAuditLog({
    userId: req.user?.id,
    shopId,
    action: "CONNECT_TELEGRAM",
    entityType: "TelegramIntegration",
    entityId: integration.id
  });

  return res.status(201).json({
    integration,
    placeholder: true
  });
});

telegramRouter.post("/:shopId/test-alert", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.shopId);
  await createAuditLog({
    userId: req.user?.id,
    shopId,
    action: "TEST_TELEGRAM_ALERT",
    entityType: "Shop",
    entityId: shopId
  });

  return res.json({
    sent: true,
    placeholder: true,
    message: "Da mo phong gui Telegram alert"
  });
});
