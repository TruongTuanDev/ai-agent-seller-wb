import { ActionStatus, Prisma, type Action, type Feedback, type Shop } from "@prisma/client";
import { Router } from "express";
import { executeReplyReviewSchema } from "@wb/shared";
import { WbClient } from "@wb/wb-client";
import { prisma } from "../../database/prisma";
import { requireAuth, type AuthenticatedRequest } from "../../common/auth";
import { createAuditLog } from "../../common/audit";
import { decrypt } from "../../common/crypto";
import { env } from "../../config/env";
import { buildLiveTestChecklist } from "../../common/liveTest";
import { assertUsageAvailable, incrementUsage } from "../../common/usage";
import { sendDailyHealthSummary } from "../telegram/service";
import { DANGEROUS_ACTIONS, SAFE_ACTIONS } from "./actions";

export const actionsRouter = Router();

actionsRouter.use(requireAuth);

type ActionPayload = Record<string, unknown>;

type ReplyReviewExecutionResult = {
  mode: "mock" | "dry_run" | "real_write";
  actionStatus: ActionStatus;
  feedbackStatus: "DRAFTED" | "SENT";
  result: Record<string, unknown>;
};

function getPayload(action: Action): ActionPayload {
  return action.payloadJson && typeof action.payloadJson === "object"
    ? (action.payloadJson as ActionPayload)
    : {};
}

function getReplyText(payload: ActionPayload) {
  return String(payload.replyText ?? payload.draftReply ?? "").trim();
}

function createReplyPreview(text: string) {
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function createActionError(
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return {
    code,
    message,
    details: details ?? {}
  };
}

async function getActionForUser(actionId: string, userId: string) {
  return prisma.action.findFirst({
    where: {
      id: actionId,
      shop: { userId }
    }
  });
}

async function getClient(shop: Shop) {
  let token: string;

  try {
    token = decrypt(shop.encryptedWbToken, env.encryptionKey);
  } catch {
    throw createActionError(
      "SHOP_WB_TOKEN_INVALID",
      "Token Wildberries cua shop khong hop le hoac khong giai ma duoc."
    );
  }

  if (!token.trim()) {
    throw createActionError("SHOP_WB_TOKEN_MISSING", "Shop chua co WB token hop le.");
  }

  return new WbClient({
    token,
    mock: !env.enableRealWbApi,
    enableRealApi: env.enableRealWbApi,
    writeDryRun: env.wbWriteDryRun
  });
}

async function failReplyReviewAction(input: {
  action: Action;
  userId: string;
  error: ReturnType<typeof createActionError>;
  httpStatus: number;
}) {
  const failed = await prisma.action.update({
    where: { id: input.action.id },
    data: {
      status: ActionStatus.FAILED,
      resultJson: {
        ok: false,
        error: input.error
      } as Prisma.InputJsonValue
    }
  });

  await createAuditLog({
    userId: input.userId,
    shopId: input.action.shopId,
    action: "REPLY_REVIEW_FAILED",
    entityType: "Action",
    entityId: input.action.id,
    metadataJson: {
      code: input.error.code,
      message: input.error.message
    }
  });

  return {
    failed,
    httpStatus: input.httpStatus,
    payload: {
      ok: false as const,
      error: input.error
    }
  };
}

async function validateReplyReviewExecution(input: {
  action: Action;
  userId: string;
  confirmReplySend: boolean;
}) {
  const payload = getPayload(input.action);
  const feedbackRecordId = String(payload.feedbackId ?? "").trim();
  const replyText = getReplyText(payload);

  if (input.action.type !== "REPLY_REVIEW") {
    return createActionError("ACTION_TYPE_INVALID", "Action nay khong phai REPLY_REVIEW.");
  }

  if (input.action.status !== ActionStatus.APPROVED && input.action.status !== ActionStatus.NEEDS_CONFIRMATION) {
    return createActionError("ACTION_NOT_APPROVED", "Action phan hoi review phai duoc approve truoc khi gui.", {
      currentStatus: input.action.status
    });
  }

  if (!input.confirmReplySend) {
    return createActionError("REPLY_CONFIRMATION_REQUIRED", "Ban phai xac nhan lan 2 truoc khi gui phan hoi.");
  }

  if (!feedbackRecordId) {
    return createActionError("FEEDBACK_ID_MISSING", "Action thieu feedbackId.");
  }

  if (!replyText) {
    return createActionError("REPLY_TEXT_MISSING", "Noi dung phan hoi dang trong.");
  }

  if (replyText.length < 20 || replyText.length > 1000) {
    return createActionError("REPLY_TEXT_LENGTH_INVALID", "Noi dung phan hoi phai dai tu 20 den 1000 ky tu.", {
      length: replyText.length
    });
  }

  const feedback = await prisma.feedback.findFirst({
    where: {
      id: feedbackRecordId,
      shopId: input.action.shopId
    }
  });

  if (!feedback) {
    return createActionError("FEEDBACK_NOT_FOUND", "Khong tim thay review can phan hoi.");
  }

  if (feedback.status === "SENT") {
    return createActionError("FEEDBACK_ALREADY_SENT", "Review nay da duoc gui phan hoi truoc do.");
  }

  const shop = await prisma.shop.findFirst({
    where: {
      id: input.action.shopId,
      userId: input.userId
    }
  });

  if (!shop) {
    return createActionError("SHOP_NOT_FOUND", "Khong tim thay shop hoac ban khong co quyen voi shop nay.");
  }

  if (!shop.encryptedWbToken) {
    return createActionError("SHOP_WB_TOKEN_MISSING", "Shop chua ket noi token Wildberries.");
  }

  const payloadAction = await prisma.action.findUnique({
    where: { id: input.action.id }
  });
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { plan: true }
  });

  if (!payloadAction || !user) {
    return createActionError("ACTION_CONTEXT_MISSING", "Khong tai duoc context de xac minh live test.");
  }

  const liveChecklist = buildLiveTestChecklist({
    shop,
    plan: user.plan,
    feedback,
    action: payloadAction,
    replyReviewed: input.action.status === ActionStatus.APPROVED,
    confirmReplySend: input.confirmReplySend,
    auditLoggingEnabled: true
  });

  return {
    feedback,
    shop,
    payload,
    replyText,
    liveChecklist
  };
}

async function executeAction(action: Action, userId: string, confirmReplySend: boolean): Promise<ReplyReviewExecutionResult | {
  mode: "mock";
  actionStatus: ActionStatus;
  feedbackStatus: "DRAFTED";
  result: Record<string, unknown>;
}> {
  const payload = getPayload(action);

  switch (action.type) {
    case "SEND_TELEGRAM_ALERT": {
      const result = await sendDailyHealthSummary(action.shopId, userId);
      return {
        actionStatus: ActionStatus.EXECUTED,
        feedbackStatus: "DRAFTED",
        mode: "mock",
        result: {
          executed: true,
          summary: result.summary,
          transportMode: result.result.mode
        }
      };
    }
    case "REPLY_REVIEW": {
      const validation = await validateReplyReviewExecution({
        action,
        userId,
        confirmReplySend
      });

      if ("code" in validation) {
        throw validation;
      }

      const { feedback, shop, replyText, liveChecklist } = validation as {
        feedback: Feedback;
        shop: Shop;
        payload: ActionPayload;
        replyText: string;
        liveChecklist: ReturnType<typeof buildLiveTestChecklist>;
      };
      const client = await getClient(shop);

      if (client.getWriteMode() === "real_write") {
        try {
          await assertUsageAvailable(userId, "realWrite");
        } catch (error) {
          throw createActionError("PLAN_REAL_WRITE_BLOCKED", error instanceof Error ? error.message : "Plan khong cho phep real write.");
        }

        if (!shop.allowRealReplyTest) {
          throw createActionError("LIVE_TEST_NOT_ARMED", "Shop chua bat 'Allow real review reply test'.");
        }

        if (!liveChecklist.allPassed) {
          throw createActionError("LIVE_TEST_CHECKLIST_FAILED", "Live Test Safety Checklist chua dat day du.", {
            checklist: liveChecklist.items
          });
        }
      }

      const wbResult = await client.withRateLimit(() =>
        client.feedbacks.reply({
          feedbackId: feedback.wbFeedbackId,
          text: replyText
        })
      );

      if (wbResult.mode === "dry_run") {
        await prisma.feedback.update({
          where: { id: feedback.id },
          data: {
            aiReplyDraft: replyText,
            status: "DRAFTED"
          }
        });

        return {
          actionStatus: ActionStatus.EXECUTED_DRY_RUN,
          feedbackStatus: "DRAFTED",
          mode: "dry_run",
          result: {
            dryRun: true,
            wouldCall: "wb.feedbacks.reply",
            feedbackId: feedback.wbFeedbackId,
            replyTextPreview: createReplyPreview(replyText)
          }
        };
      }

      if (wbResult.mode === "mock") {
        await prisma.feedback.update({
          where: { id: feedback.id },
          data: {
            aiReplyDraft: replyText,
            status: "DRAFTED"
          }
        });

        return {
          actionStatus: ActionStatus.EXECUTED,
          feedbackStatus: "DRAFTED",
          mode: "mock",
          result: {
            dryRun: false,
            mock: true,
            wouldCall: "wb.feedbacks.reply",
            feedbackId: feedback.wbFeedbackId,
            replyTextPreview: createReplyPreview(replyText)
          }
        };
      }

      await prisma.feedback.update({
        where: { id: feedback.id },
        data: {
          status: "SENT",
          aiReplyDraft: replyText
        }
      });

      await incrementUsage(userId, "realWrite");

      return {
        actionStatus: ActionStatus.EXECUTED,
        feedbackStatus: "SENT",
        mode: "real_write",
        result: {
          statusCode: wbResult.statusCode ?? 204,
          code: "WB_FEEDBACK_REPLY_SENT",
          message: "Reply review da duoc gui len Wildberries.",
          details: wbResult.response ?? null,
          retryable: false
        }
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
        actionStatus: ActionStatus.EXECUTED,
        feedbackStatus: "DRAFTED",
        mode: "mock",
        result: {
          executed: true,
          note: "Action duoc giu o che do an toan/mock cho seller-ready MVP."
        }
      };
  }
}

actionsRouter.get("/:shopId", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.params.shopId);
  const actions = await prisma.action.findMany({
    where: {
      shopId,
      shop: { userId: req.user!.id }
    },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ actions });
});

actionsRouter.post("/:actionId/approve", async (req: AuthenticatedRequest, res) => {
  const action = await getActionForUser(String(req.params.actionId), req.user!.id);

  if (!action) {
    return res.status(404).json({ message: "Action not found" });
  }

  const updated = await prisma.action.update({
    where: { id: action.id },
    data: {
      status: ActionStatus.APPROVED,
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
    metadataJson: { previousStatus: action.status, nextStatus: ActionStatus.APPROVED }
  });

  return res.json({ action: updated });
});

actionsRouter.post("/:actionId/reject", async (req: AuthenticatedRequest, res) => {
  const current = await getActionForUser(String(req.params.actionId), req.user!.id);
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
  const action = await getActionForUser(String(req.params.actionId), req.user!.id);

  if (!action) {
    return res.status(404).json({
      ok: false,
      error: createActionError("ACTION_NOT_FOUND", "Khong tim thay action.")
    });
  }

  const parsedBody = executeReplyReviewSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return res.status(400).json({
      ok: false,
      error: createActionError("EXECUTE_ACTION_INPUT_INVALID", "Du lieu xac nhan execute khong hop le.", parsedBody.error.flatten())
    });
  }

  if (SAFE_ACTIONS.has(action.type) && action.status !== ActionStatus.APPROVED) {
    return res.status(400).json({
      ok: false,
      error: createActionError("SAFE_ACTION_NOT_APPROVED", "Safe action phai duoc approve truoc khi execute.")
    });
  }

  if (DANGEROUS_ACTIONS.has(action.type) && !parsedBody.data.confirmDangerous) {
    return res.status(400).json({
      ok: false,
      error: createActionError("DANGEROUS_CONFIRM_REQUIRED", "Can confirm action nguy hiem truoc khi execute.")
    });
  }

  try {
    const execution = await executeAction(action, req.user!.id, parsedBody.data.confirmReplySend);
    const updated = await prisma.action.update({
      where: { id: action.id },
      data: {
        status: execution.actionStatus,
        executedAt: new Date(),
        resultJson: execution.result as Prisma.InputJsonValue
      }
    });

    await createAuditLog({
      userId: req.user!.id,
      shopId: action.shopId,
      action: action.type === "REPLY_REVIEW" ? "REPLY_REVIEW_EXECUTED" : "EXECUTE_ACTION",
      entityType: "Action",
      entityId: action.id,
      metadataJson: {
        dangerous: DANGEROUS_ACTIONS.has(action.type),
        mode: execution.mode,
        actionStatus: execution.actionStatus
      }
    });

    return res.json({
      ok: true,
      mode: execution.mode,
      actionStatus: updated.status,
      feedbackStatus: execution.feedbackStatus,
      result: updated.resultJson ?? {}
    });
  } catch (error) {
    const normalized = action.type === "REPLY_REVIEW" && error && typeof error === "object" && "code" in error
      ? (error as { code?: string; message?: string; details?: Record<string, unknown> })
      : new WbClient({
          token: "normalize-only",
          mock: !env.enableRealWbApi,
          enableRealApi: env.enableRealWbApi,
          writeDryRun: env.wbWriteDryRun
        }).normalizeError(error);

    const actionError = "statusCode" in normalized
      ? createActionError(
          normalized.code ?? "WB_REPLY_FAILED",
          normalized.message,
          {
            details: normalized.details ?? null,
            retryable: normalized.retryable,
            statusCode: normalized.statusCode
          }
        )
      : createActionError(
          normalized.code ?? "REPLY_REVIEW_FAILED",
          normalized.message ?? "Khong the gui phan hoi review.",
          normalized.details && typeof normalized.details === "object"
            ? (normalized.details as Record<string, unknown>)
            : { details: normalized.details ?? null }
        );

    const failed = action.type === "REPLY_REVIEW"
      ? await failReplyReviewAction({
          action,
          userId: req.user!.id,
          error: actionError,
          httpStatus: 400
        })
      : {
          failed: await prisma.action.update({
            where: { id: action.id },
            data: {
              status: ActionStatus.FAILED,
              resultJson: {
                ok: false,
                error: actionError
              } as Prisma.InputJsonValue
            }
          }),
          httpStatus: 500,
          payload: {
            ok: false as const,
            error: actionError
          }
        };

    return res.status(failed.httpStatus).json(failed.payload);
  }
});
