import { Router } from "express";
import { prisma } from "../../database/prisma";
import { requireAuth } from "../../common/auth";

export const reportsRouter = Router();

function normalizeReport(report: {
  id: string;
  healthScore: number;
  summary: string;
  risksJson: unknown;
  opportunitiesJson: unknown;
  actionsJson: unknown;
  detailsJson: unknown;
  createdAt: Date;
}) {
  const details = report.detailsJson && typeof report.detailsJson === "object"
    ? (report.detailsJson as Record<string, unknown>)
    : null;

  return {
    id: report.id,
    healthScore: report.healthScore,
    createdAt: report.createdAt,
    executiveSummary: details?.executiveSummary ?? report.summary,
    kpiSummary: details?.kpiSummary ?? null,
    criticalIssues: Array.isArray(details?.criticalIssues) ? details?.criticalIssues : report.risksJson,
    growthOpportunities: Array.isArray(details?.growthOpportunities) ? details?.growthOpportunities : report.opportunitiesJson,
    recommendedActions: Array.isArray(details?.recommendedActions) ? details?.recommendedActions : report.actionsJson,
    missingData: Array.isArray(details?.missingData) ? details?.missingData : []
  };
}

reportsRouter.use(requireAuth);

reportsRouter.get("/:shopId/latest", async (req, res) => {
  const report = await prisma.aiReport.findFirst({
    where: { shopId: req.params.shopId },
    orderBy: { createdAt: "desc" }
  });

  return res.json({ report: report ? normalizeReport(report) : null });
});

reportsRouter.get("/:shopId/history", async (req, res) => {
  const reports = await prisma.aiReport.findMany({
    where: { shopId: req.params.shopId },
    orderBy: { createdAt: "desc" }
  });

  return res.json({ reports: reports.map(normalizeReport) });
});
