import type { Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../database/prisma";
import type { AuthenticatedRequest } from "./auth";

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, role: true }
  });

  if (!user || user.role !== UserRole.ADMIN) {
    return res.status(403).json({ message: "Ban khong co quyen vao khu vuc admin." });
  }

  req.user = {
    ...req.user,
    role: user.role
  };

  return next();
}
