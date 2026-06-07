"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import type {
  CopilotCard,
  CopilotConversationMessage,
  CopilotConversationSummary,
  CopilotSuggestedAction,
  SellerOperatingMode
} from "@wb/shared";

type CopilotPanelProps = {
  shopId: string;
  shopName: string;
  mode: SellerOperatingMode;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  onModeChange: (mode: SellerOperatingMode) => Promise<void>;
  onOpenView: (view: "overview" | "reviews" | "actions" | "settings" | "copilot") => void;
  onStatus: (message: string) => void;
  isDemoMode?: boolean;
};

type ConversationResponse = {
  conversation: CopilotConversationSummary;
  messages: CopilotConversationMessage[];
};

function readAssistantCards(message: CopilotConversationMessage) {
  const raw = message.metadataJson?.cards;
  return Array.isArray(raw) ? (raw as CopilotCard[]) : [];
}

const suggestedPrompts = [
  "Tai sao don giam?",
  "Review nao chua tra loi?",
  "SKU nao sap het hang?",
  "Toi uu san pham ban chay"
];

function readAssistantActions(message: CopilotConversationMessage) {
  const raw = message.metadataJson?.suggestedActions;
  return Array.isArray(raw) ? (raw as CopilotSuggestedAction[]) : [];
}

function CardRenderer({ card }: { card: CopilotCard }) {
  if (card.type === "health") {
    return (
      <div className="soft-card border-emerald-300/20 bg-emerald-400/10">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-white">{card.title}</p>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-100">{card.healthScore}/100</span>
        </div>
        <p className="mt-3 text-sm text-slate-200">{card.summary}</p>
      </div>
    );
  }

  if (card.type === "insight") {
    const impact = typeof card.metadata?.businessImpact === "string" ? card.metadata.businessImpact : null;
    const evidence = Array.isArray(card.metadata?.evidence) ? card.metadata.evidence.slice(0, 2).map(String) : [];
    return (
      <div className="soft-card border-rose-300/20 bg-rose-400/10">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-white">{card.title}</p>
          <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-100">{card.severity}</span>
        </div>
        <p className="mt-3 text-sm text-rose-50">{card.summary}</p>
        {impact ? <p className="mt-3 text-xs text-rose-100">Impact: {impact}</p> : null}
        {evidence.length > 0 ? (
          <div className="mt-3 grid gap-1 text-xs text-rose-100">
            {evidence.map((item) => (
              <p key={item}>• {item}</p>
            ))}
          </div>
        ) : null}
        {card.ctaTitle ? <p className="mt-3 text-xs uppercase tracking-[0.2em] text-rose-100">{card.ctaTitle}</p> : null}
      </div>
    );
  }

  if (card.type === "product") {
    return (
      <div className="soft-card">
        <p className="font-medium text-white">{card.title}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{card.sku}</p>
        <p className="mt-3 text-sm text-slate-200">{card.summary}</p>
      </div>
    );
  }

  if (card.type === "productRisk") {
    const diagnosis = card.metadata?.diagnosis && typeof card.metadata.diagnosis === "object"
      ? (card.metadata.diagnosis as Record<string, unknown>)
      : null;
    return (
      <div className="soft-card border-orange-300/20 bg-orange-400/10">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-white">{card.title}</p>
          <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold text-orange-100">{card.severity}</span>
        </div>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{card.sku}</p>
        <p className="mt-3 text-sm text-orange-50">{card.summary}</p>
        <p className="mt-3 text-xs text-orange-100">
          Stock: {String(card.metadata?.stock ?? "--")} | Rating: {String(diagnosis?.reviewRisk ?? card.metadata?.rating ?? "--")}
        </p>
      </div>
    );
  }

  if (card.type === "review") {
    return (
      <div className="soft-card border-sky-300/20 bg-sky-400/10">
        <p className="font-medium text-white">{card.title}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{card.feedbackId}</p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-sky-50">{card.summary}</p>
      </div>
    );
  }

  if (card.type === "reviewQueue") {
    return (
      <div className="soft-card border-sky-300/20 bg-sky-400/10">
        <p className="font-medium text-white">{card.title}</p>
        <p className="mt-3 text-sm text-sky-50">{card.summary}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-sky-100">
          {card.pendingCount} pending | {card.negativeCount} negative
        </p>
        <p className="mt-3 text-xs text-sky-100">CTA: Mo review queue, tao draft, approve, confirm lan 2 neu gui that.</p>
      </div>
    );
  }

  if (card.type === "inventoryRisk") {
    return (
      <div className="soft-card border-amber-300/20 bg-amber-400/10">
        <p className="font-medium text-white">{card.title}</p>
        <p className="mt-3 text-sm text-amber-50">{card.summary}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-amber-100">{card.affectedSkus.join(", ") || "Chua co SKU"}</p>
        <p className="mt-3 text-xs text-amber-100">Uoc tinh: can xu ly trong 1-3 ngay toi neu la SKU ban chay.</p>
      </div>
    );
  }

  if (card.type === "actionPlan") {
    return (
      <div className="soft-card border-cyan-300/20 bg-cyan-400/10">
        <p className="font-medium text-white">{card.title}</p>
        <p className="mt-3 text-sm text-cyan-50">{card.summary}</p>
        <div className="mt-3 grid gap-2 text-xs text-cyan-100">
          {card.steps.slice(0, 3).map((step) => (
            <p key={`${card.title}-${step.step}`}>{step.step}. {step.reason}</p>
          ))}
        </div>
      </div>
    );
  }

  if (card.type === "usageLimit") {
    return (
      <div className="soft-card border-violet-300/20 bg-violet-400/10">
        <p className="font-medium text-white">{card.title}</p>
        <p className="mt-3 text-sm text-violet-50">{card.summary}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-violet-100">{card.planName}</p>
      </div>
    );
  }

  return (
    <div className="soft-card border-amber-300/20 bg-amber-400/10">
      <p className="font-medium text-white">{card.title}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{card.sku}</p>
      <p className="mt-3 text-sm text-amber-50">{card.summary}</p>
    </div>
  );
}

export function CopilotPanel(props: CopilotPanelProps) {
  const { mode, onModeChange, onOpenView, onStatus, request, shopId, shopName, isDemoMode } = props;
  const [conversations, setConversations] = useState<CopilotConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [messages, setMessages] = useState<CopilotConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [modePending, startModeTransition] = useTransition();

  async function loadConversation(conversationId: string) {
    const data = await request<ConversationResponse>(`/copilot/conversations/${conversationId}`);
    setActiveConversationId(data.conversation.id);
    setMessages(data.messages);
  }

  async function loadConversations() {
    const data = await request<{ conversations: CopilotConversationSummary[] }>(`/copilot/conversations?shopId=${encodeURIComponent(shopId)}`);
    setConversations(data.conversations);
    if (data.conversations[0]?.id) {
      await loadConversation(data.conversations[0].id);
    } else {
      setActiveConversationId("");
      setMessages([]);
    }
  }

  useEffect(() => {
    loadConversations().catch((error) => onStatus(error instanceof Error ? error.message : "Khong the tai conversation."));
  }, [shopId]);

  const latestHealthCard = useMemo(() => {
    const assistantMessages = [...messages].reverse().filter((message) => message.role === "assistant");
    for (const message of assistantMessages) {
      const health = readAssistantCards(message).find((card) => card.type === "health");
      if (health) {
        return health;
      }
    }
    return null;
  }, [messages]);

  function scrollToInventoryRisk() {
    window.setTimeout(() => {
      document.getElementById("inventory-risk-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  function handleSuggestedAction(action: CopilotSuggestedAction) {
    if (action.type === "OPEN_REVIEW_QUEUE") {
      onOpenView("reviews");
      return;
    }

    if (action.type === "RUN_PRODUCT_DOCTOR" && typeof action.payload.productId === "string") {
      window.location.href = `/products/${action.payload.productId}/doctor`;
      return;
    }

    if (action.type === "CREATE_REVIEW_DRAFTS") {
      onOpenView("reviews");
      onStatus("Mo Review Queue de tao va duyet draft an toan.");
      return;
    }

    if (action.type === "VIEW_INVENTORY_RISK") {
      onOpenView("overview");
      scrollToInventoryRisk();
      onStatus("Copilot da dua ban den khu vuc inventory risk trong dashboard.");
      return;
    }

    if (action.type === "OPEN_ACTION_QUEUE") {
      onOpenView("actions");
      onStatus("Action Queue dang giu approval flow va confirm lan 2 cho action nguy hiem.");
      return;
    }

    if (action.type === "RUN_HEALTH_REPORT" || action.type === "GENERATE_HEALTH_REPORT") {
      startTransition(async () => {
        try {
          await request(`/ai/${shopId}/health-report`, {
            method: "POST"
          });
          await loadConversations();
          onStatus("Da tao health report moi tu copilot.");
        } catch (error) {
          onStatus(error instanceof Error ? error.message : "Khong the tao health report.");
        }
      });
      return;
    }
  }

  function sendPrompt(prompt: string) {
    setDraft(prompt);
    const fakeEvent = { preventDefault() {} } as FormEvent<HTMLFormElement>;
    void submitMessage(fakeEvent, prompt);
  }

  function submitMessage(event: FormEvent<HTMLFormElement>, forcedMessage?: string) {
    event.preventDefault();
    const preparedMessage = (forcedMessage ?? draft).trim();
    if (!preparedMessage) {
      return;
    }

    const nextMessage = preparedMessage;
    setDraft("");

    startTransition(async () => {
      try {
        const response = await request<{
          conversationId: string;
          answer: string;
          suggestedActions: CopilotSuggestedAction[];
          cards: CopilotCard[];
          intent?: string;
        }>("/copilot/chat", {
          method: "POST",
          body: JSON.stringify({
            shopId,
            message: nextMessage,
            conversationId: activeConversationId || undefined
          })
        });

        await loadConversations();
        await loadConversation(response.conversationId);
        onStatus("Copilot da tra loi.");
      } catch (error) {
        setDraft(nextMessage);
        onStatus(error instanceof Error ? error.message : "Khong the gui tin nhan den copilot.");
      }
    });
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[280px_1fr]">
      <aside className="panel p-5">
        <p className="eyebrow">AI Copilot</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">Chat-first Operator</h3>
        <p className="mt-2 text-sm text-slate-300">{shopName}</p>

        <div className="soft-card mt-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operating mode</p>
          <div className="mt-3 grid gap-2">
            {(["ASSISTANT", "OPERATOR", "MANAGER"] as SellerOperatingMode[]).map((item) => (
              <button
                key={item}
                className={mode === item ? "shop-chip shop-chip-active" : "shop-chip"}
                onClick={() => {
                  startModeTransition(async () => {
                    try {
                      await onModeChange(item);
                    } catch (error) {
                      onStatus(error instanceof Error ? error.message : "Khong the doi mode.");
                    }
                  });
                }}
              >
                <span>{item}</span>
                <span className="text-xs text-slate-400">
                  {item === "ASSISTANT" ? "Chi tra loi" : item === "OPERATOR" ? "Tao action" : "Chu dong hon"}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">{modePending ? "Dang cap nhat mode..." : "Mode duoc luu cho seller."}</p>
        </div>

        <div className="soft-card mt-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Conversations</p>
          <div className="mt-3 grid gap-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className={activeConversationId === conversation.id ? "shop-chip shop-chip-active text-left" : "shop-chip text-left"}
                onClick={() => loadConversation(conversation.id).catch((error) => onStatus(error instanceof Error ? error.message : "Khong the tai conversation."))}
              >
                <span>{conversation.title}</span>
                <span className="text-xs text-slate-400">{new Date(conversation.updatedAt).toLocaleString("vi-VN")}</span>
              </button>
            ))}
            {conversations.length === 0 ? <p className="text-sm text-slate-400">Chua co hoi thoai nao. Hay bat dau chat.</p> : null}
          </div>
        </div>
      </aside>

      <section className="panel flex min-h-[70vh] flex-col p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="eyebrow">Wildberries Operations Manager</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">AI Copilot</h3>
            <p className="mt-2 text-sm text-slate-300">Hoi bang ngon ngu tu nhien. Copilot se tu goi tools va khong bat ban nho shop id hay endpoint.</p>
          </div>
          {latestHealthCard ? (
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 px-5 py-4 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">Health Score</p>
              <p className="mt-2 text-3xl font-semibold text-white">{latestHealthCard.healthScore}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="soft-card border-orange-300/20 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.24),rgba(15,23,42,0.92))]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">Xin chao. Toi la WB Operator AI.</p>
                  <p className="mt-3 max-w-2xl text-sm text-slate-200">
                    Toi co the giup ban tim nguyen nhan don giam, tra loi review tieng Nga, kiem tra SKU sap het hang, toi uu SEO san pham va goi y Telegram alert.
                  </p>
                </div>
                {isDemoMode ? <span className="chip">Demo Mode</span> : null}
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-300">
                <p>- Tim nguyen nhan don giam</p>
                <p>- Tra loi review tieng Nga</p>
                <p>- Kiem tra SKU sap het hang</p>
                <p>- Toi uu SEO san pham</p>
                <p>- Gui canh bao Telegram</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt) => (
                  <button key={prompt} className="button-secondary" onClick={() => sendPrompt(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={message.role === "user" ? "max-w-3xl rounded-3xl bg-orange-400 px-5 py-4 text-slate-950" : "max-w-3xl rounded-3xl bg-slate-900/80 px-5 py-4 text-white"}>
                <p className="text-xs uppercase tracking-[0.2em] opacity-70">{message.role === "user" ? "Ban" : message.role === "tool" ? "Tool" : "AI"}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{message.content}</p>

                {message.role === "assistant" ? (
                  <>
                    {readAssistantCards(message).length > 0 ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {readAssistantCards(message).map((card, index) => (
                          <CardRenderer key={`${message.id}-card-${index}`} card={card} />
                        ))}
                      </div>
                    ) : null}

                    {readAssistantActions(message).length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {readAssistantActions(message).map((action, index) => (
                          <button
                            key={`${message.id}-action-${index}`}
                            className="button-secondary"
                            onClick={() => handleSuggestedAction(action)}
                          >
                            {action.title}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <form className="mt-5 border-t border-white/10 pt-4" onSubmit={submitMessage}>
          <div className="grid gap-3">
            <textarea
              className="input min-h-[120px]"
              placeholder="Ban muon toi lam gi cho shop Wildberries nay?"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-400">Copilot uu tien: doanh thu, conversion, review, inventory, SEO, competitor.</p>
              <button className="button-primary" disabled={pending} type="submit">
                {pending ? "Dang phan tich..." : "Gui cho Copilot"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </section>
  );
}
