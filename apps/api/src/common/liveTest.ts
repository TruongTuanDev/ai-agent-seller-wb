import { Shop, UserPlan, type Action, type Feedback } from "@prisma/client";
import { env } from "../config/env";
import { decrypt } from "./crypto";

export type LiveChecklistItem = {
  key: string;
  label: string;
  ok: boolean;
  message: string;
};

export function hasFeedbacksQuestionsScope(scopes: string[]) {
  return scopes.some((scope) => {
    const normalized = scope.toLowerCase();
    return normalized.includes("feedback") || normalized.includes("question");
  });
}

export function buildLiveTestChecklist(input: {
  shop: Shop;
  plan: UserPlan;
  feedback?: Feedback | null;
  action?: Action | null;
  replyReviewed?: boolean;
  confirmReplySend?: boolean;
  auditLoggingEnabled?: boolean;
}) {
  const tokenValid = (() => {
    try {
      const decrypted = decrypt(input.shop.encryptedWbToken, env.encryptionKey);
      return decrypted.trim().length > 0;
    } catch {
      return false;
    }
  })();

  const items: LiveChecklistItem[] = [
    {
      key: "enable_real_wb_api",
      label: "ENABLE_REAL_WB_API=true",
      ok: env.enableRealWbApi,
      message: env.enableRealWbApi ? "Da bat goi WB API that." : "Chua bat ENABLE_REAL_WB_API=true."
    },
    {
      key: "wb_write_dry_run_disabled",
      label: "WB_WRITE_DRY_RUN=false",
      ok: !env.wbWriteDryRun,
      message: !env.wbWriteDryRun ? "Da tat dry-run." : "He thong dang o dry-run, chua cho gui that."
    },
    {
      key: "shop_valid_token",
      label: "Shop co WB token hop le",
      ok: tokenValid,
      message: tokenValid ? "Shop co token va giai ma thanh cong." : "Shop chua co token hop le hoac token khong giai ma duoc."
    },
    {
      key: "feedbacks_questions_scope",
      label: "Token co scope Feedbacks and Questions",
      ok: hasFeedbacksQuestionsScope(input.shop.tokenScopes),
      message: hasFeedbacksQuestionsScope(input.shop.tokenScopes)
        ? "Da thay scope feedback/question trong token."
        : "Token hien chua the hien scope Feedbacks and Questions."
    },
    {
      key: "feedback_target_open",
      label: "Feedback target chua duoc tra loi",
      ok: input.feedback ? input.feedback.status !== "SENT" : false,
      message: input.feedback
        ? input.feedback.status !== "SENT"
          ? "Feedback muc tieu van chua gui reply."
          : "Feedback muc tieu da duoc gui reply."
        : "Chua chon feedback muc tieu hop le."
    },
    {
      key: "reply_reviewed",
      label: "AI reply da duoc seller kiem tra",
      ok: Boolean(input.replyReviewed),
      message: input.replyReviewed ? "Action da duoc approve boi seller." : "Reply chua duoc seller approve/kiem tra."
    },
    {
      key: "confirm_second_enabled",
      label: "Confirm lan 2 da bat",
      ok: Boolean(input.confirmReplySend),
      message: input.confirmReplySend ? "Confirm lan 2 da duoc xac nhan." : "Chua xac nhan lan 2."
    },
    {
      key: "audit_logging_enabled",
      label: "Audit logging enabled",
      ok: input.auditLoggingEnabled !== false,
      message: input.auditLoggingEnabled === false ? "Audit logging dang tat." : "Audit log dang hoat dong."
    },
    {
      key: "plan_allows_real_write",
      label: "Plan cho phep real write review",
      ok: input.plan !== UserPlan.FREE,
      message: input.plan !== UserPlan.FREE
        ? "Plan hien tai cho phep live test review reply."
        : "Plan FREE khong cho phep real write."
    }
  ];

  return {
    items,
    allPassed: items.every((item) => item.ok),
    canAllow: items.every((item) => item.key !== "confirm_second_enabled" ? item.ok : true)
  };
}
