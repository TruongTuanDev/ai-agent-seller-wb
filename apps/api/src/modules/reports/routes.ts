import { Router } from "express";
import { prisma } from "../../database/prisma";
import { requireAuth } from "../../common/auth";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.get("/:shopId/latest", async (req, res) => {
  const report = await prisma.aiReport.findFirst({
    where: { shopId: req.params.shopId },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ report });
});

reportsRouter.get("/:shopId/history", async (req, res) => {
  const reports = await prisma.aiReport.findMany({
    where: { shopId: req.params.shopId },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ reports });
});
