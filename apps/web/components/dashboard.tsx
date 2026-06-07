"use client";

import { useEffect, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { API_BASE_URL } from "../lib/api";

type User = { id: string; email: string; name: string; role: string };
type Shop = {
  id: string;
  name: string;
  wbSellerId: string;
  status: string;
  tokenScopes?: string[];
  products?: Product[];
  feedbacks?: Feedback[];
  actions?: Action[];
  aiReports?: Report[];
};
type Product = { id: string; title: string; wbNmId: string; price: number; stock: number; brand: string; category: string };
type Feedback = { id: string; rating: number; text: string; status: string; aiReplyDraft?: string | null };
type Action = { id: string; type: string; title: string; status: string; payloadJson?: Record<string, unknown> };
type Report = {
  id: string;
  healthScore: number;
  summary: string;
  risksJson: string[];
  opportunitiesJson: string[];
  actionsJson?: Array<{ title?: string; type?: string }>;
};
type ConnectionResult = {
  ok: boolean;
  mode: "mock" | "real";
  seller?: { name?: string; sid?: string; tradeMark?: string };
  scopes: string[];
  capabilities: string[];
  errors: string[];
};

const demoCredentials = {
  email: "demo@wb-agent.local",
  password: "Demo123456!"
};

export function Dashboard() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [message, setMessage] = useState("Dang san sang cho mock mode hoac Wildberries/Gemini mode that.");
  const [pending, startTransition] = useTransition();
  const [wbToken, setWbToken] = useState("");
  const [shopName, setShopName] = useState("Demo Wildberries Shop");
  const [testConnection, setTestConnection] = useState<ConnectionResult | null>(null);

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.message ?? "Request failed");
    }

    return response.json() as Promise<T>;
  }

  async function loadDashboard(nextToken = token) {
    if (!nextToken) return;

    const me = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${nextToken}` }
    }).then((response) => response.json());
    setUser(me.user);

    const shopsResponse = await fetch(`${API_BASE_URL}/shops`, {
      headers: { Authorization: `Bearer ${nextToken}` }
    }).then((response) => response.json());
    const nextShops = shopsResponse.shops ?? [];
    setShops(nextShops);

    if (nextShops[0]?.id) {
      await loadShopDetail(nextShops[0].id, nextToken);
    } else {
      setSelectedShop(null);
      setReport(null);
    }
  }

  async function loadShopDetail(shopId: string, currentToken = token) {
    const detail = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
      headers: { Authorization: `Bearer ${currentToken}` }
    }).then((response) => response.json());
    setSelectedShop(detail.shop ?? null);

    const latestReport = await fetch(`${API_BASE_URL}/reports/${shopId}/latest`, {
      headers: { Authorization: `Bearer ${currentToken}` }
    }).then((response) => response.json());
    setReport(latestReport.report ?? null);
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
        const data = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).then((response) => response.json());

        if (!data.token) {
          throw new Error("Dang nhap that bai");
        }

        setToken(data.token);
        window.localStorage.setItem("wb-dashboard-token", data.token);
        await loadDashboard(data.token);
        setMessage("Dang nhap thanh cong.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Dang nhap that bai.");
      }
    });
  }

  function onAction(path: string, body?: Record<string, unknown>) {
    startTransition(async () => {
      try {
        const data = await request<{ analysis?: Report; report?: Report }>(path, {
          method: "POST",
          body: body ? JSON.stringify(body) : undefined
        });

        if (data.analysis) {
          setReport({ ...data.analysis });
        }

        if (selectedShop?.id) {
          await loadShopDetail(selectedShop.id);
        }

        setMessage("Da xu ly yeu cau thanh cong.");
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

    startTransition(async () => {
      try {
        await request("/shops/connect-token", {
          method: "POST",
          body: JSON.stringify({
            shopId: selectedShop?.id,
            name: shopName,
            wbSellerId: testConnection?.seller?.sid ?? selectedShop?.wbSellerId ?? "pending",
            token: wbToken.trim(),
            tokenScopes: testConnection?.scopes ?? []
          })
        });

        setWbToken("");
        await loadDashboard();
        setMessage("Da luu token Wildberries vao backend duoi dang ma hoa.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Khong the ket noi token Wildberries.");
      }
    });
  }

  const actions = selectedShop?.actions ?? [];
  const products = selectedShop?.products ?? [];
  const feedbacks = selectedShop?.feedbacks ?? [];

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="card overflow-hidden p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.25em] text-amber-300">AI Operations Manager</p>
              <h1 className="text-4xl font-semibold text-white md:text-5xl">WB Operator AI Agent</h1>
              <p className="max-w-2xl text-sm text-stone-300 md:text-base">
                Dashboard demo-that cho seller Wildberries: login, test token, connect token da ma hoa, sync du lieu, tao AI report va duyet action queue an toan.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{message}</div>
          </div>
        </section>

        {!token ? (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="card p-6">
              <h2 className="text-2xl font-semibold">Dang nhap demo</h2>
              <p className="mt-2 text-sm text-stone-300">
                Demo account: {demoCredentials.email} / {demoCredentials.password}
              </p>
              <form className="mt-6 space-y-4" onSubmit={handleLogin}>
                <input className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3" name="email" defaultValue={demoCredentials.email} />
                <input className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3" type="password" name="password" defaultValue={demoCredentials.password} />
                <button className="rounded-2xl bg-amber-500 px-5 py-3 font-medium text-stone-950" disabled={pending} type="submit">
                  {pending ? "Dang xu ly..." : "Dang nhap"}
                </button>
              </form>
            </div>
            <div className="card p-6">
              <h2 className="text-2xl font-semibold">Flow demo that</h2>
              <ul className="mt-4 space-y-3 text-sm text-stone-300">
                <li>Mock chay ngon ngay ca khi chua co WB token that</li>
                <li>Test token Wildberries o backend truoc khi luu</li>
                <li>Gemini co fallback ve mock neu thieu API key</li>
                <li>Dangerous actions can approval va confirm lan 2</li>
              </ul>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div className="card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-stone-400">Dang nhap</p>
                    <h2 className="text-2xl font-semibold">{user?.name ?? "Seller"}</h2>
                    <p className="text-sm text-stone-300">{user?.email}</p>
                  </div>
                  <div className="rounded-2xl bg-skyline/20 px-4 py-2 text-sm text-blue-100">{user?.role ?? "SELLER"}</div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <button className="rounded-2xl bg-amber-500 px-4 py-3 font-medium text-stone-950" onClick={() => selectedShop && onAction(`/ai/${selectedShop.id}/health-report`)}>
                    Analyze Shop
                  </button>
                  <button className="rounded-2xl border border-white/10 px-4 py-3" onClick={() => selectedShop && onAction(`/ai/${selectedShop.id}/review-reply-draft`)}>
                    Generate Review Replies
                  </button>
                  <button className="rounded-2xl border border-white/10 px-4 py-3" onClick={() => selectedShop && onAction(`/ai/${selectedShop.id}/product-doctor`)}>
                    Product Doctor
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <button className="rounded-2xl border border-white/10 px-4 py-3" onClick={() => selectedShop && onAction(`/wb/${selectedShop.id}/sync/products`)}>
                    Sync Products
                  </button>
                  <button className="rounded-2xl border border-white/10 px-4 py-3" onClick={() => selectedShop && onAction(`/wb/${selectedShop.id}/sync/feedbacks`)}>
                    Sync Feedbacks
                  </button>
                  <button className="rounded-2xl border border-white/10 px-4 py-3" onClick={() => selectedShop && onAction(`/wb/${selectedShop.id}/sync/analytics`)}>
                    Sync Analytics
                  </button>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-xl font-semibold">Connect WB API Token</h2>
                <p className="mt-2 text-sm text-stone-300">Token duoc test va ma hoa o backend. Frontend khong nhan lai token tho.</p>
                <div className="mt-4 space-y-3">
                  <input value={shopName} onChange={(event) => setShopName(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3" placeholder="Ten shop" />
                  <textarea value={wbToken} onChange={(event) => setWbToken(event.target.value)} className="min-h-32 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3" placeholder="Dan WB API token de test ket noi" />
                  <div className="flex flex-wrap gap-3">
                    <button className="rounded-2xl border border-white/10 px-4 py-3" onClick={testWbConnection}>Test connection</button>
                    <button className="rounded-2xl bg-emerald-500 px-4 py-3 font-medium text-stone-950" onClick={connectWbToken}>Connect token</button>
                  </div>
                </div>

                {testConnection ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm">
                    <p className="font-medium">Mode: {testConnection.mode}</p>
                    <p className="mt-2">Seller: {testConnection.seller?.tradeMark ?? testConnection.seller?.name ?? "Khong xac dinh"}</p>
                    <p className="mt-2">Scopes: {(testConnection.scopes ?? []).join(", ") || "Chua xac dinh"}</p>
                    {testConnection.errors.length > 0 ? <p className="mt-2 text-amber-200">Loi: {testConnection.errors.join(" | ")}</p> : null}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
              <div className="space-y-6">
                <div className="card p-6">
                  <h2 className="text-xl font-semibold">Shop Overview</h2>
                  <div className="mt-4 space-y-3">
                    {shops.map((shop) => (
                      <button
                        key={shop.id}
                        className={`w-full rounded-2xl border px-4 py-4 text-left ${selectedShop?.id === shop.id ? "border-amber-400 bg-amber-500/10" : "border-white/10 bg-black/10"}`}
                        onClick={() => loadShopDetail(shop.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{shop.name}</span>
                          <span className="text-xs uppercase text-stone-400">{shop.status}</span>
                        </div>
                        <p className="mt-2 text-sm text-stone-300">WB Seller ID: {shop.wbSellerId}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card p-6">
                  <h2 className="text-xl font-semibold">Products Table</h2>
                  <div className="mt-4 space-y-3 text-sm">
                    {products.slice(0, 5).map((product) => (
                      <div key={product.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                        <p className="font-medium">{product.title}</p>
                        <p className="mt-1 text-stone-300">WB {product.wbNmId} • {product.brand} • {product.category}</p>
                        <p className="mt-1 text-stone-400">Gia: {product.price} • Ton: {product.stock}</p>
                      </div>
                    ))}
                    {products.length === 0 ? <p className="text-stone-400">Chua co du lieu san pham. Ban co the sync hoac dung seed demo.</p> : null}
                  </div>
                </div>

                <div className="card p-6">
                  <h2 className="text-xl font-semibold">Feedbacks Table</h2>
                  <div className="mt-4 space-y-3 text-sm">
                    {feedbacks.slice(0, 5).map((feedback) => (
                      <div key={feedback.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                        <p className="font-medium">Danh gia {feedback.rating}/5 • {feedback.status}</p>
                        <p className="mt-2 text-stone-300">{feedback.text}</p>
                        {feedback.aiReplyDraft ? <p className="mt-2 text-amber-100">Draft: {feedback.aiReplyDraft}</p> : null}
                      </div>
                    ))}
                    {feedbacks.length === 0 ? <p className="text-stone-400">Chua co feedback. Bam sync hoac dung seed demo.</p> : null}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="card p-6">
                  <h2 className="text-xl font-semibold">Health Report</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-[140px_1fr]">
                    <div className="flex h-32 w-32 items-center justify-center rounded-full border border-amber-300/30 bg-amber-400/10 text-4xl font-semibold text-amber-200">
                      {report?.healthScore ?? "--"}
                    </div>
                    <div className="space-y-3">
                      <p className="text-stone-200">{report?.summary ?? "Chua co report moi. Bam Analyze Shop de tao report."}</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <h3 className="text-sm uppercase tracking-[0.2em] text-stone-400">Rui ro</h3>
                          <ul className="mt-2 space-y-2 text-sm text-stone-200">
                            {(report?.risksJson ?? []).map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h3 className="text-sm uppercase tracking-[0.2em] text-stone-400">Co hoi</h3>
                          <ul className="mt-2 space-y-2 text-sm text-stone-200">
                            {(report?.opportunitiesJson ?? []).map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card p-6">
                  <h2 className="text-xl font-semibold">AI Actions Queue</h2>
                  <div className="mt-4 space-y-3">
                    {actions.map((action) => (
                      <div key={action.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{action.title}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-400">{action.type}</p>
                          </div>
                          <div className="rounded-full border border-white/10 px-3 py-1 text-xs">{action.status}</div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button className="rounded-xl bg-emerald-500 px-3 py-2 text-sm text-stone-950" onClick={() => onAction(`/actions/${action.id}/approve`)}>
                            Approve
                          </button>
                          <button className="rounded-xl border border-white/10 px-3 py-2 text-sm" onClick={() => onAction(`/actions/${action.id}/reject`)}>
                            Reject
                          </button>
                          <button className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100" onClick={() => onAction(`/actions/${action.id}/execute`, { confirmDangerous: true })}>
                            Execute
                          </button>
                        </div>
                      </div>
                    ))}
                    {actions.length === 0 ? <p className="text-stone-400">Chua co action nao.</p> : null}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
