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

export const executeReplyReviewSchema = approveDangerousActionSchema.extend({
  confirmReplySend: z.boolean().optional().default(false)
});

export const testWbTokenSchema = z.object({
  token: z.string().min(6)
});

export const updateShopSchema = z.object({
  name: z.string().min(2).optional(),
  status: z.enum(["ACTIVE", "DISCONNECTED", "ERROR"]).optional()
});

export const reviewDraftSchema = z.object({
  feedbackId: z.string().min(1).optional(),
  tone: z.enum(["polite", "friendly", "professional"]).default("professional"),
  allowRefundPromise: z.boolean().default(false)
});

export const telegramConnectSchema = z.object({
  chatId: z.string().min(2),
  dailyAlertsEnabled: z.boolean().default(true),
  alertHour: z.number().int().min(0).max(23).default(9)
});

export const updateUserPlanSchema = z.object({
  plan: z.enum(["FREE", "PRO", "AGENCY"])
});

export const toggleLiveTestSchema = z.object({
  enabled: z.boolean()
});

export const copilotChatSchema = z.object({
  shopId: z.string().min(1),
  message: z.string().min(2).max(4000),
  conversationId: z.string().min(1).optional()
});

export const copilotIntentSchema = z.enum([
  "SHOP_HEALTH",
  "SALES_DROP_ANALYSIS",
  "REVIEW_MANAGEMENT",
  "PRODUCT_DOCTOR",
  "INVENTORY_RISK",
  "SEO_OPTIMIZATION",
  "COMPETITOR_WATCH",
  "ACTION_EXECUTION",
  "USAGE_BILLING",
  "GENERAL_HELP"
]);

export const updateCopilotModeSchema = z.object({
  mode: z.enum(["ASSISTANT", "OPERATOR", "MANAGER"])
});

export const telegramCopilotCommandSchema = z.object({
  shopId: z.string().min(1),
  command: z.enum(["/health", "/reviews", "/inventory", "/report"])
});
