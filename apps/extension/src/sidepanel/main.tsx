import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { clearAuthToken, getAuthToken, setAuthToken } from "../lib/auth";
import {
  apiRequest,
  clearActiveShopId,
  getActiveShopId,
  getApiBaseUrl,
  getDomContext,
  getWebBaseUrl,
  setActiveShopId,
  setApiBaseUrl,
  setWebBaseUrl,
  type ExtensionDomContext
} from "../lib/api";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: "FREE" | "PRO" | "AGENCY";
  copilotMode: "ASSISTANT" | "OPERATOR" | "MANAGER";
};

type Usage = {
  plan: "FREE" | "PRO" | "AGENCY";
  remaining: {
    reviewDrafts: number;
    healthReports: number;
  };
};

type Shop = {
  id: string;
  name: string;
  wbSellerId: string;
  status: string;
  tokenScopes?: string[];
};

type Product = {
  id: string;
  wbNmId: string;
  vendorCode: string;
  title: string;
  stock: number;
  rating: number;
  price: number;
};

type Feedback = {
  id: string;
  wbFeedbackId: string;
  rating: number;
  text: string;
  status: string;
  aiReplyDraft?: string | null;
  product?: Product | null;
};

type Action = {
  id: string;
  type: string;
  title: string;
  status: string;
  payloadJson?: Record<string, unknown>;
};

type ShopDetail = {
  id: string;
  name: string;
  wbSellerId: string;
  status: string;
  tokenScopes?: string[];
  products?: Product[];
  feedbacks?: Feedback[];
  actions?: Action[];
  snapshots?: Array<{
    date?: string;
    revenue: number;
    ordersCount: number;
  }>;
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

type ProductProblem = {
  productId: string;
  wbNmId: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasons: string[];
  metrics: {
    rating: number;
    reviewCount: number;
    stock: number;
    price: number;
    unansweredReviews: number;
  };
};

type WbStatus = {
  mode: "mock" | "real";
  writeMode: "mock" | "dry_run" | "real_write";
  connection?: {
    seller?: { name?: string; sid?: string; tradeMark?: string; tin?: string };
    scopes?: string[];
    capabilities?: string[];
    errors?: string[];
  };
};

type WbConnectionResult = {
  ok: boolean;
  mode: "mock" | "real";
  seller?: { name?: string; sid?: string; tradeMark?: string; tin?: string };
  scopes: string[];
  capabilities: string[];
  errors: string[];
};

type SuggestedAction = {
  type:
    | "OPEN_REVIEW_QUEUE"
    | "RUN_PRODUCT_DOCTOR"
    | "CREATE_REVIEW_DRAFTS"
    | "VIEW_INVENTORY_RISK"
    | "OPEN_ACTION_QUEUE"
    | "RUN_HEALTH_REPORT"
    | "GENERATE_HEALTH_REPORT"
    | "OPEN_WEB_DASHBOARD";
  title: string;
  payload?: Record<string, unknown>;
};

type WorkspaceTab = "chat" | "reviews" | "actions" | "inventory";

const demoCredentials = {
  email: "demo@wb-agent.local",
  password: "Demo123456!"
};

const promptSuggestions = [
  "Tai sao don giam?",
  "Review nao chua tra loi?",
  "SKU nao sap het hang?",
  "Toi uu san pham nay",
  "Bao cao hom nay"
];

function readCards(message: ConversationMessage) {
  return Array.isArray(message.metadataJson?.cards) ? (message.metadataJson?.cards as Array<Record<string, unknown>>) : [];
}

function readSuggestedActions(message: ConversationMessage) {
  return Array.isArray(message.metadataJson?.suggestedActions)
    ? (message.metadataJson?.suggestedActions as SuggestedAction[])
    : [];
}

function formatConnectionStatus(shop?: Shop | null) {
  if (!shop) {
    return "Chua co shop";
  }
  if (shop.status === "DISCONNECTED") {
    return "Can reconnect";
  }
  return "Connected";
}

function buildContextAwareMessage(message: string, domContext: ExtensionDomContext | null) {
  if (!domContext) {
    return message;
  }

  const normalized = message.toLowerCase();
  const shouldAttachContext =
    normalized.includes("san pham nay") ||
    normalized.includes("sku nay") ||
    normalized.includes("trang nay") ||
    normalized.includes("toi uu") ||
    normalized.includes("review nay") ||
    normalized.includes("hien tai");

  if (!shouldAttachContext) {
    return message;
  }

  const contextLines = [
    `Ngu canh extension: pageType=${domContext.pageType}`,
    domContext.productId ? `productId=${domContext.productId}` : "",
    domContext.sku ? `sku=${domContext.sku}` : "",
    domContext.url ? `url=${domContext.url}` : "",
    domContext.visibleTextSummary ? `visibleTextSummary=${domContext.visibleTextSummary}` : ""
  ].filter(Boolean);

  return `${message}\n\n${contextLines.join("\n")}`;
}

function cardAccent(type: string) {
  switch (type) {
    case "insight":
      return "#f59e0b";
    case "productRisk":
      return "#fb7185";
    case "reviewQueue":
      return "#38bdf8";
    case "inventoryRisk":
      return "#f97316";
    case "usageLimit":
      return "#22c55e";
    default:
      return "#c084fc";
  }
}

function ShopCard({
  title,
  body,
  accent,
  footer
}: {
  title: string;
  body: string;
  accent: string;
  footer?: string;
}) {
  return (
    <div style={{ padding: 12, borderRadius: 16, background: "rgba(15,23,42,0.82)", border: `1px solid ${accent}33` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <p style={{ margin: 0, fontWeight: 700, color: "#fff" }}>{title}</p>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: accent, marginTop: 4 }} />
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.6, color: "#cbd5e1" }}>{body}</p>
      {footer ? <p style={{ margin: "10px 0 0", fontSize: 11, color: accent }}>{footer}</p> : null}
    </div>
  );
}

function SidePanel() {
  const [status, setStatus] = useState("Dang tai WB Operator AI...");
  const [connected, setConnected] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [activeShopId, setActiveShopIdState] = useState("");
  const [selectedShop, setSelectedShop] = useState<ShopDetail | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [wbStatus, setWbStatus] = useState<WbStatus | null>(null);
  const [productProblems, setProductProblems] = useState<ProductProblem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("chat");
  const [showAddShopModal, setShowAddShopModal] = useState(false);
  const [shopFormId, setShopFormId] = useState("");
  const [shopName, setShopName] = useState("");
  const [wbToken, setWbToken] = useState("");
  const [testConnection, setTestConnection] = useState<WbConnectionResult | null>(null);
  const [testingToken, setTestingToken] = useState(false);
  const [savingShop, setSavingShop] = useState(false);
  const [syncingTask, setSyncingTask] = useState("");
  const [apiBaseUrl, setApiBaseUrlState] = useState("http://localhost:4000");
  const [webBaseUrl, setWebBaseUrlState] = useState("http://localhost:3000");
  const [email, setEmail] = useState(demoCredentials.email);
  const [password, setPassword] = useState(demoCredentials.password);
  const [domContext, setDomContext] = useState<ExtensionDomContext | null>(null);
  const [confirmAction, setConfirmAction] = useState<Action | null>(null);

  const feedbacks = selectedShop?.feedbacks ?? [];
  const actions = selectedShop?.actions ?? [];
  const reviewQueue = useMemo(
    () => feedbacks.filter((feedback) => feedback.status !== "SENT"),
    [feedbacks]
  );
  const criticalProblems = useMemo(
    () => productProblems.filter((problem) => problem.severity === "CRITICAL" || problem.severity === "HIGH"),
    [productProblems]
  );
  const healthScore = report?.healthScore ?? null;
  const isDemoMode = (wbStatus?.mode ?? "mock") === "mock" || activeShopId.startsWith("shop-demo");

  async function openWebDashboard(path = "") {
    const base = webBaseUrl.trim() || "http://localhost:3000";
    await chrome.tabs.create({ url: `${base}${path}` });
  }

  async function loadConversation(nextConversationId: string) {
    const data = await apiRequest(`/copilot/conversations/${nextConversationId}`) as {
      conversation: Conversation;
      messages: ConversationMessage[];
    };
    setConversationId(data.conversation.id);
    setMessages(data.messages);
  }

  async function loadActiveShop(nextShopId: string) {
    const [detail, latestReport, problemsResponse, conversationResponse, wbResponse] = await Promise.all([
      apiRequest(`/shops/${nextShopId}`) as Promise<{ shop: ShopDetail }>,
      apiRequest(`/reports/${nextShopId}/latest`) as Promise<{ report: Report | null }>,
      apiRequest(`/products/${nextShopId}/problems`) as Promise<{ problems: ProductProblem[] }>,
      apiRequest(`/copilot/conversations?shopId=${encodeURIComponent(nextShopId)}`) as Promise<{ conversations: Conversation[] }>,
      apiRequest(`/wb/${nextShopId}/status`) as Promise<WbStatus>
    ]);

    setSelectedShop(detail.shop);
    setReport(latestReport.report);
    setProductProblems(problemsResponse.problems);
    setConversations(conversationResponse.conversations);
    setWbStatus(wbResponse);

    if (conversationResponse.conversations[0]?.id) {
      await loadConversation(conversationResponse.conversations[0].id);
    } else {
      setConversationId("");
      setMessages([]);
    }
  }

  async function loadWorkspace() {
    const [me, shopsResponse, storedShopId, context] = await Promise.all([
      apiRequest("/auth/me") as Promise<{ user: User; usage: Usage }>,
      apiRequest("/shops") as Promise<{ shops: Shop[] }>,
      getActiveShopId(),
      getDomContext()
    ]);

    setUser(me.user);
    setUsage(me.usage);
    setShops(shopsResponse.shops);
    setDomContext(context);

    const preferredShop =
      shopsResponse.shops.find((shop) => shop.id === storedShopId) ??
      shopsResponse.shops.find((shop) => shop.status !== "DISCONNECTED") ??
      shopsResponse.shops[0];

    if (!preferredShop) {
      setActiveShopIdState("");
      setSelectedShop(null);
      setReport(null);
      setProductProblems([]);
      setConversations([]);
      setMessages([]);
      setStatus("Chua ket noi shop Wildberries nao. Ban co the them shop moi hoac dung Demo Shop.");
      return;
    }

    setActiveShopIdState(preferredShop.id);
    await setActiveShopId(preferredShop.id);
    await loadActiveShop(preferredShop.id);
    setStatus("Copilot da san sang. Ban co the hoi shop bang ngon ngu tu nhien.");
  }

  async function bootstrap() {
    const [storedApiBaseUrl, storedWebBaseUrl, storedToken, context] = await Promise.all([
      getApiBaseUrl(),
      getWebBaseUrl(),
      getAuthToken(),
      getDomContext()
    ]);

    setApiBaseUrlState(storedApiBaseUrl);
    setWebBaseUrlState(storedWebBaseUrl);
    setDomContext(context);

    if (!storedToken) {
      setConnected(false);
      setTokenReady(false);
      setStatus("Dang nhap ngay trong side panel de dung Copilot. Popup khong con can cho auth nua.");
      return;
    }

    setConnected(true);
    setTokenReady(true);

    try {
      await loadWorkspace();
    } catch (error) {
      setConnected(false);
      setTokenReady(false);
      await clearAuthToken();
      await clearActiveShopId();
      setStatus(error instanceof Error ? error.message : "Khong the ket noi backend.");
    }
  }

  useEffect(() => {
    void bootstrap();
  }, []);

  async function handleLogin(nextEmail: string, nextPassword: string) {
    try {
      await setApiBaseUrl(apiBaseUrl.trim() || "http://localhost:4000");
      await setWebBaseUrl(webBaseUrl.trim() || "http://localhost:3000");
      const response = await fetch(`${(apiBaseUrl.trim() || "http://localhost:4000")}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail, password: nextPassword })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.token) {
        throw new Error(payload?.message ?? "Dang nhap that bai.");
      }

      await setAuthToken(String(payload.token));
      setConnected(true);
      setTokenReady(true);
      setStatus("Dang nhap thanh cong. Dang tai shop va Copilot...");
      await loadWorkspace();
    } catch (error) {
      setConnected(false);
      setTokenReady(false);
      setStatus(error instanceof Error ? error.message : "Dang nhap that bai.");
    }
  }

  async function handleLogout() {
    await clearAuthToken();
    await clearActiveShopId();
    setConnected(false);
    setTokenReady(false);
    setUser(null);
    setUsage(null);
    setShops([]);
    setActiveShopIdState("");
    setSelectedShop(null);
    setReport(null);
    setProductProblems([]);
    setConversations([]);
    setConversationId("");
    setMessages([]);
    setStatus("Da dang xuat khoi extension.");
  }

  async function selectShop(nextShopId: string) {
    setActiveShopIdState(nextShopId);
    await setActiveShopId(nextShopId);
    await loadActiveShop(nextShopId);
    setStatus("Da chuyen shop. Copilot se chi dung du lieu cua shop hien tai.");
  }

  function openAddShopModal(shop?: ShopDetail | Shop | null) {
    setShopFormId(shop?.id ?? "");
    setShopName(shop?.name ?? "");
    setWbToken("");
    setTestConnection(null);
    setShowAddShopModal(true);
  }

  async function testToken() {
    if (!wbToken.trim()) {
      setStatus("Hay dan WB API Key truoc khi test.");
      return;
    }

    setTestingToken(true);
    try {
      const result = await apiRequest("/shops/test-token", {
        method: "POST",
        body: JSON.stringify({ token: wbToken.trim() })
      }) as WbConnectionResult;
      setTestConnection(result);
      setStatus(result.ok ? "Test key thanh cong." : "Key chua hop le hoac chua du quyen.");
    } catch (error) {
      setTestConnection(null);
      setStatus(error instanceof Error ? error.message : "Khong the test key.");
    } finally {
      setTestingToken(false);
    }
  }

  async function saveShop() {
    if (!shopName.trim() || !wbToken.trim()) {
      setStatus("Hay nhap ten shop va WB API Key.");
      return;
    }

    setSavingShop(true);
    try {
      const result = await apiRequest("/shops/connect-token", {
        method: "POST",
        body: JSON.stringify({
          shopId: shopFormId || undefined,
          name: shopName.trim(),
          wbSellerId: testConnection?.seller?.sid ?? "pending",
          token: wbToken.trim(),
          tokenScopes: testConnection?.scopes ?? []
        })
      }) as { shop: Shop };

      setWbToken("");
      setShowAddShopModal(false);
      await loadWorkspace();
      await selectShop(result.shop.id);
      setStatus("Da luu shop va ma hoa token o backend.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Khong the luu shop.");
    } finally {
      setSavingShop(false);
      setWbToken("");
    }
  }

  async function disconnectShop() {
    if (!activeShopId) {
      return;
    }

    try {
      await apiRequest(`/shops/${activeShopId}`, { method: "DELETE" });
      await loadWorkspace();
      setStatus("Da disconnect shop khoi extension. Ban van co the reconnect sau.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Khong the disconnect shop.");
    }
  }

  async function syncTask(task: "products" | "feedbacks" | "analytics" | "health") {
    if (!activeShopId) {
      return;
    }

    setSyncingTask(task);
    try {
      if (task === "health") {
        await apiRequest(`/ai/${activeShopId}/health-report`, { method: "POST" });
      } else {
        const result = await apiRequest(`/wb/${activeShopId}/sync/${task}`, { method: "POST" }) as { warning?: string };
        if (result.warning) {
          setStatus(`Sync ${task} hoan tat, nhung analytics dang fallback mock: ${result.warning}`);
        }
      }
      await loadActiveShop(activeShopId);
      if (task !== "analytics") {
        setStatus(`Da sync ${task} cho shop hien tai.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Khong the sync ${task}.`);
    } finally {
      setSyncingTask("");
    }
  }

  async function submitChat(event: React.FormEvent<HTMLFormElement>, forcedMessage?: string) {
    event.preventDefault();
    const rawMessage = (forcedMessage ?? draft).trim();
    if (!rawMessage || !activeShopId) {
      return;
    }

    if (!forcedMessage) {
      setDraft("");
    }

    setLoadingChat(true);
    try {
      const response = await apiRequest("/copilot/chat", {
        method: "POST",
        body: JSON.stringify({
          shopId: activeShopId,
          message: buildContextAwareMessage(rawMessage, domContext),
          conversationId: conversationId || undefined
        })
      }) as { conversationId: string };
      await loadActiveShop(activeShopId);
      await loadConversation(response.conversationId);
      setWorkspaceTab("chat");
      setStatus("Copilot da phan tich xong va cap nhat hoi thoai cho shop hien tai.");
    } catch (error) {
      setDraft(rawMessage);
      setStatus(error instanceof Error ? error.message : "Khong the gui chat.");
    } finally {
      setLoadingChat(false);
    }
  }

  async function createReviewDrafts() {
    if (!activeShopId) {
      return;
    }

    try {
      await apiRequest(`/ai/${activeShopId}/review-reply-draft`, {
        method: "POST",
        body: JSON.stringify({ tone: "professional" })
      });
      await loadActiveShop(activeShopId);
      setWorkspaceTab("reviews");
      setStatus("Da tao them review draft o che do an toan.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Khong the tao review draft.");
    }
  }

  async function updateAction(actionId: string, nextAction: "approve" | "reject") {
    try {
      await apiRequest(`/actions/${actionId}/${nextAction}`, { method: "POST" });
      if (activeShopId) {
        await loadActiveShop(activeShopId);
      }
      setStatus(nextAction === "approve" ? "Da approve action." : "Da reject action.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Khong the cap nhat action.");
    }
  }

  async function executeAction(action: Action, confirmReplySend: boolean) {
    try {
      await apiRequest(`/actions/${action.id}/execute`, {
        method: "POST",
        body: JSON.stringify({
          confirmDangerous: true,
          confirmReplySend
        })
      });
      if (activeShopId) {
        await loadActiveShop(activeShopId);
      }
      setConfirmAction(null);
      setStatus("Da execute action voi approval flow giu nguyen.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Khong the execute action.");
    }
  }

  async function handleSuggestedAction(action: SuggestedAction) {
    switch (action.type) {
      case "OPEN_REVIEW_QUEUE":
        setWorkspaceTab("reviews");
        setStatus("Da mo Review Queue trong extension.");
        return;
      case "VIEW_INVENTORY_RISK":
        setWorkspaceTab("inventory");
        setStatus("Da mo Inventory Risk trong extension.");
        return;
      case "OPEN_ACTION_QUEUE":
        setWorkspaceTab("actions");
        setStatus("Da mo Action Queue trong extension.");
        return;
      case "RUN_HEALTH_REPORT":
      case "GENERATE_HEALTH_REPORT":
        await syncTask("health");
        return;
      case "CREATE_REVIEW_DRAFTS":
        await createReviewDrafts();
        return;
      case "RUN_PRODUCT_DOCTOR": {
        const productId = String(action.payload?.productId ?? "");
        if (productId) {
          await openWebDashboard(`/products/${productId}/doctor`);
          setStatus("Da mo Product Doctor tren web dashboard de xem draft chi tiet.");
          return;
        }
        setStatus("Copilot chua tim thay productId cu the cho Product Doctor.");
        return;
      }
      case "OPEN_WEB_DASHBOARD":
        await openWebDashboard(String(action.payload?.path ?? ""));
        return;
      default:
        setStatus("Suggested action nay chua co mapping trong extension.");
    }
  }

  const selectedShopSummary = useMemo(
    () => shops.find((shop) => shop.id === activeShopId) ?? null,
    [activeShopId, shops]
  );

  if (!tokenReady) {
    return (
      <div style={{ minHeight: "100vh", padding: 18, fontFamily: "system-ui", background: "radial-gradient(circle at top, #1e293b 0%, #0f172a 54%, #020617 100%)", color: "#fff" }}>
        <div style={{ padding: 18, borderRadius: 24, background: "rgba(15,23,42,0.88)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "#f59e0b" }}>WB Operator AI</p>
          <h1 style={{ margin: "10px 0 0", fontSize: 28, lineHeight: 1.2 }}>Dang nhap ngay trong side panel</h1>
          <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: "#cbd5e1" }}>
            Extension nay gio la trung tam van hanh. Ban khong can popup de login, khong can nho shopId, khong can paste raw JWT.
          </p>

          <div style={{ marginTop: 18, padding: 16, borderRadius: 20, background: "linear-gradient(135deg, rgba(249,115,22,0.18), rgba(15,23,42,0.92))" }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Xin chao. Toi la WB Operator AI.</p>
            <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.7, color: "#e2e8f0" }}>
              Toi co the tim nguyen nhan don giam, tra loi review tieng Nga, kiem tra SKU sap het hang, toi uu san pham va doi shop ngay trong extension.
            </p>
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
            <input value={apiBaseUrl} onChange={(event) => setApiBaseUrlState(event.target.value)} placeholder="API URL" style={inputStyle()} />
            <input value={webBaseUrl} onChange={(event) => setWebBaseUrlState(event.target.value)} placeholder="Web URL" style={inputStyle()} />
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" style={inputStyle()} />
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mat khau" type="password" style={inputStyle()} />
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <button
              onClick={() => {
                void handleLogin(email, password);
              }}
              style={primaryButtonStyle()}
            >
              Dang nhap
            </button>
            <button
              onClick={() => {
                setEmail(demoCredentials.email);
                setPassword(demoCredentials.password);
                void handleLogin(demoCredentials.email, demoCredentials.password);
              }}
              style={secondaryButtonStyle()}
            >
              Dung Demo
            </button>
          </div>

          <p style={{ marginTop: 14, fontSize: 12, color: "#94a3b8" }}>{status}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 16, fontFamily: "system-ui", background: "radial-gradient(circle at top, #1e293b 0%, #0f172a 48%, #020617 100%)", color: "#fff" }}>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ padding: 16, borderRadius: 24, background: "rgba(15,23,42,0.88)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#f59e0b" }}>WB Operator AI</p>
              <h1 style={{ margin: "8px 0 0", fontSize: 26 }}>Multi-shop Copilot</h1>
            </div>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <span style={{ padding: "8px 12px", borderRadius: 999, background: connected ? "rgba(16,185,129,0.18)" : "rgba(248,113,113,0.18)", fontSize: 12 }}>
                {connected ? "Backend connected" : "Backend disconnected"}
              </span>
              {isDemoMode ? <span style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(249,115,22,0.18)", fontSize: 11, color: "#fdba74" }}>Demo Mode</span> : null}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "104px 1fr auto", gap: 12, marginTop: 14, alignItems: "center" }}>
            <div style={{ padding: 14, borderRadius: 18, background: "rgba(255,255,255,0.05)" }}>
              <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>Health</p>
              <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 700 }}>{healthScore ?? "--"}</p>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <select
                value={activeShopId}
                onChange={(event) => {
                  void selectShop(event.target.value).catch((error) => {
                    setStatus(error instanceof Error ? error.message : "Khong the doi shop.");
                  });
                }}
                style={selectStyle()}
              >
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>{shop.name} {shop.status === "DISCONNECTED" ? "(Can reconnect)" : ""}</option>
                ))}
              </select>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, color: "#cbd5e1" }}>
                <span>{selectedShopSummary?.name ?? "Chua co shop"}</span>
                <span>•</span>
                <span>{formatConnectionStatus(selectedShopSummary)}</span>
                {wbStatus?.connection?.seller?.sid ? (
                  <>
                    <span>•</span>
                    <span>Seller ID {wbStatus.connection.seller.sid}</span>
                  </>
                ) : null}
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <button onClick={() => openAddShopModal(selectedShopSummary)} style={secondaryButtonStyle()}>
                + Shop
              </button>
              <button
                onClick={() => {
                  void syncTask("products");
                }}
                style={secondaryButtonStyle(syncingTask === "products")}
              >
                {syncingTask === "products" ? "Sync..." : "Sync"}
              </button>
            </div>
          </div>

          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>{status}</p>
        </div>

        {!selectedShop ? (
          <div style={{ padding: 18, borderRadius: 24, background: "rgba(15,23,42,0.88)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Chua ket noi shop Wildberries</p>
            <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: "#cbd5e1" }}>
              1. Tao token tren Wildberries Developer Portal. 2. Dan key vao extension. 3. Bam Test Key va Save Shop.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
              <button onClick={() => openAddShopModal(null)} style={primaryButtonStyle()}>
                Them Shop
              </button>
              <button
                onClick={() => {
                  void handleLogin(demoCredentials.email, demoCredentials.password);
                }}
                style={secondaryButtonStyle()}
              >
                Dung Demo Shop
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(["chat", "reviews", "inventory", "actions"] as WorkspaceTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setWorkspaceTab(tab)}
                  style={tabChipStyle(workspaceTab === tab)}
                >
                  {tab === "chat" ? "AI Copilot" : tab === "reviews" ? "Review Queue" : tab === "inventory" ? "Inventory Risk" : "Action Queue"}
                </button>
              ))}
              <button onClick={() => { void syncTask("feedbacks"); }} style={secondaryButtonStyle(syncingTask === "feedbacks")}>
                {syncingTask === "feedbacks" ? "Sync..." : "Sync Feedbacks"}
              </button>
              <button onClick={() => { void syncTask("analytics"); }} style={secondaryButtonStyle(syncingTask === "analytics")}>
                {syncingTask === "analytics" ? "Sync..." : "Sync Analytics"}
              </button>
              <button onClick={() => { void syncTask("health"); }} style={secondaryButtonStyle(syncingTask === "health")}>
                {syncingTask === "health" ? "Refresh..." : "Refresh Health"}
              </button>
              <button onClick={() => openAddShopModal(selectedShopSummary)} style={secondaryButtonStyle()}>
                Reconnect
              </button>
              <button onClick={() => { void disconnectShop(); }} style={ghostDangerButtonStyle()}>
                Disconnect
              </button>
            </div>

            {workspaceTab === "chat" ? (
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                <div style={{ padding: 12, borderRadius: 20, background: "rgba(255,255,255,0.04)" }}>
                  <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>Conversations</p>
                  <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {conversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        onClick={() => {
                          void loadConversation(conversation.id).catch((error) => {
                            setStatus(error instanceof Error ? error.message : "Khong the tai chat.");
                          });
                        }}
                        style={{
                          padding: 10,
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: conversationId === conversation.id ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.04)",
                          color: "#fff",
                          textAlign: "left",
                          fontSize: 12
                        }}
                      >
                        {conversation.title}
                      </button>
                    ))}
                    {conversations.length === 0 ? <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Chua co chat nao</p> : null}
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 20, background: "rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", minHeight: 520 }}>
                  <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: 10 }}>
                    {messages.length === 0 ? (
                      <div style={{ padding: 16, borderRadius: 20, background: "linear-gradient(135deg, rgba(249,115,22,0.18), rgba(15,23,42,0.9))" }}>
                        <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Xin chao 👋 Toi la WB Operator AI.</p>
                        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.8, color: "#e2e8f0" }}>
                          Toi co the giup ban tim nguyen nhan don giam, tra loi review tieng Nga, kiem tra SKU sap het hang, toi uu SEO san pham va gui canh bao Telegram.
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                          {promptSuggestions.map((prompt) => (
                            <button
                              key={prompt}
                              onClick={() => {
                                const fakeEvent = { preventDefault() {} } as React.FormEvent<HTMLFormElement>;
                                void submitChat(fakeEvent, prompt);
                              }}
                              style={promptButtonStyle()}
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
                          borderRadius: 18,
                          background: message.role === "user" ? "#f59e0b" : "rgba(255,255,255,0.07)",
                          color: message.role === "user" ? "#111827" : "#fff"
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.78 }}>
                          {message.role === "user" ? "Ban" : message.role === "tool" ? "Tool" : "AI"}
                        </p>
                        <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.7 }}>{message.content}</p>

                        {message.role === "assistant" && readCards(message).length > 0 ? (
                          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                            {readCards(message).map((card, index) => (
                              <ShopCard
                                key={`${message.id}-card-${index}`}
                                title={String(card.title ?? card.type ?? "Card")}
                                body={String(card.summary ?? card.healthScore ?? "")}
                                accent={cardAccent(String(card.type ?? ""))}
                                footer={
                                  typeof card.severity === "string"
                                    ? `Severity ${String(card.severity)}`
                                    : Array.isArray(card.affectedSkus)
                                      ? `SKU ${card.affectedSkus.join(", ")}`
                                      : undefined
                                }
                              />
                            ))}
                          </div>
                        ) : null}

                        {message.role === "assistant" && readSuggestedActions(message).length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                            {readSuggestedActions(message).map((action, index) => (
                              <button
                                key={`${message.id}-action-${index}`}
                                onClick={() => {
                                  void handleSuggestedAction(action);
                                }}
                                style={promptButtonStyle("#fb923c")}
                              >
                                {action.title}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {showDebug && message.role === "assistant" ? (
                          <pre style={{ margin: "10px 0 0", fontSize: 11, whiteSpace: "pre-wrap", color: "#94a3b8" }}>
                            {JSON.stringify(message.metadataJson ?? {}, null, 2)}
                          </pre>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <button onClick={() => setShowDebug((current) => !current)} style={secondaryButtonStyle()}>
                      {showDebug ? "An debug details" : "Mo debug details"}
                    </button>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>
                      {domContext ? `Ngu canh ${domContext.pageType}${domContext.sku ? ` • ${domContext.sku}` : ""}` : "Chua doc duoc ngu canh trang"}
                    </span>
                  </div>

                  <form onSubmit={submitChat} style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Ban muon toi lam gi?"
                      style={{
                        width: "100%",
                        minHeight: 110,
                        padding: 12,
                        borderRadius: 16,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "#111827",
                        color: "#fff"
                      }}
                    />
                    <button type="submit" disabled={loadingChat} style={primaryButtonStyle(loadingChat)}>
                      {loadingChat ? "Dang phan tich..." : "Gui cho Copilot"}
                    </button>
                  </form>
                </div>
              </div>
            ) : null}

            {workspaceTab === "reviews" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Review Queue</p>
                    <p style={{ margin: "8px 0 0", fontSize: 13, color: "#cbd5e1" }}>{reviewQueue.length} review chua gui phan hoi.</p>
                  </div>
                  <button onClick={() => { void createReviewDrafts(); }} style={primaryButtonStyle()}>
                    Tao AI Draft
                  </button>
                </div>
                {reviewQueue.map((feedback) => {
                  const replyAction = actions.find((action) => String(action.payloadJson?.feedbackId ?? "") === feedback.id && action.type === "REPLY_REVIEW");
                  return (
                    <div key={feedback.id} style={panelCardStyle()}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700 }}>{feedback.product?.title ?? "SKU khong ro"} • {feedback.rating}/5</p>
                          <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.7, color: "#cbd5e1" }}>{feedback.text}</p>
                          {feedback.aiReplyDraft ? (
                            <p style={{ margin: "10px 0 0", padding: 12, borderRadius: 14, background: "rgba(16,185,129,0.12)", fontSize: 12, color: "#d1fae5", whiteSpace: "pre-wrap" }}>
                              {feedback.aiReplyDraft}
                            </p>
                          ) : null}
                        </div>
                        <span style={severityBadgeStyle(feedback.rating <= 3 ? "HIGH" : "LOW")}>{feedback.status}</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                        <button
                          onClick={() => {
                            void apiRequest(`/ai/${activeShopId}/review-reply-draft`, {
                              method: "POST",
                              body: JSON.stringify({ feedbackId: feedback.id, tone: "professional" })
                            }).then(async () => {
                              await loadActiveShop(activeShopId);
                              setStatus("Da tao draft review tieng Nga.");
                            }).catch((error) => {
                              setStatus(error instanceof Error ? error.message : "Khong the tao draft.");
                            });
                          }}
                          style={secondaryButtonStyle()}
                        >
                          AI Draft
                        </button>
                        {replyAction ? (
                          <>
                            <button onClick={() => { void updateAction(replyAction.id, "approve"); }} style={secondaryButtonStyle()}>
                              Approve
                            </button>
                            <button onClick={() => { void updateAction(replyAction.id, "reject"); }} style={secondaryButtonStyle()}>
                              Reject
                            </button>
                            <button onClick={() => setConfirmAction(replyAction)} style={primaryButtonStyle()}>
                              Send
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {workspaceTab === "inventory" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Inventory & Product Risk</p>
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#cbd5e1" }}>SKU sap het hang, rating thap va review risk deu duoc gom tai day.</p>
                </div>
                {criticalProblems.map((problem) => (
                  <div key={problem.productId} style={panelCardStyle()}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700 }}>{problem.title}</p>
                        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#cbd5e1" }}>SKU {problem.wbNmId} • Ton {problem.metrics.stock} • Rating {problem.metrics.rating}</p>
                        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.7, color: "#e2e8f0" }}>{problem.reasons.join(" • ")}</p>
                      </div>
                      <span style={severityBadgeStyle(problem.severity)}>{problem.severity}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                      <button
                        onClick={() => {
                          void openWebDashboard(`/products/${problem.productId}/doctor`);
                        }}
                        style={primaryButtonStyle()}
                      >
                        Mo Product Doctor
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {workspaceTab === "actions" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Action Queue</p>
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#cbd5e1" }}>Approval flow va confirm lan 2 van duoc giu nguyen.</p>
                </div>
                {actions.map((action) => (
                  <div key={action.id} style={panelCardStyle()}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700 }}>{action.title}</p>
                        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#cbd5e1" }}>{action.type}</p>
                      </div>
                      <span style={severityBadgeStyle(action.type === "REPLY_REVIEW" ? "CRITICAL" : "MEDIUM")}>{action.status}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                      <button onClick={() => { void updateAction(action.id, "approve"); }} style={secondaryButtonStyle()}>
                        Approve
                      </button>
                      <button onClick={() => { void updateAction(action.id, "reject"); }} style={secondaryButtonStyle()}>
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          if (action.type === "REPLY_REVIEW") {
                            setConfirmAction(action);
                            return;
                          }
                          void executeAction(action, true);
                        }}
                        style={primaryButtonStyle()}
                      >
                        Execute
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>

      {showAddShopModal ? (
        <div style={modalOverlayStyle()}>
          <div style={modalPanelStyle()}>
            <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#f59e0b" }}>Them / reconnect shop</p>
            <h2 style={{ margin: "10px 0 0", fontSize: 24 }}>Ket noi Wildberries shop</h2>
            <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: "#cbd5e1" }}>
              1. Vao Wildberries Developer Portal. 2. Tao token voi quyen can thiet. 3. Dan key vao day. 4. Bam Test Key truoc khi Save Shop.
            </p>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <input value={shopName} onChange={(event) => setShopName(event.target.value)} placeholder="Shop Name" style={inputStyle()} />
              <textarea value={wbToken} onChange={(event) => setWbToken(event.target.value)} placeholder="WB API Key" style={{ ...inputStyle(), minHeight: 120, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
              <button onClick={() => { void testToken(); }} style={secondaryButtonStyle(testingToken)}>
                {testingToken ? "Dang test..." : "Test Key"}
              </button>
              <button onClick={() => { void saveShop(); }} style={primaryButtonStyle(savingShop)}>
                {savingShop ? "Dang luu..." : "Save Shop"}
              </button>
              <button onClick={() => setShowAddShopModal(false)} style={secondaryButtonStyle()}>
                Dong
              </button>
            </div>

            {testConnection ? (
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <div style={panelCardStyle()}>
                  <p style={{ margin: 0, fontWeight: 700 }}>Seller info</p>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "#cbd5e1" }}>
                    {testConnection.seller?.tradeMark ?? testConnection.seller?.name ?? "Khong xac dinh"} • Seller ID {testConnection.seller?.sid ?? "pending"}
                  </p>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "#cbd5e1" }}>Scopes: {testConnection.scopes.join(", ") || "Khong xac dinh"}</p>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: testConnection.errors.length > 0 ? "#fdba74" : "#86efac" }}>
                    {testConnection.errors.length > 0 ? testConnection.errors.join(" | ") : "Key hop le va co the connect."}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {confirmAction ? (
        <div style={modalOverlayStyle()}>
          <div style={modalPanelStyle()}>
            <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#fb7185" }}>Dangerous action</p>
            <h2 style={{ margin: "10px 0 0", fontSize: 24 }}>Confirm lan 2 truoc khi gui</h2>
            <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: "#cbd5e1" }}>
              Action {confirmAction.type} van phai giu approval flow. Extension khong tu dong gui write action nguy hiem.
            </p>
            <div style={{ marginTop: 14, padding: 12, borderRadius: 16, background: "rgba(255,255,255,0.05)" }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{confirmAction.title}</p>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#cbd5e1", whiteSpace: "pre-wrap" }}>
                {String(confirmAction.payloadJson?.replyText ?? confirmAction.payloadJson?.draftReply ?? "Khong co preview")}
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
              <button onClick={() => setConfirmAction(null)} style={secondaryButtonStyle()}>
                Huy
              </button>
              <button onClick={() => { void executeAction(confirmAction, true); }} style={primaryButtonStyle()}>
                Confirm va gui
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontSize: 12, color: "#94a3b8" }}>
        <span>
          {user ? `${user.name} • plan ${usage?.plan ?? user.plan} • con ${usage?.remaining.reviewDrafts ?? 0} drafts` : "Chua co user"}
        </span>
        <button onClick={() => { void handleLogout(); }} style={secondaryButtonStyle()}>
          Dang xuat
        </button>
      </div>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#111827",
    color: "#fff"
  };
}

function selectStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#111827",
    color: "#fff"
  };
}

function primaryButtonStyle(disabled = false): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "none",
    background: disabled ? "rgba(245,158,11,0.45)" : "#f59e0b",
    color: "#111827",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer"
  };
}

function secondaryButtonStyle(disabled = false): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: disabled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
    color: "#fff",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer"
  };
}

function ghostDangerButtonStyle(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(251,113,133,0.3)",
    background: "rgba(251,113,133,0.08)",
    color: "#fecdd3",
    fontWeight: 600
  };
}

function promptButtonStyle(background = "rgba(255,255,255,0.08)"): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background,
    color: "#fff",
    fontSize: 12
  };
}

function tabChipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? "rgba(249,115,22,0.45)" : "rgba(255,255,255,0.12)"}`,
    background: active ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.04)",
    color: "#fff",
    fontWeight: 600
  };
}

function panelCardStyle(): React.CSSProperties {
  return {
    padding: 14,
    borderRadius: 18,
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(255,255,255,0.08)"
  };
}

function severityBadgeStyle(severity: string): React.CSSProperties {
  const background =
    severity === "CRITICAL" ? "rgba(251,113,133,0.18)"
      : severity === "HIGH" ? "rgba(249,115,22,0.18)"
        : severity === "MEDIUM" ? "rgba(56,189,248,0.18)"
          : "rgba(16,185,129,0.18)";

  const color =
    severity === "CRITICAL" ? "#fecdd3"
      : severity === "HIGH" ? "#fdba74"
        : severity === "MEDIUM" ? "#bae6fd"
          : "#bbf7d0";

  return {
    alignSelf: "flex-start",
    padding: "8px 10px",
    borderRadius: 999,
    background,
    color,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em"
  };
}

function modalOverlayStyle(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  };
}

function modalPanelStyle(): React.CSSProperties {
  return {
    width: "min(720px, 100%)",
    padding: 20,
    borderRadius: 24,
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.08)"
  };
}

createRoot(document.getElementById("root")!).render(<SidePanel />);
