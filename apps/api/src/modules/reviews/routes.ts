import { ActionStatus } from "@prisma/client";
import { Router } from "express";
import { approveDangerousActionSchema } from "@wb/shared";
import { prisma } from "../../database/prisma";
import { requireAuth, type AuthenticatedRequest } from "../../common/auth";
import { createAuditLog } from "../../common/audit";
import { DANGEROUS_ACTIONS, SAFE_ACTIONS } from "./actions";

export const actionsRouter = Router();

actionsRouter.use(requireAuth);

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
  const action = await prisma.action.update({
    where: { id: String(req.params.actionId) },
    data: { status: ActionStatus.REJECTED }
  });

  await createAuditLog({
    userId: req.user!.id,
    shopId: action.shopId,
    action: "REJECT_ACTION",
    entityType: "Action",
    entityId: action.id
  });

  return res.json({ action });
});

actionsRouter.post("/:actionId/execute", async (req: AuthenticatedRequest, res) => {
  const action = await prisma.action.findUnique({ where: { id: String(req.params.actionId) } });

  if (!action) {
    return res.status(404).json({ message: "Action not found" });
  }

  if (SAFE_ACTIONS.has(action.type) && action.status !== ActionStatus.APPROVED) {
    return res.status(400).json({ message: "Safe action phai duoc approve truoc khi execute" });
  }

  const parsedBody = approveDangerousActionSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return res.status(400).json(parsedBody.error.flatten());
  }

  if (DANGEROUS_ACTIONS.has(action.type)) {
    if (action.status !== ActionStatus.NEEDS_CONFIRMATION) {
      return res.status(400).json({ message: "Dangerous action can approve truoc" });
    }

    if (parsedBody.data.confirmDangerous !== true) {
      return res.status(400).json({ message: "Can confirm lan 2 de execute action nguy hiem" });
    }
  }

  try {
    const updated = await prisma.action.update({
      where: { id: action.id },
      data: {
        status: ActionStatus.EXECUTED,
        executedAt: new Date(),
        resultJson: {
          executed: true,
          mode: "mock",
          executedBy: req.user!.id
        }
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

    return res.status(500).json({ action: failed, message: "Execute action that bai." });
  }
});
