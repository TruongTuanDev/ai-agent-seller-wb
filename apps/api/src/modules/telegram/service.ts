import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { env } from "../../config/env";
import { createAuditLog } from "../../common/audit";
import { analyzeProductProblems, formatTelegramSummary } from "../products/service";

function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getTelegramMode() {
  return env.telegramBotToken ? "real" : "mock";
}

export async function sendTelegramMessage(chatId: string, text: string) {
  if (!env.telegramBotToken) {
    return {
      sent: true,
      mode: "mock" as const,
      message: "Mock Telegram send completed.",
      preview: text
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Telegram send failed", {
      status: response.status,
      body: payload
    });
    throw new Error("Khong the gui thong bao Telegram luc nay.");
  }

  return {
    sent: true,
    mode: "real" as const,
    message: "Telegram sent",
    payload
  };
}

export async function createDailyHealthSummary(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      products: true,
      feedbacks: true,
      aiReports: { orderBy: { createdAt: "desc" }, take: 1 },
      snapshots: { orderBy: { date: "desc" }, take: 1 }
    }
  });

  if (!shop) {
    throw new Error("Shop not found");
  }

  const latestReport = shop.aiReports[0];
  const details = latestReport?.detailsJson && typeof latestReport.detailsJson === "object"
    ? (latestReport.detailsJson as Record<string, unknown>)
    : null;
  const problems = analyzeProductProblems(shop.products, shop.feedbacks);
  const pendingReviewCount = shop.feedbacks.filter((feedback) => feedback.status !== "REPLIED").length;
  const suggestedLines = Array.isArray(details?.growthOpportunities)
    ? (details.growthOpportunities as Array<Record<string, unknown>>).map((item) => String(item.action ?? item.title ?? "Theo doi shop sat hon"))
    : [
        "Tra loi review ton dong",
        "Bo sung ton kho SKU uu tien",
        "Toi uu title va mo ta san pham"
      ];
  const conversionTrend = String(
    details?.kpiSummary && typeof details.kpiSummary === "object"
      ? (details.kpiSummary as Record<string, unknown>).conversionTrend ?? ""
      : ""
  );

  return formatTelegramSummary({
    healthScore: latestReport?.healthScore ?? 72,
    topProblems: problems,
    pendingReviewCount,
    conversionTrend,
    growthActions: suggestedLines
  });
}

export async function sendDailyHealthSummary(shopId: string, userId?: string) {
  const integration = await prisma.telegramIntegration.findFirst({
    where: { shopId },
    orderBy: { createdAt: "desc" }
  });

  if (!integration) {
    throw new Error("Shop chua ket noi Telegram.");
  }

  const summary = await createDailyHealthSummary(shopId);
  const result = await sendTelegramMessage(integration.chatId, summary.message);

  await prisma.telegramIntegration.update({
    where: { id: integration.id },
    data: {
      status: "CONNECTED",
      lastAlertSentAt: new Date()
    }
  });

  await createAuditLog({
    userId,
    shopId,
    action: "SEND_TELEGRAM_ALERT",
    entityType: "TelegramIntegration",
    entityId: integration.id,
    metadataJson: {
      mode: result.mode,
      sentAt: new Date().toISOString()
    }
  });

  return {
    integration,
    summary,
    result
  };
}

let dailyAlertJobStarted = false;

export function startTelegramDailyAlertJob() {
  if (dailyAlertJobStarted || !env.telegramDailyAlertEnabled) {
    return;
  }

  dailyAlertJobStarted = true;

  setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const todayKey = getTodayKey(now);

    try {
      const integrations = await prisma.telegramIntegration.findMany({
        where: {
          dailyAlertsEnabled: true,
          alertHour: hour,
          status: "CONNECTED"
        }
      });

      for (const integration of integrations) {
        const lastSentKey = integration.lastAlertSentAt ? getTodayKey(integration.lastAlertSentAt) : null;
        if (lastSentKey === todayKey) {
          continue;
        }

        try {
          await sendDailyHealthSummary(integration.shopId);
        } catch (error) {
          console.error("Telegram daily alert failed", {
            shopId: integration.shopId,
            message: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }
    } catch (error) {
      console.error("Telegram daily job iteration failed", {
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }, 5 * 60 * 1000);
}
