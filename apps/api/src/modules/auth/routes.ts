import bcrypt from "bcryptjs";
import { Router } from "express";
import { UserRole } from "@prisma/client";
import { loginSchema, registerSchema } from "@wb/shared";
import { prisma } from "../../database/prisma";
import { requireAuth, signToken, type AuthenticatedRequest } from "../../common/auth";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      name: parsed.data.name,
      role: UserRole.SELLER
    }
  });

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  return res.status(201).json({ token, user });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ message: "Sai email hoac mat khau" });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  return res.json({ token, user });
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  return res.json({ user });
});
