import { UserPlan, type User } from "@prisma/client";
import { prisma } from "../database/prisma";

export type UsageFeature = "reviewDraft" | "healthReport" | "realWrite";

export type UsageSnapshot = {
  plan: UserPlan;
  resetAt: string;
  limits: {
    maxShops: number;
    reviewDraftsPerMonth: number;
    healthReportsPerMonth: number;
    realWriteEnabled: boolean;
  };
  used: {
    shops: number;
    reviewDrafts: number;
    healthReports: number;
    realWrites: number;
  };
  remaining: {
    reviewDrafts: number;
    healthReports: number;
  };
};

const PLAN_LIMITS: Record<UserPlan, { maxShops: number; reviewDraftsPerMonth: number; healthReportsPerMonth: number; realWriteEnabled: boolean }> = {
  FREE: {
    maxShops: 1,
    reviewDraftsPerMonth: 20,
    healthReportsPerMonth: 10,
    realWriteEnabled: false
  },
  PRO: {
    maxShops: 3,
    reviewDraftsPerMonth: 500,
    healthReportsPerMonth: 100,
    realWriteEnabled: true
  },
  AGENCY: {
    maxShops: 20,
    reviewDraftsPerMonth: 5000,
    healthReportsPerMonth: 1000,
    realWriteEnabled: true
  }
};

function getMonthStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function needsReset(usageResetAt: Date, now = new Date()) {
  return usageResetAt.getUTCFullYear() !== now.getUTCFullYear()
    || usageResetAt.getUTCMonth() !== now.getUTCMonth();
}

export async function ensureUsageWindow(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  if (!needsReset(user.usageResetAt)) {
    return user;
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      monthlyReviewDraftsUsed: 0,
      monthlyHealthReportsUsed: 0,
      monthlyRealWritesUsed: 0,
      usageResetAt: getMonthStart()
    }
  });
}

export async function getUsageSnapshot(userId: string): Promise<UsageSnapshot> {
  const user = await ensureUsageWindow(userId);
  const shopCount = await prisma.shop.count({
    where: {
      userId,
      status: { not: "DISCONNECTED" }
    }
  });
  const limits = PLAN_LIMITS[user.plan];

  return {
    plan: user.plan,
    resetAt: user.usageResetAt.toISOString(),
    limits,
    used: {
      shops: shopCount,
      reviewDrafts: user.monthlyReviewDraftsUsed,
      healthReports: user.monthlyHealthReportsUsed,
      realWrites: user.monthlyRealWritesUsed
    },
    remaining: {
      reviewDrafts: Math.max(0, limits.reviewDraftsPerMonth - user.monthlyReviewDraftsUsed),
      healthReports: Math.max(0, limits.healthReportsPerMonth - user.monthlyHealthReportsUsed)
    }
  };
}

export async function assertShopQuota(userId: string) {
  const usage = await getUsageSnapshot(userId);
  if (usage.used.shops >= usage.limits.maxShops) {
    throw new Error(`Goi hien tai chi cho phep toi da ${usage.limits.maxShops} shop. Hay nang cap plan de them shop moi.`);
  }
}

export async function assertUsageAvailable(userId: string, feature: UsageFeature) {
  const usage = await getUsageSnapshot(userId);

  if (feature === "realWrite" && !usage.limits.realWriteEnabled) {
    throw new Error("Plan hien tai khong cho phep gui review real-write. Hay dung dry-run hoac nang cap plan.");
  }

  if (feature === "reviewDraft" && usage.used.reviewDrafts >= usage.limits.reviewDraftsPerMonth) {
    throw new Error(`Ban da dung het quota tao AI review draft thang nay (${usage.limits.reviewDraftsPerMonth}).`);
  }

  if (feature === "healthReport" && usage.used.healthReports >= usage.limits.healthReportsPerMonth) {
    throw new Error(`Ban da dung het quota health report thang nay (${usage.limits.healthReportsPerMonth}).`);
  }

  return usage;
}

export async function incrementUsage(userId: string, feature: UsageFeature) {
  await ensureUsageWindow(userId);

  if (feature === "reviewDraft") {
    await prisma.user.update({
      where: { id: userId },
      data: { monthlyReviewDraftsUsed: { increment: 1 } }
    });
    return;
  }

  if (feature === "healthReport") {
    await prisma.user.update({
      where: { id: userId },
      data: { monthlyHealthReportsUsed: { increment: 1 } }
    });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { monthlyRealWritesUsed: { increment: 1 } }
  });
}

export async function resetUsage(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      monthlyReviewDraftsUsed: 0,
      monthlyHealthReportsUsed: 0,
      monthlyRealWritesUsed: 0,
      usageResetAt: getMonthStart()
    }
  });
}

export function getPlanLimits(plan: UserPlan) {
  return PLAN_LIMITS[plan];
}

export function serializeUserUsage(user: User) {
  return {
    plan: user.plan,
    monthlyReviewDraftsUsed: user.monthlyReviewDraftsUsed,
    monthlyHealthReportsUsed: user.monthlyHealthReportsUsed,
    monthlyRealWritesUsed: user.monthlyRealWritesUsed,
    usageResetAt: user.usageResetAt
  };
}
