import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2)
});

export const connectShopSchema = z.object({
  shopId: z.string().optional(),
  name: z.string().min(2),
  wbSellerId: z.string().min(1).optional().default("pending"),
  token: z.string().min(6),
  tokenScopes: z.array(z.string()).default([])
});

export const approveDangerousActionSchema = z.object({
  confirmDangerous: z.boolean().optional().default(false)
});

export const testWbTokenSchema = z.object({
  token: z.string().min(6)
});
