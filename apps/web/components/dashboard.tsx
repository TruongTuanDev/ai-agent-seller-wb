"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { API_BASE_URL } from "../lib/api";

type User = { id: string; email: string; name: string; role: string };

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
    revenue: number;
    ordersCount: number;
    addToCartConversion: number;
    cartToOrderConversion: number;
    buyoutPercent: number;
  }>;
  telegramIntegrations?: TelegramIntegration[];
};

type ViewKey = "overview" | "reviews" | "actions" | "settings";

const demoCredentials = {
  email: "demo@wb-agent.local",
  password: "Demo123456!"
};

const reviewToneOptions = [
  { value: "professional", label: "Chuyen nghiep" },
  { value: "friendly", label: "Than thien" },
  { value: "polite", label: "Lich su" }
] as const;

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

  const selectedShopName = selectedShop?.name ?? "Demo Wildberries Shop";

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
      throw new Error(payload?.message ?? "Request failed");
    }

    return payload as T;
  }

  async function loadShopData(shopId: string, nextToken = token) {
    const [detail, latestReport, problemsResponse, telegramStatus] = await Promise.all([
      request<{ shop: Shop }>(`/shops/${shopId}`, undefined, nextToken),
      request<{ report: Report | null }>(`/reports/${shopId}/latest`, undefined, nextToken),
      request<{ problems: ProductProblem[] }>(`/products/${shopId}/problems`, undefined, nextToken),
      request<{ integration: TelegramIntegration | null }>(`/telegram/${shopId}/status`, undefined, nextToken)
    ]);

    setSelectedShop(detail.shop);
    setSelectedShopId(shopId);
    setShopName(detail.shop.name);
    setReport(latestReport.report);
    setProblems(problemsResponse.problems);
    setTelegram(telegramStatus.integration);
    if (telegramStatus.integration?.chatId) {
      setTelegramChatId(telegramStatus.integration.chatId);
      setTelegramHour(telegramStatus.integration.alertHour ?? 9);
    }
  }

  async function loadDashboard(nextToken = token) {
    if (!nextToken) return;

    const me = await request<{ user: User }>("/auth/me", undefined, nextToken);
    const shopsResponse = await request<{ shops: Shop[] }>("/shops", undefined, nextToken);
    setUser(me.user);
    setShops(shopsResponse.shops);

    const initialShop = shopsResponse.shops.find((shop) => shop.id === selectedShopId) ?? shopsResponse.shops[0];
    if (initialShop?.id) {
      await loadShopData(initialShop.id, nextToken);
    } else {
      setSelectedShop(null);
      setReport(null);
      setProblems([]);
      setTelegram(null);
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
        await request(path, init);
        if (selectedShopId) {
          await loadShopData(selectedShopId);
        }
        setMessage(successMessage);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Khong the xu ly yeu cau.");
      }
    });
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

  const products = selectedShop?.products ?? [];
  const feedbacks = selectedShop?.feedbacks ?? [];
  const actions = selectedShop?.actions ?? [];
  const snapshots = selectedShop?.snapshots ?? [];
  const latestSnapshot = snapshots[0];

  const reviewQueue = useMemo(() => {
    return feedbacks.map((feedback) => {
      const action = actions.find((item) => String(item.payloadJson?.feedbackId ?? "") === feedback.id && item.type === "REPLY_REVIEW");
      const queueState =
        feedback.status === "REPLIED"
          ? "Da gui"
          : action?.status === "REJECTED"
            ? "Reject"
            : action?.status === "NEEDS_CONFIRMATION"
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
      value: `${feedbacks.filter((item) => item.status !== "REPLIED").length}`,
      hint: report?.kpiSummary?.reviewRisk ?? "Review queue chua co canh bao moi."
    }
  ];

  const navItems: Array<{ key: ViewKey; label: string }> = [
    { key: "overview", label: "Tong quan" },
    { key: "reviews", label: "Reviews" },
    { key: "actions", label: "Action Queue" },
    { key: "settings", label: "Cai dat" }
  ];

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
              </div>
              <div className="toast max-w-md">{message}</div>
            </div>
          </div>

          {activeView === "overview" ? (
            <>
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
                    <h3 className="text-xl font-semibold text-white">SKU can xu ly ngay</h3>
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

          {activeView === "reviews" ? (
            <section className="panel p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-white">Review Reply Queue</h3>
                  <p className="mt-2 text-sm text-slate-300">AI viet draft tieng Nga. Seller approve va confirm lan 2 truoc khi gui that.</p>
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
                            onClick={() => runAction(`/actions/${action.id}/execute`, {
                              method: "POST",
                              body: JSON.stringify({ confirmDangerous: true })
                            }, "Da gui review reply hoac mock-send thanh cong.")}
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
                          body: JSON.stringify({ confirmDangerous: true })
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
                <h3 className="text-2xl font-semibold text-white">Wildberries Token</h3>
                <p className="mt-2 text-sm text-slate-300">Token duoc encrypt o backend. Frontend va extension khong nhan token tho.</p>
                <div className="mt-4 grid gap-3">
                  <input value={shopName} onChange={(event) => setShopName(event.target.value)} className="input" placeholder="Ten shop" />
                  <textarea value={wbToken} onChange={(event) => setWbToken(event.target.value)} className="input min-h-32" placeholder="Dan WB API token de test ket noi" />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button className="button-secondary" onClick={testWbConnection}>Test connection</button>
                  <button className="button-primary" onClick={connectWbToken}>Connect token</button>
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
    </main>
  );
}
