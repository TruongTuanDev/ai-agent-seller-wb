"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import type { SellerOperatingMode } from "@wb/shared";
import { API_BASE_URL } from "../lib/api";
import { CopilotPanel } from "./copilot-panel";

type Usage = {
  plan: "FREE" | "PRO" | "AGENCY";
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

type User = { id: string; email: string; name: string; role: string; plan: "FREE" | "PRO" | "AGENCY"; copilotMode: SellerOperatingMode };

type Product = {
  id: string;
  title: string;
  description?: string | null;
  wbNmId: string;
  price: number;
  stock: number;
  brand: string;
  category: string;
  rating: number;
  reviewCount: number;
  updatedAt?: string;
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
  resultJson?: Record<string, unknown> | null;
};

type Report = {
  id: string;
  healthScore: number;
  executiveSummary: string;
  createdAt: string;
  kpiSummary: {
    revenueTrend: string;
    orderTrend: string;
    conversionTrend: string;
    reviewRisk: string;
    inventoryRisk: string;
  } | null;
  criticalIssues: Array<{
    title: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    evidence: string;
    recommendation: string;
    relatedSku?: string;
  }>;
  growthOpportunities: Array<{
    title: string;
    expectedImpact: string;
    action: string;
  }>;
  recommendedActions: Array<{
    title: string;
    type: string;
    reason: string;
  }>;
  missingData: string[];
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

type TelegramIntegration = {
  id: string;
  chatId: string;
  status: string;
  dailyAlertsEnabled?: boolean;
  alertHour?: number;
  lastAlertSentAt?: string | null;
};

type ConnectionResult = {
  ok: boolean;
  mode: "mock" | "real";
  seller?: { name?: string; sid?: string; tradeMark?: string };
  scopes: string[];
  capabilities: string[];
  errors: string[];
};

type WriteMode = "mock" | "dry_run" | "real_write";

type WbStatus = {
  shopId: string;
  mode: "mock" | "real";
  writeMode: WriteMode;
  canWrite: boolean;
  approvalRequired: boolean;
  allowRealReplyTest?: boolean;
  connection?: {
    seller?: { name?: string; sid?: string; tradeMark?: string; tin?: string };
    scopes?: string[];
    capabilities?: string[];
    errors?: string[];
  };
};

type LiveChecklist = {
  items: Array<{
    key: string;
    label: string;
    ok: boolean;
    message: string;
  }>;
  allPassed: boolean;
  canAllow: boolean;
};

type LiveChecklistResponse = {
  shopId: string;
  allowRealReplyTest: boolean;
  checklist: LiveChecklist;
  preview: {
    feedbackId: string | null;
    actionId: string | null;
    userPlan: "FREE" | "PRO" | "AGENCY";
  };
};

type Shop = {
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
    addToCartConversion: number;
    cartToOrderConversion: number;
    buyoutPercent: number;
  }>;
  telegramIntegrations?: TelegramIntegration[];
};

type ViewKey = "overview" | "reviews" | "actions" | "settings" | "copilot";

const demoCredentials = {
  email: "demo@wb-agent.local",
  password: "Demo123456!"
};

const reviewToneOptions = [
  { value: "professional", label: "Chuyen nghiep" },
  { value: "friendly", label: "Than thien" },
  { value: "polite", label: "Lich su" }
] as const;

const demoPrompts = [
  "Tai sao don giam?",
  "Review nao chua tra loi?",
  "SKU nao sap het hang?",
  "Toi uu san pham ban chay"
];

export function Dashboard() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("shop-demo-1");
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [problems, setProblems] = useState<ProductProblem[]>([]);
  const [telegram, setTelegram] = useState<TelegramIntegration | null>(null);
  const [message, setMessage] = useState("San sang cho seller-ready MVP: mock mode hoac real WB/Gemini mode.");
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [pending, startTransition] = useTransition();
  const [wbToken, setWbToken] = useState("");
  const [shopName, setShopName] = useState("Demo Wildberries Shop");
  const [testConnection, setTestConnection] = useState<ConnectionResult | null>(null);
  const [telegramChatId, setTelegramChatId] = useState("@wb_demo_alerts");
  const [telegramHour, setTelegramHour] = useState(9);
  const [reviewTone, setReviewTone] = useState<(typeof reviewToneOptions)[number]["value"]>("professional");
  const [wbStatus, setWbStatus] = useState<WbStatus | null>(null);
  const [confirmAction, setConfirmAction] = useState<Action | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [liveChecklist, setLiveChecklist] = useState<LiveChecklistResponse | null>(null);

  const selectedShopName = selectedShop?.name ?? "Demo Wildberries Shop";
  const isDemoMode = (wbStatus?.mode ?? "mock") === "mock" || selectedShopId.startsWith("shop-demo");
  const isShopConnected = Boolean(selectedShop?.wbSellerId && selectedShop.wbSellerId !== "pending" && (selectedShop.tokenScopes?.length ?? 0) > 0);
  const lastSyncAt = useMemo(() => {
    const snapshotDate = selectedShop?.snapshots?.[0] ? new Date(selectedShop.snapshots[0].date ?? Date.now()) : null;
    const productUpdated = selectedShop?.products?.[0] ? new Date(selectedShop.products[0]!.updatedAt ?? Date.now()) : null;
    return snapshotDate ?? productUpdated;
  }, [selectedShop]);

  async function request<T>(path: string, init?: RequestInit, nextToken = token): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(nextToken ? { Authorization: `Bearer ${nextToken}` } : {}),
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? payload?.message ?? "Request failed");
    }

    return payload as T;
  }

  async function loadShopData(shopId: string, nextToken = token) {
    const [detail, latestReport, problemsResponse, telegramStatus, wbConnectionStatus, liveChecklistResponse] = await Promise.all([
      request<{ shop: Shop }>(`/shops/${shopId}`, undefined, nextToken),
      request<{ report: Report | null }>(`/reports/${shopId}/latest`, undefined, nextToken),
      request<{ problems: ProductProblem[] }>(`/products/${shopId}/problems`, undefined, nextToken),
      request<{ integration: TelegramIntegration | null }>(`/telegram/${shopId}/status`, undefined, nextToken),
      request<WbStatus>(`/wb/${shopId}/status`, undefined, nextToken),
      request<LiveChecklistResponse>(`/wb/${shopId}/live-test-checklist`, undefined, nextToken)
    ]);

    setSelectedShop(detail.shop);
    setSelectedShopId(shopId);
    setShopName(detail.shop.name);
    setReport(latestReport.report);
    setProblems(problemsResponse.problems);
    setTelegram(telegramStatus.integration);
    setWbStatus(wbConnectionStatus);
    setLiveChecklist(liveChecklistResponse);
    if (telegramStatus.integration?.chatId) {
      setTelegramChatId(telegramStatus.integration.chatId);
      setTelegramHour(telegramStatus.integration.alertHour ?? 9);
    }
  }

  async function loadDashboard(nextToken = token) {
    if (!nextToken) return;

    const me = await request<{ user: User; usage: Usage }>("/auth/me", undefined, nextToken);
    const shopsResponse = await request<{ shops: Shop[] }>("/shops", undefined, nextToken);
    setUser(me.user);
    setUsage(me.usage);
    setShops(shopsResponse.shops);

    const initialShop = shopsResponse.shops.find((shop) => shop.id === selectedShopId) ?? shopsResponse.shops[0];
    if (initialShop?.id) {
      await loadShopData(initialShop.id, nextToken);
    } else {
        setSelectedShop(null);
        setReport(null);
        setProblems([]);
        setTelegram(null);
        setLiveChecklist(null);
      }
    }

  useEffect(() => {
    const stored = window.localStorage.getItem("wb-dashboard-token");
    if (!stored) return;
    setToken(stored);
    loadDashboard(stored).catch(() => setMessage("Khong tai duoc dashboard. Hay dang nhap lai."));
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email")),
      password: String(formData.get("password"))
    };

    startTransition(async () => {
      try {
        const data = await request<{ token: string }>("/auth/login", {
          method: "POST",
          body: JSON.stringify(payload)
        }, "");
        setToken(data.token);
        window.localStorage.setItem("wb-dashboard-token", data.token);
        await loadDashboard(data.token);
        setMessage("Dang nhap demo thanh cong.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Dang nhap that bai.");
      }
    });
  }

  function runAction(path: string, init?: RequestInit, successMessage = "Da xu ly thanh cong.") {
    startTransition(async () => {
      try {
        const response = await request<{ mode?: string; actionStatus?: string; feedbackStatus?: string }>(path, init);
        const me = await request<{ user: User; usage: Usage }>("/auth/me", undefined);
        setUser(me.user);
        setUsage(me.usage);
        if (selectedShopId) {
          await loadShopData(selectedShopId);
        }
        const modeLabel = response.mode ? ` [${response.mode}]` : "";
        setMessage(`${successMessage}${modeLabel}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Khong the xu ly yeu cau.");
      }
    });
  }

  async function updateCopilotMode(mode: SellerOperatingMode) {
    const data = await request<{ user: User; usage: Usage }>("/auth/settings/copilot-mode", {
      method: "POST",
      body: JSON.stringify({ mode })
    });

    setUser(data.user);
    setUsage(data.usage);
    setMessage(`Da chuyen copilot mode sang ${mode}.`);
  }

  function openReplyConfirm(action: Action) {
    setConfirmAction(action);
    setConfirmChecked(false);
  }

  function closeReplyConfirm() {
    setConfirmAction(null);
    setConfirmChecked(false);
  }

  function executeReplyReviewAction() {
    if (!confirmAction) return;

    runAction(
      `/actions/${confirmAction.id}/execute`,
      {
        method: "POST",
        body: JSON.stringify({
          confirmDangerous: true,
          confirmReplySend: true
        })
      },
      "Da xu ly action phan hoi review."
    );
    closeReplyConfirm();
  }

  function testWbConnection() {
    if (!wbToken.trim()) {
      setMessage("Hay nhap WB API token truoc khi test.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await request<ConnectionResult>("/shops/test-connection", {
          method: "POST",
          body: JSON.stringify({ token: wbToken.trim() })
        });
        setTestConnection(result);
        setMessage(result.ok ? "Kiem tra token Wildberries thanh cong." : "Token Wildberries chua ket noi duoc.");
      } catch (error) {
        setTestConnection(null);
        setMessage(error instanceof Error ? error.message : "Khong the test token Wildberries.");
      }
    });
  }

  function connectWbToken() {
    if (!wbToken.trim()) {
      setMessage("Hay nhap WB API token truoc khi ket noi.");
      return;
    }

    runAction("/shops/connect-token", {
      method: "POST",
      body: JSON.stringify({
        shopId: selectedShop?.id,
        name: shopName,
        wbSellerId: testConnection?.seller?.sid ?? selectedShop?.wbSellerId ?? "pending",
        token: wbToken.trim(),
        tokenScopes: testConnection?.scopes ?? []
      })
    }, "Da luu token Wildberries vao backend duoi dang ma hoa.");
    setWbToken("");
  }

  function connectTelegram() {
    if (!selectedShopId) return;
    runAction(`/telegram/${selectedShopId}/connect`, {
      method: "POST",
      body: JSON.stringify({
        chatId: telegramChatId,
        dailyAlertsEnabled: true,
        alertHour: telegramHour
      })
    }, "Da cap nhat Telegram integration.");
  }

  function toggleLiveTestAllowance(enabled: boolean) {
    if (!selectedShopId) return;
    runAction(
      `/wb/${selectedShopId}/live-test-allow`,
      {
        method: "POST",
        body: JSON.stringify({ enabled })
      },
      enabled ? "Da bat live review reply test cho shop nay." : "Da dua shop ve che do an toan/dry-run."
    );
  }

  function syncNow() {
    if (!selectedShopId) return;
    startTransition(async () => {
      try {
        await request(`/wb/${selectedShopId}/sync/products`, { method: "POST" });
        await request(`/wb/${selectedShopId}/sync/feedbacks`, { method: "POST" });
        await request(`/wb/${selectedShopId}/sync/analytics`, { method: "POST" });
        await loadShopData(selectedShopId);
        setMessage("Da sync products, feedbacks va analytics cho shop.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Khong the sync shop luc nay.");
      }
    });
  }

  function openInventoryRiskFromOverview() {
    setActiveView("overview");
    window.setTimeout(() => {
      document.getElementById("inventory-risk-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  function runThreeMinuteDemo() {
    if (!selectedShopId) return;
    startTransition(async () => {
      try {
        let conversationId: string | undefined;
        const prompts = [
          "Tai sao don giam?",
          "Review nao chua tra loi?",
          "Viet tra loi cho review tieu cuc.",
          "Kiem tra san pham ma SKU 100001",
          "Toi nen lam gi tiep theo?"
        ];

        for (const prompt of prompts) {
          const response = await request<{ conversationId: string }>("/copilot/chat", {
            method: "POST",
            body: JSON.stringify({
              shopId: selectedShopId,
              message: prompt,
              conversationId
            })
          });
          conversationId = response.conversationId;
        }

        setActiveView("copilot");
        setMessage("Da chay xong demo 3 phut: health, issues, review draft, Product Doctor va next actions.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Khong the chay demo 3 phut.");
      }
    });
  }

  const products = selectedShop?.products ?? [];
  const feedbacks = selectedShop?.feedbacks ?? [];
  const actions = selectedShop?.actions ?? [];
  const snapshots = selectedShop?.snapshots ?? [];
  const latestSnapshot = snapshots[0];

  const reviewQueue = useMemo(() => {
    return feedbacks.map((feedback) => {
      const action = actions.find((item) => String(item.payloadJson?.feedbackId ?? "") === feedback.id && item.type === "REPLY_REVIEW");
      const queueState =
        feedback.status === "SENT"
          ? "Da gui"
          : action?.status === "REJECTED"
            ? "Reject"
            : action?.status === "APPROVED"
              ? "Approve"
            : feedback.status === "DRAFTED"
              ? "AI Draft"
                : "Chua tra loi";

      return { feedback, action, queueState };
    });
  }, [actions, feedbacks]);

  const kpis = [
    {
      label: "Doanh thu",
      value: latestSnapshot ? `${Math.round(latestSnapshot.revenue).toLocaleString("en-US")} RUB` : "--",
      hint: report?.kpiSummary?.revenueTrend ?? "Can sync analytics de co doanh thu moi."
    },
    {
      label: "Don hang",
      value: latestSnapshot ? `${latestSnapshot.ordersCount}` : "--",
      hint: report?.kpiSummary?.orderTrend ?? "Can sync analytics de co don hang moi."
    },
    {
      label: "Chuyen doi",
      value: latestSnapshot ? `${latestSnapshot.cartToOrderConversion.toFixed(1)}%` : "--",
      hint: report?.kpiSummary?.conversionTrend ?? "Neu analytics loi 400, he thong se fallback mock."
    },
    {
      label: "Review ton dong",
      value: `${feedbacks.filter((item) => item.status !== "SENT").length}`,
      hint: report?.kpiSummary?.reviewRisk ?? "Review queue chua co canh bao moi."
    }
  ];

  const navItems: Array<{ key: ViewKey; label: string }> = [
    { key: "overview", label: "Tong quan" },
    { key: "copilot", label: "AI Copilot" },
    { key: "reviews", label: "Reviews" },
    { key: "actions", label: "Action Queue" },
    { key: "settings", label: "Cai dat" }
  ];

  const planCards = [
    {
      key: "FREE",
      title: "Free",
      features: "1 shop, 20 AI review drafts/thang, 10 health reports/thang, chi dry-run",
      cta: "Upgrade soon"
    },
    {
      key: "PRO",
      title: "Pro",
      features: "3 shops, 500 AI review drafts/thang, 100 health reports/thang, real write review replies",
      cta: "Lien he nang cap"
    },
    {
      key: "AGENCY",
      title: "Agency",
      features: "20 shops, 5000 AI review drafts/thang, 1000 health reports/thang, real write review replies",
      cta: "Lien he nang cap"
    }
  ] as const;

  if (!token) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="panel p-8">
            <p className="eyebrow">Seller-ready MVP</p>
            <h1 className="mt-4 text-4xl font-semibold text-white md:text-5xl">WB Operator AI Agent</h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-300 md:text-base">
              Dashboard demo cho seller Wildberries: sync du lieu, health report, review queue, Product Doctor va Telegram alert voi luong approval an toan.
            </p>
            <form className="mt-8 space-y-4" onSubmit={handleLogin}>
              <input className="input" name="email" defaultValue={demoCredentials.email} />
              <input className="input" type="password" name="password" defaultValue={demoCredentials.password} />
              <button className="button-primary w-full" disabled={pending} type="submit">
                {pending ? "Dang xu ly..." : "Dang nhap demo"}
              </button>
            </form>
            <p className="toast mt-6">{message}</p>
          </section>

          <section className="panel p-8">
            <h2 className="text-2xl font-semibold text-white">Flow demo cho chu shop</h2>
            <div className="mt-6 grid gap-4 text-sm text-slate-300">
              <div className="soft-card">
                <p className="font-medium text-white">1. Sync va Health Report</p>
                <p className="mt-2">Lay du lieu product, stock, feedback, analytics va tao bao cao suc khoe shop co action goi y.</p>
              </div>
              <div className="soft-card">
                <p className="font-medium text-white">2. Review Queue</p>
                <p className="mt-2">AI soan draft tieng Nga, seller approve, confirm lan 2 roi moi gui that khi bat real API.</p>
              </div>
              <div className="soft-card">
                <p className="font-medium text-white">3. Product Doctor va Telegram</p>
                <p className="mt-2">Kiem tra SEO listing theo SKU va gui canh bao buoi sang qua Telegram.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 md:px-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="panel p-5">
          <p className="eyebrow">WB SaaS Demo</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">WB Operator</h1>
          <p className="mt-2 text-sm text-slate-300">{selectedShopName}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {isDemoMode ? <span className="chip">Demo Mode</span> : null}
            <span className={isShopConnected ? "chip" : "severity severity-medium"}>
              {isShopConnected ? "WB token da ket noi" : "Chua ket noi WB token"}
            </span>
          </div>

          <div className="mt-6 grid gap-3">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={activeView === item.key ? "nav-item nav-item-active" : "nav-item"}
                onClick={() => setActiveView(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="soft-card mt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Demo user</p>
            <p className="mt-2 font-medium text-white">{user?.name}</p>
            <p className="text-sm text-slate-300">{user?.email}</p>
            <p className="mt-3 text-xs text-slate-400">Role: {user?.role}</p>
            <p className="mt-2 text-xs text-slate-400">Plan: {usage?.plan ?? user?.plan ?? "FREE"}</p>
            {user?.role === "ADMIN" ? (
              <Link className="button-link mt-4 inline-flex" href="/admin">
                Mo Admin Panel
              </Link>
            ) : null}
          </div>

          <div className="soft-card mt-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Demo 3 phut</p>
            <p className="mt-2 text-sm text-slate-300">Cho seller thay ngay health, review, SKU rui ro va next actions ma khong can biet ky thuat.</p>
            <button className="button-primary mt-4 w-full" disabled={pending} onClick={runThreeMinuteDemo}>
              {pending ? "Dang chay..." : "Chay demo 3 phut"}
            </button>
          </div>

          <div className="soft-card mt-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Shops</p>
            <div className="mt-3 grid gap-2">
              {shops.map((shop) => (
                <button
                  key={shop.id}
                  className={selectedShopId === shop.id ? "shop-chip shop-chip-active" : "shop-chip"}
                  onClick={() => loadShopData(shop.id).catch((error) => setMessage(error instanceof Error ? error.message : "Khong the tai shop."))}
                >
                  <span>{shop.name}</span>
                  <span className="text-xs text-slate-400">{shop.status}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          <div className="panel p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="eyebrow">Seller-ready MVP</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">Dashboard tieng Viet de demo cho chu shop</h2>
                <p className="mt-3 max-w-3xl text-sm text-slate-300">
                  He thong se fallback mock neu thieu WB token that hoac analytics tra loi 400. Action nguy hiem van bat buoc approval va confirm lan 2.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="chip">READ MODE: {wbStatus?.mode ?? "mock"}</span>
                  <span className="chip">
                    {wbStatus?.writeMode === "real_write"
                      ? "REAL WRITE: Se gui that len Wildberries"
                      : wbStatus?.writeMode === "dry_run"
                        ? "DRY-RUN: Khong gui that"
                        : "MOCK: Khong goi WB that"}
                  </span>
                </div>
              </div>
              <div className="toast max-w-md">{message}</div>
            </div>
          </div>

          {activeView === "overview" ? (
            <>
              <section className="panel p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={isShopConnected ? "chip" : "severity severity-medium"}>
                        {isShopConnected ? "Shop da ket noi" : "Shop chua ket noi"}
                      </span>
                      {isDemoMode ? <span className="chip">Demo Mode</span> : null}
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold text-white">Seller-ready demo cho {selectedShopName}</h2>
                    <p className="mt-3 max-w-3xl text-sm text-slate-300">
                      Copilot co the phan tich shop, tim 3 van de lon nhat, draft review tieng Nga, kiem tra SKU co rui ro va de xuat hanh dong tiep theo ma khong bat seller nho endpoint hay shop id.
                    </p>
                    {!isShopConnected ? (
                      <div className="soft-card mt-5 border-amber-300/20 bg-amber-400/10">
                        <p className="font-medium text-amber-100">Huong dan ket noi Wildberries trong 3 buoc</p>
                        <div className="mt-3 grid gap-2 text-sm text-amber-50">
                          <p>1. Vao Wildberries Developer Portal va tao token doc du lieu.</p>
                          <p>2. Bat quyen Products, Feedbacks and Questions, Analytics neu co.</p>
                          <p>3. Dan token vao Settings, bam Test Connection roi Connect token.</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-3">
                    <button className="button-primary" disabled={pending} onClick={runThreeMinuteDemo}>
                      {pending ? "Dang chay demo..." : "Chay demo 3 phut"}
                    </button>
                    <button className="button-secondary" disabled={pending} onClick={syncNow}>
                      Sync Now
                    </button>
                    <button className="button-secondary" onClick={() => setActiveView("copilot")}>
                      Mo AI Copilot
                    </button>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
                <div className="metric-card">
                  <p className="text-sm text-slate-400">Plan</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{usage?.plan ?? "--"}</p>
                  <p className="mt-2 text-xs text-slate-300">Real write: {usage?.limits.realWriteEnabled ? "Bat" : "Chi dry-run"}</p>
                </div>
                <div className="metric-card">
                  <p className="text-sm text-slate-400">AI Review Drafts</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{usage ? `${usage.used.reviewDrafts}/${usage.limits.reviewDraftsPerMonth}` : "--"}</p>
                  <p className="mt-2 text-xs text-slate-300">Con lai: {usage?.remaining.reviewDrafts ?? "--"} trong thang</p>
                </div>
                <div className="metric-card">
                  <p className="text-sm text-slate-400">Health Reports</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{usage ? `${usage.used.healthReports}/${usage.limits.healthReportsPerMonth}` : "--"}</p>
                  <p className="mt-2 text-xs text-slate-300">Real writes thang nay: {usage?.used.realWrites ?? "--"}</p>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="panel p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-400">Health Report</p>
                      <h3 className="mt-1 text-2xl font-semibold text-white">{selectedShopName}</h3>
                    </div>
                    <div className="health-ring">
                      <span>{report?.healthScore ?? "--"}</span>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-200">{report?.executiveSummary ?? "Chua co report moi. Bam Analyze Shop de tao bao cao suc khoe."}</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button className="button-primary" onClick={() => runAction(`/ai/${selectedShopId}/health-report`, { method: "POST" }, "Da tao Health Report moi.")}>
                      Analyze Shop
                    </button>
                    <button className="button-secondary" onClick={() => runAction(`/wb/${selectedShopId}/sync/products`, { method: "POST" }, "Da sync products va stocks.")}>
                      Sync Products
                    </button>
                    <button className="button-secondary" onClick={() => runAction(`/wb/${selectedShopId}/sync/feedbacks`, { method: "POST" }, "Da sync feedbacks.")}>
                      Sync Feedbacks
                    </button>
                    <button className="button-secondary" onClick={() => runAction(`/wb/${selectedShopId}/sync/analytics`, { method: "POST" }, "Da sync analytics. Neu WB loi 400, he thong se fallback mock.")}>
                      Sync Analytics
                    </button>
                  </div>
                </div>

                <div className="grid gap-4">
                  {kpis.map((item) => (
                    <div key={item.label} className="metric-card">
                      <p className="text-sm text-slate-400">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
                      <p className="mt-2 text-xs text-slate-300">{item.hint}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-5">
                {[
                  "1. AI phan tich shop",
                  "2. Chi ra 3 van de",
                  "3. Tao draft tra loi review",
                  "4. Kiem tra 1 SKU co van de",
                  "5. De xuat hanh dong tiep theo"
                ].map((step) => (
                  <div key={step} className="soft-card">
                    <p className="text-sm font-medium text-white">{step}</p>
                  </div>
                ))}
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="panel p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">Top 3 van de nguy hiem</h3>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Approval-ready</span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {(report?.criticalIssues ?? []).slice(0, 3).map((issue) => (
                      <div key={`${issue.title}-${issue.relatedSku ?? "none"}`} className="soft-card">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-white">{issue.title}</p>
                          <span className={`severity severity-${issue.severity.toLowerCase()}`}>{issue.severity}</span>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">{issue.evidence}</p>
                        <p className="mt-3 text-sm text-amber-200">{issue.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel p-5">
                  <h3 className="text-xl font-semibold text-white">Co hoi tang truong</h3>
                  <div className="mt-4 grid gap-3">
                    {(report?.growthOpportunities ?? []).slice(0, 3).map((opportunity) => (
                      <div key={opportunity.title} className="soft-card">
                        <p className="font-medium text-white">{opportunity.title}</p>
                        <p className="mt-2 text-sm text-slate-300">{opportunity.expectedImpact}</p>
                        <p className="mt-2 text-sm text-emerald-200">{opportunity.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="panel p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white" id="inventory-risk-section">SKU can xu ly ngay</h3>
                    <span className="text-sm text-slate-400">{problems.length} van de</span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {problems.slice(0, 5).map((problem) => (
                      <div key={problem.productId} className="soft-card">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-white">{problem.title}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">WB {problem.wbNmId}</p>
                          </div>
                          <span className={`severity severity-${problem.severity.toLowerCase()}`}>{problem.severity}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                          {problem.reasons.map((reason) => (
                            <span key={reason} className="chip">{reason}</span>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link className="button-link" href={`/products/${problem.productId}/doctor`}>
                            Mo Product Doctor
                          </Link>
                          <button
                            className="button-secondary"
                            onClick={() => runAction(`/ai/${selectedShopId}/review-reply-draft`, {
                              method: "POST",
                              body: JSON.stringify({ tone: reviewTone })
                            }, "Da tao draft review uu tien.")}
                          >
                            Tao draft review
                          </button>
                        </div>
                      </div>
                    ))}
                    {problems.length === 0 ? <p className="text-sm text-slate-400">Chua phat hien SKU co van de ro rang.</p> : null}
                  </div>
                </div>

                <div className="panel p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">Hanh dong de xuat</h3>
                    <span className="text-sm text-slate-400">{report?.recommendedActions?.length ?? 0} action</span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {(report?.recommendedActions ?? []).map((action) => (
                      <div key={`${action.type}-${action.title}`} className="soft-card">
                        <p className="font-medium text-white">{action.title}</p>
                        <p className="mt-2 text-sm text-slate-300">{action.reason}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{action.type}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button className="button-secondary" onClick={() => setActiveView("actions")}>Mo Action Queue</button>
                          {action.type === "CREATE_REVIEW_DRAFT" ? (
                            <button className="button-secondary" onClick={() => setActiveView("reviews")}>Mo Review Queue</button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {report?.missingData?.length ? (
                      <div className="soft-card border-amber-300/20 bg-amber-400/10">
                        <p className="font-medium text-amber-100">Missing data</p>
                        <p className="mt-2 text-sm text-amber-50">{report.missingData.join(", ")}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            </>
          ) : null}

          {activeView === "copilot" ? (
            <CopilotPanel
              shopId={selectedShopId}
              shopName={selectedShopName}
              mode={user?.copilotMode ?? "ASSISTANT"}
              request={request}
              onModeChange={updateCopilotMode}
              onOpenView={setActiveView}
              onStatus={setMessage}
              isDemoMode={isDemoMode}
            />
          ) : null}

          {activeView === "reviews" ? (
            <section className="panel p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-white">Review Reply Queue</h3>
                  <p className="mt-2 text-sm text-slate-300">AI viet draft tieng Nga. Seller approve va confirm lan 2 truoc khi gui that.</p>
                  <div className="mt-3">
                    <span className="chip">
                      {wbStatus?.writeMode === "real_write"
                        ? "REAL WRITE: Se gui that len Wildberries"
                        : wbStatus?.writeMode === "dry_run"
                          ? "DRY-RUN: Khong gui that"
                          : "MOCK: Khong goi WB that"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select className="input !w-auto !py-2" value={reviewTone} onChange={(event) => setReviewTone(event.target.value as typeof reviewTone)}>
                    {reviewToneOptions.map((tone) => (
                      <option key={tone.value} value={tone.value}>{tone.label}</option>
                    ))}
                  </select>
                  <button
                    className="button-primary"
                    onClick={() => runAction(`/ai/${selectedShopId}/review-reply-draft`, {
                      method: "POST",
                      body: JSON.stringify({ tone: reviewTone })
                    }, "Da tao draft review tiep theo.")}
                  >
                    Tao AI Draft
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {reviewQueue.map(({ feedback, action, queueState }) => (
                  <div key={feedback.id} className="soft-card">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-medium text-white">{feedback.product?.title ?? "SKU khong ro"} - {feedback.rating}/5</p>
                        <p className="mt-2 text-sm text-slate-300">{feedback.text}</p>
                        {feedback.aiReplyDraft ? <p className="mt-3 rounded-2xl bg-slate-900/70 p-3 text-sm text-emerald-100">{feedback.aiReplyDraft}</p> : null}
                      </div>
                      <span className="chip">{queueState}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="button-secondary"
                        onClick={() => runAction(`/ai/${selectedShopId}/review-reply-draft`, {
                          method: "POST",
                          body: JSON.stringify({ feedbackId: feedback.id, tone: reviewTone })
                        }, "Da tao draft review moi.")}
                      >
                        AI Draft
                      </button>
                      {action ? (
                        <>
                          <button className="button-secondary" onClick={() => runAction(`/actions/${action.id}/approve`, { method: "POST" }, "Da approve action review.")}>
                            Approve
                          </button>
                          <button className="button-secondary" onClick={() => runAction(`/actions/${action.id}/reject`, { method: "POST" }, "Da reject draft review.")}>
                            Reject
                          </button>
                          <button
                            className="button-primary"
                            onClick={() => openReplyConfirm(action)}
                          >
                            Send
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeView === "actions" ? (
            <section className="panel p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-white">Action Queue</h3>
                  <p className="mt-2 text-sm text-slate-300">Tat ca approve, reject va execute deu co AuditLog.</p>
                </div>
                <span className="chip">{actions.length} action</span>
              </div>
              <div className="mt-6 grid gap-3">
                {actions.map((action) => (
                  <div key={action.id} className="soft-card">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-medium text-white">{action.title}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{action.type}</p>
                      </div>
                      <span className="chip">{action.status}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="button-secondary" onClick={() => runAction(`/actions/${action.id}/approve`, { method: "POST" }, "Da approve action.")}>
                        Approve
                      </button>
                      <button className="button-secondary" onClick={() => runAction(`/actions/${action.id}/reject`, { method: "POST" }, "Da reject action.")}>
                        Reject
                      </button>
                      <button
                        className="button-primary"
                        onClick={() => runAction(`/actions/${action.id}/execute`, {
                          method: "POST",
                          body: JSON.stringify({ confirmDangerous: true, confirmReplySend: true })
                        }, "Da execute action.")}
                      >
                        Execute
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeView === "settings" ? (
            <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <div className="panel p-5">
                <h3 className="text-2xl font-semibold text-white">Seller Operating Mode</h3>
                <p className="mt-2 text-sm text-slate-300">Mode nay quyet dinh Copilot chi tra loi hay duoc tao action cho seller.</p>
                <div className="mt-4 grid gap-3">
                  {(["ASSISTANT", "OPERATOR", "MANAGER"] as SellerOperatingMode[]).map((item) => (
                    <button
                      key={item}
                      className={user?.copilotMode === item ? "shop-chip shop-chip-active" : "shop-chip"}
                      onClick={() => updateCopilotMode(item).catch((error) => setMessage(error instanceof Error ? error.message : "Khong the doi copilot mode."))}
                    >
                      <span>{item}</span>
                      <span className="text-xs text-slate-400">
                        {item === "ASSISTANT" ? "Chi tra loi" : item === "OPERATOR" ? "Tao action" : "Tao action + de xuat chu dong"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel p-5">
                <h3 className="text-2xl font-semibold text-white">Wildberries Token</h3>
                <p className="mt-2 text-sm text-slate-300">Token duoc encrypt o backend. Frontend va extension khong nhan token tho.</p>
                <div className="soft-card mt-4">
                  <p className="font-medium text-white">Onboarding ket noi token</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-300">
                    <p>1. Vao Wildberries Developer Portal</p>
                    <p>2. Tao token voi quyen can thiet</p>
                    <p>3. Dan token vao day</p>
                    <p>4. Bam Test Connection</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  <input value={shopName} onChange={(event) => setShopName(event.target.value)} className="input" placeholder="Ten shop" />
                  <textarea value={wbToken} onChange={(event) => setWbToken(event.target.value)} className="input min-h-32" placeholder="Dan WB API token de test ket noi" />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button className="button-secondary" onClick={testWbConnection}>Test connection</button>
                  <button className="button-primary" onClick={connectWbToken}>Connect token</button>
                  <button className="button-secondary" onClick={syncNow}>Sync Now</button>
                </div>
                <div className="soft-card mt-4">
                  <p className="font-medium text-white">Trang thai ket noi</p>
                  <p className="mt-2 text-sm text-slate-300">Seller info: {wbStatus?.connection?.seller?.tradeMark ?? wbStatus?.connection?.seller?.name ?? "Chua co"}</p>
                  <p className="mt-2 text-sm text-slate-300">Seller ID: {wbStatus?.connection?.seller?.sid ?? selectedShop?.wbSellerId ?? "pending"}</p>
                  <p className="mt-2 text-sm text-slate-300">Scopes: {(wbStatus?.connection?.scopes ?? selectedShop?.tokenScopes ?? []).join(", ") || "Chua xac dinh"}</p>
                  <p className="mt-2 text-sm text-slate-300">Last sync: {lastSyncAt ? lastSyncAt.toLocaleString("vi-VN") : "Chua co sync"}</p>
                </div>
                {testConnection ? (
                  <div className="soft-card mt-4">
                    <p className="font-medium text-white">Mode: {testConnection.mode}</p>
                    <p className="mt-2 text-sm text-slate-300">Seller: {testConnection.seller?.tradeMark ?? testConnection.seller?.name ?? "Khong xac dinh"}</p>
                    <p className="mt-2 text-sm text-slate-300">Scopes: {(testConnection.scopes ?? []).join(", ") || "Chua xac dinh"}</p>
                    {testConnection.errors.length > 0 ? <p className="mt-2 text-sm text-amber-200">Loi: {testConnection.errors.join(" | ")}</p> : null}
                  </div>
                ) : null}
              </div>

              <div className="panel p-5">
                <h3 className="text-2xl font-semibold text-white">Telegram Integration</h3>
                <p className="mt-2 text-sm text-slate-300">Gui daily health summary luc 9h sang server time hoac gio ban cau hinh.</p>
                <div className="mt-4 grid gap-3">
                  <input value={telegramChatId} onChange={(event) => setTelegramChatId(event.target.value)} className="input" placeholder="@wb_demo_alerts hoac chat_id" />
                  <input
                    value={telegramHour}
                    onChange={(event) => setTelegramHour(Number(event.target.value))}
                    className="input"
                    min={0}
                    max={23}
                    type="number"
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button className="button-secondary" onClick={connectTelegram}>Luu Telegram</button>
                  <button className="button-secondary" onClick={() => runAction(`/telegram/${selectedShopId}/test-alert`, { method: "POST" }, "Da gui hoac mock-gui Telegram test alert.")}>
                    Test alert
                  </button>
                  <button className="button-primary" onClick={() => runAction(`/telegram/${selectedShopId}/daily-summary`, { method: "POST" }, "Da gui daily summary.")}>
                    Gui daily summary
                  </button>
                </div>
                <div className="soft-card mt-4">
                  <p className="font-medium text-white">Trang thai hien tai</p>
                  <p className="mt-2 text-sm text-slate-300">Chat ID: {telegram?.chatId ?? "Chua ket noi"}</p>
                  <p className="mt-2 text-sm text-slate-300">Status: {telegram?.status ?? "DISCONNECTED"}</p>
                  <p className="mt-2 text-sm text-slate-300">Gio gui: {telegram?.alertHour ?? 9}:00</p>
                </div>
              </div>

              <div className="panel p-5">
                <h3 className="text-2xl font-semibold text-white">Live Test Safety Checklist</h3>
                <p className="mt-2 text-sm text-slate-300">Chi khi tat ca dieu kien dat thi moi duoc mo live test cho review reply real-write.</p>
                <div className="mt-4 grid gap-3">
                  {(liveChecklist?.checklist.items ?? []).map((item) => (
                    <div key={item.key} className={item.ok ? "soft-card" : "soft-card border-rose-300/20 bg-rose-500/10"}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{item.label}</p>
                        <span className={item.ok ? "chip" : "severity severity-critical"}>{item.ok ? "PASS" : "FAIL"}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{item.message}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="button-primary"
                    disabled={!liveChecklist?.checklist.allPassed || wbStatus?.allowRealReplyTest === true || pending}
                    onClick={() => toggleLiveTestAllowance(true)}
                  >
                    Allow real review reply test
                  </button>
                  <button
                    className="button-secondary"
                    disabled={wbStatus?.allowRealReplyTest !== true || pending}
                    onClick={() => toggleLiveTestAllowance(false)}
                  >
                    Rollback ve dry-run
                  </button>
                </div>
                <div className="soft-card mt-4">
                  <p className="font-medium text-white">Trang thai live test</p>
                  <p className="mt-2 text-sm text-slate-300">Shop arm real test: {wbStatus?.allowRealReplyTest ? "Da bat" : "Chua bat"}</p>
                  <p className="mt-2 text-sm text-slate-300">Plan hien tai: {usage?.plan ?? "--"}</p>
                  <p className="mt-2 text-sm text-slate-300">Preview feedback: {liveChecklist?.preview.feedbackId ?? "Chua co"}</p>
                </div>
              </div>

              <div className="panel p-5 xl:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold text-white">Plans va Billing Placeholder</h3>
                    <p className="mt-2 text-sm text-slate-300">Chua tich hop payment that. Khu vuc nay de seller thay quota va huong nang cap.</p>
                  </div>
                  <span className="chip">Current plan: {usage?.plan ?? user?.plan ?? "FREE"}</span>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {planCards.map((plan) => (
                    <div key={plan.key} className={usage?.plan === plan.key ? "soft-card border-orange-300/30 bg-orange-400/10" : "soft-card"}>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{plan.key}</p>
                      <h4 className="mt-2 text-xl font-semibold text-white">{plan.title}</h4>
                      <p className="mt-3 text-sm text-slate-300">{plan.features}</p>
                      <button className="button-secondary mt-4">{plan.cta}</button>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="metric-card">
                    <p className="text-sm text-slate-400">Shops</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{usage ? `${usage.used.shops}/${usage.limits.maxShops}` : "--"}</p>
                  </div>
                  <div className="metric-card">
                    <p className="text-sm text-slate-400">Review Drafts</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{usage ? `${usage.used.reviewDrafts}/${usage.limits.reviewDraftsPerMonth}` : "--"}</p>
                  </div>
                  <div className="metric-card">
                    <p className="text-sm text-slate-400">Health Reports</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{usage ? `${usage.used.healthReports}/${usage.limits.healthReportsPerMonth}` : "--"}</p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Product Doctor quick access</h3>
              <span className="text-sm text-slate-400">{products.length} SKU</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {products.slice(0, 6).map((product) => (
                <div key={product.id} className="soft-card">
                  <p className="font-medium text-white">{product.title}</p>
                  <p className="mt-2 text-sm text-slate-300">WB {product.wbNmId} • {product.category}</p>
                  <p className="mt-2 text-sm text-slate-300">Gia {product.price} • Ton {product.stock} • Rating {product.rating.toFixed(1)}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link className="button-link" href={`/products/${product.id}/doctor`}>
                      Mo Product Doctor
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
          <div className="panel w-full max-w-2xl p-5">
            <p className="eyebrow">Xac nhan gui review</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Confirm lan 2 truoc khi gui</h3>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <div className="soft-card">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Feedback ID</p>
                <p className="mt-2 text-white">{String(confirmAction.payloadJson?.wbFeedbackId ?? confirmAction.payloadJson?.feedbackId ?? "")}</p>
              </div>
              <div className="soft-card">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Noi dung reply tieng Nga</p>
                <p className="mt-2 whitespace-pre-wrap text-emerald-100">{String(confirmAction.payloadJson?.replyText ?? confirmAction.payloadJson?.draftReply ?? "")}</p>
              </div>
              <div className="soft-card border-amber-300/20 bg-amber-400/10">
                <p className="font-medium text-amber-100">Neu real write dang bat, phan hoi nay se duoc gui that len Wildberries.</p>
              </div>
              <div>
                <span className="chip">
                  {wbStatus?.writeMode === "real_write"
                    ? "REAL WRITE: Se gui that len Wildberries"
                    : wbStatus?.writeMode === "dry_run"
                      ? "DRY-RUN: Khong gui that"
                      : "MOCK: Khong goi WB that"}
                </span>
              </div>
              <label className="flex items-center gap-3 text-white">
                <input checked={confirmChecked} onChange={(event) => setConfirmChecked(event.target.checked)} type="checkbox" />
                <span>Toi xac nhan gui phan hoi nay</span>
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="button-secondary" onClick={closeReplyConfirm}>Huy</button>
              <button className="button-primary" disabled={!confirmChecked || pending} onClick={executeReplyReviewAction}>
                {pending ? "Dang xu ly..." : "Gui phan hoi"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
