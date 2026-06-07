"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { API_BASE_URL } from "../lib/api";

type AdminOverview = {
  users: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    plan: "FREE" | "PRO" | "AGENCY";
    createdAt: string;
    usage: {
      used: {
        shops: number;
        reviewDrafts: number;
        healthReports: number;
        realWrites: number;
      };
      limits: {
        maxShops: number;
        reviewDraftsPerMonth: number;
        healthReportsPerMonth: number;
        realWriteEnabled: boolean;
      };
    };
    shops: Array<{
      id: string;
      name: string;
      status: string;
      allowRealReplyTest: boolean;
      tokenConnected: boolean;
      tokenScopes: string[];
      latestAction?: { title?: string; status?: string } | null;
      latestReport?: { healthScore?: number } | null;
    }>;
  }>;
  latestReports: Array<{ id: string; healthScore: number; createdAt: string; shop?: { name?: string } | null }>;
  latestActions: Array<{ id: string; title: string; status: string; type: string; shop?: { name?: string } | null }>;
  failedActions: Array<{ id: string; title: string; status: string; shop?: { name?: string } | null }>;
  auditLogs: Array<{ id: string; action: string; entityType: string; entityId: string; createdAt: string; user?: { email?: string } | null; shop?: { name?: string } | null }>;
};

export function AdminPanel() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("Dang tai du lieu admin...");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [pending, startTransition] = useTransition();

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
      throw new Error(payload?.message ?? payload?.error?.message ?? `API error ${response.status}`);
    }

    return payload as T;
  }

  async function load(nextToken = token) {
    const data = await request<AdminOverview>("/admin/overview", undefined, nextToken);
    setOverview(data);
  }

  useEffect(() => {
    const stored = window.localStorage.getItem("wb-dashboard-token");
    if (!stored) {
      setMessage("Chua dang nhap. Hay quay lai dashboard de dang nhap bang tai khoan ADMIN.");
      return;
    }

    setToken(stored);
    load(stored)
      .then(() => setMessage("Admin panel san sang."))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Khong the tai admin panel."));
  }, []);

  function runAction(path: string, body: Record<string, unknown> | null, successMessage: string) {
    startTransition(async () => {
      try {
        await request(path, {
          method: "POST",
          body: body ? JSON.stringify(body) : undefined
        });
        await load();
        setMessage(successMessage);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Admin action that bai.");
      }
    });
  }

  return (
    <main className="min-h-screen px-4 py-6 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="panel p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="eyebrow">Admin</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Commercial Hardening Panel</h1>
              <p className="mt-2 text-sm text-slate-300">Quan ly user, shop, usage, audit logs va cac action that bai. Token WB chi hien trang thai ket noi, khong hien gia tri tho.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="button-secondary" href="/">Quay lai dashboard</Link>
            </div>
          </div>
          <div className="toast mt-4">{message}</div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="panel p-5">
            <h2 className="text-2xl font-semibold text-white">Users va Usage</h2>
            <div className="mt-4 grid gap-4">
              {(overview?.users ?? []).map((user) => (
                <div key={user.id} className="soft-card">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium text-white">{user.name}</p>
                      <p className="mt-1 text-sm text-slate-300">{user.email}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{user.role} • {user.plan}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="button-secondary" disabled={pending} onClick={() => runAction(`/admin/users/${user.id}/plan`, { plan: "FREE" }, "Da doi plan sang FREE.")}>FREE</button>
                      <button className="button-secondary" disabled={pending} onClick={() => runAction(`/admin/users/${user.id}/plan`, { plan: "PRO" }, "Da doi plan sang PRO.")}>PRO</button>
                      <button className="button-secondary" disabled={pending} onClick={() => runAction(`/admin/users/${user.id}/plan`, { plan: "AGENCY" }, "Da doi plan sang AGENCY.")}>AGENCY</button>
                      <button className="button-primary" disabled={pending} onClick={() => runAction(`/admin/users/${user.id}/reset-usage`, null, "Da reset usage user.")}>Reset usage</button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
                    <div className="metric-card">
                      <p className="text-slate-400">Shops</p>
                      <p className="mt-2 text-white">{user.usage.used.shops}/{user.usage.limits.maxShops}</p>
                    </div>
                    <div className="metric-card">
                      <p className="text-slate-400">Drafts</p>
                      <p className="mt-2 text-white">{user.usage.used.reviewDrafts}/{user.usage.limits.reviewDraftsPerMonth}</p>
                    </div>
                    <div className="metric-card">
                      <p className="text-slate-400">Reports</p>
                      <p className="mt-2 text-white">{user.usage.used.healthReports}/{user.usage.limits.healthReportsPerMonth}</p>
                    </div>
                    <div className="metric-card">
                      <p className="text-slate-400">Real writes</p>
                      <p className="mt-2 text-white">{user.usage.used.realWrites}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {user.shops.map((shop) => (
                      <div key={shop.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium text-white">{shop.name}</p>
                            <p className="mt-1 text-sm text-slate-300">Status: {shop.status} • Token: {shop.tokenConnected ? "Da ket noi" : "Chua co"}</p>
                            <p className="mt-1 text-sm text-slate-300">Scopes: {shop.tokenScopes.join(", ") || "Chua xac dinh"}</p>
                          </div>
                          <button className="button-secondary" disabled={pending} onClick={() => runAction(`/admin/shops/${shop.id}/disable`, null, "Da disable shop.")}>
                            Disable shop
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="panel p-5">
              <h2 className="text-xl font-semibold text-white">Failed Actions</h2>
              <div className="mt-4 grid gap-3">
                {(overview?.failedActions ?? []).map((action) => (
                  <div key={action.id} className="soft-card">
                    <p className="font-medium text-white">{action.title}</p>
                    <p className="mt-2 text-sm text-slate-300">{action.shop?.name ?? "Shop khong ro"} • {action.status}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel p-5">
              <h2 className="text-xl font-semibold text-white">Latest AI Reports</h2>
              <div className="mt-4 grid gap-3">
                {(overview?.latestReports ?? []).map((report) => (
                  <div key={report.id} className="soft-card">
                    <p className="font-medium text-white">{report.shop?.name ?? "Shop khong ro"}</p>
                    <p className="mt-2 text-sm text-slate-300">Health score: {report.healthScore}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="panel p-5">
            <h2 className="text-xl font-semibold text-white">Latest Actions</h2>
            <div className="mt-4 grid gap-3">
              {(overview?.latestActions ?? []).map((action) => (
                <div key={action.id} className="soft-card">
                  <p className="font-medium text-white">{action.title}</p>
                  <p className="mt-2 text-sm text-slate-300">{action.type} • {action.status} • {action.shop?.name ?? "Shop khong ro"}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="text-xl font-semibold text-white">Audit Logs</h2>
            <div className="mt-4 grid gap-3">
              {(overview?.auditLogs ?? []).map((log) => (
                <div key={log.id} className="soft-card">
                  <p className="font-medium text-white">{log.action}</p>
                  <p className="mt-2 text-sm text-slate-300">{log.entityType} • {log.entityId}</p>
                  <p className="mt-1 text-xs text-slate-400">{log.user?.email ?? "system"} • {log.shop?.name ?? "no-shop"}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
