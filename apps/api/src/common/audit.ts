import { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma";

export async function createAuditLog(input: {
  userId?: string;
  shopId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadataJson?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      ...input,
      metadataJson: (input.metadataJson ?? {}) as Prisma.InputJsonValue
    }
  });
}
