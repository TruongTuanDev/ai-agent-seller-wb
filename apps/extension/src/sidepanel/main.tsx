import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { apiRequest, getStoredToken } from "../lib/api";

type Shop = {
  id: string;
  name: string;
  status: string;
};

type Report = {
  healthScore: number;
  executiveSummary: string;
};

type Conversation = {
  id: string;
  title: string;
};

type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  metadataJson?: Record<string, unknown> | null;
};

function readCards(message: ConversationMessage) {
  return Array.isArray(message.metadataJson?.cards) ? (message.metadataJson?.cards as Array<Record<string, unknown>>) : [];
}

function readSuggestedActions(message: ConversationMessage) {
  return Array.isArray(message.metadataJson?.suggestedActions)
    ? (message.metadataJson?.suggestedActions as Array<Record<string, unknown>>)
    : [];
}

const promptSuggestions = [
  "Tai sao don giam?",
  "Review nao chua tra loi?",
  "SKU nao sap het hang?",
  "Toi uu san pham ban chay"
];

function SidePanel() {
  const [status, setStatus] = useState("Dang tai WB Operator AI...");
  const [tokenReady, setTokenReady] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [connected, setConnected] = useState(false);

  const selectedShop = useMemo(
    () => shops.find((shop) => shop.id === selectedShopId) ?? null,
    [selectedShopId, shops],
  );

  async function loadConversation(id: string) {
    const data = await apiRequest(`/copilot/conversations/${id}`) as {
      conversation: Conversation;
      messages: ConversationMessage[];
    };
    setConversationId(data.conversation.id);
    setMessages(data.messages);
  }

  async function loadForShop(shopId: string) {
    const [reportResponse, conversationResponse] = await Promise.all([
      apiRequest(`/reports/${shopId}/latest`) as Promise<{ report: Report | null }>,
      apiRequest(`/copilot/conversations?shopId=${encodeURIComponent(shopId)}`) as Promise<{ conversations: Conversation[] }>
    ]);

    setReport(reportResponse.report);
    setConversations(conversationResponse.conversations);
    if (conversationResponse.conversations[0]?.id) {
      await loadConversation(conversationResponse.conversations[0].id);
    } else {
      setConversationId("");
      setMessages([]);
    }
  }

  async function bootstrap() {
    try {
      const token = await getStoredToken();
      if (!token) {
        setStatus("Hay dang nhap backend o popup truoc khi dung Copilot.");
        setConnected(false);
        return;
      }

      setTokenReady(true);
      setConnected(true);
      const data = await apiRequest("/shops") as { shops: Shop[] };
      setShops(data.shops);
      const firstShop = data.shops[0];
      if (!firstShop) {
        setStatus("Chua co shop nao trong tai khoan nay.");
        return;
      }

      setSelectedShopId(firstShop.id);
      await loadForShop(firstShop.id);
      setStatus("San sang tro thanh WB Operations Manager cho shop cua ban.");
    } catch (error) {
      setConnected(false);
      setStatus(error instanceof Error ? error.message : "Khong the khoi tao side panel.");
    }
  }

  useEffect(() => {
    bootstrap().catch(() => undefined);
  }, []);

  async function submitChat(event: React.FormEvent<HTMLFormElement>, forcedMessage?: string) {
    event.preventDefault();
    const nextMessage = (forcedMessage ?? draft).trim();
    if (!nextMessage || !selectedShopId) {
      return;
    }

    if (!forcedMessage) {
      setDraft("");
    }
    setLoading(true);

    try {
      const response = await apiRequest("/copilot/chat", {
        method: "POST",
        body: JSON.stringify({
          shopId: selectedShopId,
          message: nextMessage,
          conversationId: conversationId || undefined
        })
      }) as { conversationId: string };

      await loadForShop(selectedShopId);
      await loadConversation(response.conversationId);
      setStatus("Copilot da phan tich xong.");
    } catch (error) {
      setDraft(nextMessage);
      setStatus(error instanceof Error ? error.message : "Khong the gui tin nhan.");
    } finally {
      setLoading(false);
    }
  }

  function sendPrompt(prompt: string) {
    setDraft(prompt);
    const fakeEvent = { preventDefault() {} } as React.FormEvent<HTMLFormElement>;
    void submitChat(fakeEvent, prompt);
  }

  function handleSuggestedAction(action: Record<string, unknown>) {
    const type = String(action.type ?? "");
    if (type === "RUN_PRODUCT_DOCTOR") {
      setStatus("Hay mo dashboard de xem Product Doctor chi tiet.");
      return;
    }

    if (type === "OPEN_REVIEW_QUEUE") {
      setStatus("Hay mo dashboard tab Reviews de xu ly review queue.");
      return;
    }

    if (type === "OPEN_ACTION_QUEUE") {
      setStatus("Hay mo dashboard tab Actions de approve va confirm lan 2.");
      return;
    }

    if (type === "CREATE_REVIEW_DRAFTS") {
      setStatus("Copilot de xuat tao review drafts an toan trong dashboard.");
      return;
    }

    if (type === "VIEW_INVENTORY_RISK") {
      setStatus("Copilot da danh dau nhom SKU ton kho rui ro.");
      return;
    }

    if (type === "RUN_HEALTH_REPORT" || type === "GENERATE_HEALTH_REPORT") {
      setStatus("Hay mo dashboard de lam moi health report.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", padding: 16, fontFamily: "system-ui", background: "#0f172a", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <p style={{ letterSpacing: "0.18em", textTransform: "uppercase", color: "#f59e0b", fontSize: 12 }}>WB Operator AI</p>
          <h1 style={{ fontSize: 26, marginTop: 8 }}>Chat-first Copilot</h1>
        </div>
        <span style={{ padding: "8px 12px", borderRadius: 999, background: connected ? "rgba(16,185,129,0.18)" : "rgba(248,113,113,0.18)", fontSize: 12 }}>
          {connected ? "Backend connected" : "Backend disconnected"}
        </span>
      </div>
      <p style={{ marginTop: 8, fontSize: 13, opacity: 0.82 }}>{status}</p>

      <div style={{ marginTop: 16, padding: 14, borderRadius: 18, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "#94a3b8" }}>Health Score</p>
            <p style={{ margin: "8px 0 0", fontSize: 32, fontWeight: 700 }}>{report?.healthScore ?? "--"}</p>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <select
              value={selectedShopId}
              onChange={(event) => {
                const nextShopId = event.target.value;
                setSelectedShopId(nextShopId);
                loadForShop(nextShopId).catch((error) => setStatus(error instanceof Error ? error.message : "Khong the doi shop."));
              }}
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "#111827", color: "#fff" }}
            >
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
            <p style={{ marginTop: 8, fontSize: 12, color: "#cbd5e1" }}>{selectedShop?.name ?? "Chua co shop"}</p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, marginTop: 16 }}>
        <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.04)", padding: 12 }}>
          <p style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "#94a3b8" }}>Conversations</p>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => loadConversation(conversation.id).catch((error) => setStatus(error instanceof Error ? error.message : "Khong the tai conversation."))}
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: conversationId === conversation.id ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.04)",
                  color: "#fff"
                }}
              >
                {conversation.title}
              </button>
            ))}
            {conversations.length === 0 ? <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Chua co chat nao</p> : null}
          </div>
        </div>

        <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.04)", padding: 12, display: "flex", flexDirection: "column", minHeight: 420 }}>
          <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: 10 }}>
            {messages.length === 0 ? (
              <div style={{ padding: 14, borderRadius: 18, background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(15,23,42,0.88))", color: "#cbd5e1", fontSize: 13 }}>
                <p style={{ marginTop: 0, fontSize: 18, color: "#fff", fontWeight: 700 }}>Xin chao. Toi la WB Operator AI.</p>
                <p style={{ lineHeight: 1.6 }}>Toi co the giup ban tim nguyen nhan don giam, tra loi review tieng Nga, kiem tra SKU sap het hang, toi uu SEO san pham va goi y Telegram alert.</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {promptSuggestions.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendPrompt(prompt)}
                      style={{ padding: "8px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 12 }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  justifySelf: message.role === "user" ? "end" : "start",
                  maxWidth: "92%",
                  padding: 12,
                  borderRadius: 16,
                  background: message.role === "user" ? "#f59e0b" : "rgba(255,255,255,0.07)",
                  color: message.role === "user" ? "#111827" : "#fff"
                }}
              >
                <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", opacity: 0.7 }}>
                  {message.role === "user" ? "Ban" : message.role === "tool" ? "Tool" : "AI"}
                </p>
                <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6 }}>{message.content}</p>

                {message.role === "assistant" && readCards(message).length > 0 ? (
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {readCards(message).map((card, index) => (
                      <div key={`${message.id}-card-${index}`} style={{ padding: 10, borderRadius: 12, background: "rgba(15,23,42,0.75)" }}>
                        <p style={{ margin: 0, fontWeight: 700 }}>{String(card.title ?? card.type ?? "Card")}</p>
                        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#cbd5e1" }}>
                          {String(card.summary ?? card.healthScore ?? "")}
                        </p>
                        {"severity" in card ? (
                          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#fda4af", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                            {String(card.severity)}
                          </p>
                        ) : null}
                        {"affectedSkus" in card && Array.isArray(card.affectedSkus) ? (
                          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#fde68a" }}>{card.affectedSkus.join(", ")}</p>
                        ) : null}
                        {"steps" in card && Array.isArray(card.steps) ? (
                          <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
                            {card.steps.slice(0, 3).map((step) => (
                              <p key={`${message.id}-${String(step.step)}`} style={{ margin: 0, fontSize: 11, color: "#bae6fd" }}>
                                {String(step.step)}. {String(step.reason ?? "")}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {message.role === "assistant" && readSuggestedActions(message).length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {readSuggestedActions(message).map((action, index) => (
                      <button
                        key={`${message.id}-action-${index}`}
                        onClick={() => handleSuggestedAction(action)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 999,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(249,115,22,0.18)",
                          color: "#fff",
                          fontSize: 12
                        }}
                      >
                        {String(action.title ?? "Suggested action")}
                      </button>
                    ))}
                  </div>
                ) : null}

                {showDebug && message.role === "assistant" ? (
                  <pre style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", fontSize: 11, color: "#94a3b8" }}>
                    {JSON.stringify(message.metadataJson ?? {}, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowDebug((current) => !current)}
            style={{
              alignSelf: "flex-start",
              marginTop: 10,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "transparent",
              color: "#cbd5e1",
              fontSize: 12
            }}
          >
            {showDebug ? "An debug details" : "Mo debug details"}
          </button>

          <form onSubmit={submitChat} style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ban muon toi lam gi?"
              disabled={!tokenReady}
              style={{
                width: "100%",
                minHeight: 110,
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#111827",
                color: "#fff"
              }}
            />
            <button
              type="submit"
              disabled={!tokenReady || loading}
              style={{
                padding: 12,
                borderRadius: 14,
                border: "none",
                background: "#f59e0b",
                color: "#111827",
                fontWeight: 700
              }}
            >
              {loading ? "Dang phan tich..." : "Gui cho Copilot"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<SidePanel />);
