import { TelegramStatus } from "@prisma/client";
import { Router } from "express";
import { telegramConnectSchema, telegramCopilotCommandSchema } from "@wb/shared";
import { prisma } from "../../database/prisma";
import { requireAuth, type AuthenticatedRequest } from "../../common/auth";
import { createAuditLog } from "../../common/audit";
import { runTelegramCopilotCommand } from "../copilot/service";
import { createDailyHealthSummary, getTelegramMode, sendDailyHealthSummary, sendTelegramMessage } from "./service";

export const telegramRouter = Router();

telegramRouter.use(requireAuth);

telegramRouter.get("/:shopId/status", async (req, res) => {
  const integration = await prisma.telegramIntegration.findFirst({
    where: { shopId: String(req.params.shopId) },
    orderBy: { createdAt: "desc" }
  });

  return res.json({
    integration,
    mode: getTelegramMode()
  });
});

telegramRouter.post("/:shopId/connect", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.shopId);
  const parsed = telegramConnectSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const existing = await prisma.telegramIntegration.findFirst({
    where: { shopId },
    orderBy: { createdAt: "desc" }
  });

  const integration = existing
    ? await prisma.telegramIntegration.update({
        where: { id: existing.id },
        data: {
          chatId: parsed.data.chatId,
          dailyAlertsEnabled: parsed.data.dailyAlertsEnabled,
          alertHour: parsed.data.alertHour,
          status: TelegramStatus.CONNECTED
        }
      })
    : await prisma.telegramIntegration.create({
        data: {
          shopId,
          chatId: parsed.data.chatId,
          dailyAlertsEnabled: parsed.data.dailyAlertsEnabled,
          alertHour: parsed.data.alertHour,
          status: TelegramStatus.CONNECTED
        }
      });

  await createAuditLog({
    userId: req.user?.id,
    shopId,
    action: "CONNECT_TELEGRAM",
    entityType: "TelegramIntegration",
    entityId: integration.id,
    metadataJson: {
      dailyAlertsEnabled: integration.dailyAlertsEnabled,
      alertHour: integration.alertHour
    }
  });

  return res.status(201).json({
    integration,
    mode: getTelegramMode()
  });
});

telegramRouter.post("/:shopId/test-alert", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.shopId);
  const integration = await prisma.telegramIntegration.findFirst({
    where: { shopId },
    orderBy: { createdAt: "desc" }
  });

  if (!integration) {
    return res.status(404).json({ message: "Shop chua ket noi Telegram." });
  }

  try {
    const summary = await createDailyHealthSummary(shopId);
    const result = await sendTelegramMessage(integration.chatId, summary.message);

    await createAuditLog({
      userId: req.user?.id,
      shopId,
      action: "TEST_TELEGRAM_ALERT",
      entityType: "TelegramIntegration",
      entityId: integration.id,
      metadataJson: {
        mode: result.mode
      }
    });

    return res.json({
      sent: true,
      mode: result.mode,
      summary,
      message: result.mode === "mock" ? "Da mo phong gui Telegram alert." : "Da gui Telegram alert thanh cong."
    });
  } catch (error) {
    return res.status(400).json({
      sent: false,
      message: error instanceof Error ? error.message : "Khong the gui Telegram alert."
    });
  }
});

telegramRouter.post("/:shopId/daily-summary", async (req: AuthenticatedRequest, res) => {
  try {
    const result = await sendDailyHealthSummary(String(req.params.shopId), req.user?.id);
    return res.json({
      sent: true,
      mode: result.result.mode,
      summary: result.summary
    });
  } catch (error) {
    return res.status(400).json({
      sent: false,
      message: error instanceof Error ? error.message : "Khong the gui daily summary."
    });
  }
});

telegramRouter.post("/:shopId/copilot-command", async (req: AuthenticatedRequest, res) => {
  const parsed = telegramCopilotCommandSchema.safeParse({
    shopId: String(req.params.shopId),
    command: req.body?.command
  });

  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  try {
    const result = await runTelegramCopilotCommand({
      shopId: parsed.data.shopId,
      userId: req.user!.id,
      command: parsed.data.command
    });

    return res.json(result);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Khong the chay Telegram Copilot command."
    });
  }
});
