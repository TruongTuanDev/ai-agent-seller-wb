import { ActionStatus, Prisma, type Action } from "@prisma/client";
import { Router } from "express";
import { approveDangerousActionSchema } from "@wb/shared";
import { WbClient } from "@wb/wb-client";
import { prisma } from "../../database/prisma";
import { requireAuth, type AuthenticatedRequest } from "../../common/auth";
import { createAuditLog } from "../../common/audit";
import { decrypt } from "../../common/crypto";
import { env } from "../../config/env";
import { sendDailyHealthSummary } from "../telegram/service";
import { DANGEROUS_ACTIONS, SAFE_ACTIONS } from "./actions";

export const actionsRouter = Router();

actionsRouter.use(requireAuth);

function getPayload(action: Action) {
  return action.payloadJson && typeof action.payloadJson === "object"
    ? (action.payloadJson as Record<string, unknown>)
    : {};
}

async function getClient(shopId: string) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    throw new Error("Shop not found");
  }

  return {
    shop,
    client: new WbClient({
      token: decrypt(shop.encryptedWbToken, env.encryptionKey),
      mock: !env.enableRealWbApi,
      enableRealApi: env.enableRealWbApi
    })
  };
}

async function executeAction(action: Action, userId: string) {
  const payload = getPayload(action);

  switch (action.type) {
    case "SEND_TELEGRAM_ALERT": {
      const result = await sendDailyHealthSummary(action.shopId, userId);
      return {
        executed: true,
        mode: result.result.mode,
        summary: result.summary
      };
    }
    case "REPLY_REVIEW": {
      const feedbackId = String(payload.feedbackId ?? "");
      const replyText = String(payload.draftReply ?? "");

      if (!feedbackId || !replyText) {
        throw new Error("Action reply review thieu du lieu feedbackId hoac draftReply.");
      }

      const { client } = await getClient(action.shopId);
      const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId } });
      if (!feedback) {
        throw new Error("Feedback khong ton tai.");
      }

      const wbResult = await client.withRateLimit(() =>
        client.feedbacks.reply({
          feedbackId: feedback.wbFeedbackId,
          text: replyText
        })
      );

      await prisma.feedback.update({
        where: { id: feedback.id },
        data: {
          status: "REPLIED",
          aiReplyDraft: replyText
        }
      });

      return {
        executed: true,
        mode: client.getMode(),
        wbResult
      };
    }
    case "CREATE_REVIEW_DRAFT":
    case "CREATE_SEO_DRAFT":
    case "UPDATE_PRICE":
    case "UPDATE_STOCK":
    case "UPDATE_PRODUCT_CONTENT":
    case "UPDATE_AD_BID":
    default:
      return {
        executed: true,
        mode: "mock",
        note: "Action duoc giu o che do an toan/mock cho seller-ready MVP."
      };
  }
}

actionsRouter.get("/:shopId", async (req, res) => {
  const shopId = String(req.params.shopId);
  const actions = await prisma.action.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ actions });
});

actionsRouter.post("/:actionId/approve", async (req: AuthenticatedRequest, res) => {
  const action = await prisma.action.findUnique({ where: { id: String(req.params.actionId) } });

  if (!action) {
    return res.status(404).json({ message: "Action not found" });
  }

  const status = DANGEROUS_ACTIONS.has(action.type) ? ActionStatus.NEEDS_CONFIRMATION : ActionStatus.APPROVED;

  const updated = await prisma.action.update({
    where: { id: action.id },
    data: {
      status,
      approvedByUserId: req.user!.id,
      approvedAt: new Date()
    }
  });

  await createAuditLog({
    userId: req.user!.id,
    shopId: action.shopId,
    action: "APPROVE_ACTION",
    entityType: "Action",
    entityId: action.id,
    metadataJson: { previousStatus: action.status, nextStatus: status }
  });

  return res.json({ action: updated });
});

actionsRouter.post("/:actionId/reject", async (req: AuthenticatedRequest, res) => {
  const current = await prisma.action.findUnique({ where: { id: String(req.params.actionId) } });
  if (!current) {
    return res.status(404).json({ message: "Action not found" });
  }

  const action = await prisma.action.update({
    where: { id: current.id },
    data: { status: ActionStatus.REJECTED }
  });

  const payload = getPayload(action);
  if (action.type === "REPLY_REVIEW" && payload.feedbackId) {
    await prisma.feedback.updateMany({
      where: { id: String(payload.feedbackId) },
      data: {
        status: "NEW",
        aiReplyDraft: null
      }
    });
  }

  await createAuditLog({
    userId: req.user!.id,
    shopId: action.shopId,
    action: "REJECT_ACTION",
    entityType: "Action",
    entityId: action.id,
    metadataJson: { previousStatus: current.status }
  });

  return res.json({ action });
});

actionsRouter.post("/:actionId/execute", async (req: AuthenticatedRequest, res) => {
  const action = await prisma.action.findUnique({ where: { id: String(req.params.actionId) } });

  if (!action) {
    return res.status(404).json({ message: "Action not found" });
  }

  if (SAFE_ACTIONS.has(action.type) && action.status !== ActionStatus.APPROVED) {
    return res.status(400).json({ message: "Safe action phai duoc approve truoc khi execute." });
  }

  const parsedBody = approveDangerousActionSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return res.status(400).json(parsedBody.error.flatten());
  }

  if (DANGEROUS_ACTIONS.has(action.type)) {
    if (action.status !== ActionStatus.NEEDS_CONFIRMATION) {
      return res.status(400).json({ message: "Dangerous action can duoc approve truoc khi execute." });
    }

    if (parsedBody.data.confirmDangerous !== true) {
      return res.status(400).json({ message: "Can confirm lan 2 de execute action nguy hiem." });
    }
  }

  try {
    const result = await executeAction(action, req.user!.id);
    const updated = await prisma.action.update({
      where: { id: action.id },
      data: {
        status: ActionStatus.EXECUTED,
        executedAt: new Date(),
        resultJson: result as unknown as Prisma.InputJsonValue
      }
    });

    await createAuditLog({
      userId: req.user!.id,
      shopId: action.shopId,
      action: "EXECUTE_ACTION",
      entityType: "Action",
      entityId: action.id,
      metadataJson: { dangerous: DANGEROUS_ACTIONS.has(action.type) }
    });

    return res.json({ action: updated });
  } catch (error) {
    const failed = await prisma.action.update({
      where: { id: action.id },
      data: {
        status: ActionStatus.FAILED,
        resultJson: {
          executed: false,
          error: error instanceof Error ? error.message : "Unknown action execution error"
        }
      }
    });

    await createAuditLog({
      userId: req.user!.id,
      shopId: action.shopId,
      action: "FAIL_ACTION",
      entityType: "Action",
      entityId: action.id,
      metadataJson: { dangerous: DANGEROUS_ACTIONS.has(action.type) }
    });

    return res.status(500).json({ action: failed, message: error instanceof Error ? error.message : "Execute action that bai." });
  }
});
