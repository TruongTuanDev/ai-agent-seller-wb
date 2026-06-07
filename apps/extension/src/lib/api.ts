import { clearAuthToken, getAuthToken, setAuthToken } from "./auth";

export type ExtensionDomContext = {
  url: string;
  pageType: "dashboard" | "product" | "feedbacks" | "analytics" | "orders" | "unknown";
  productId?: string;
  sku?: string;
  visibleTextSummary?: string;
};

export async function getApiBaseUrl() {
  const result = await chrome.storage.local.get(["apiBaseUrl"]);
  return String(result.apiBaseUrl ?? "http://localhost:4000");
}

export async function getWebBaseUrl() {
  const result = await chrome.storage.local.get(["webBaseUrl"]);
  return String(result.webBaseUrl ?? "http://localhost:3000");
}

export async function getStoredToken() {
  return getAuthToken();
}

export async function setApiBaseUrl(apiBaseUrl: string) {
  await chrome.storage.local.set({ apiBaseUrl });
}

export async function setWebBaseUrl(webBaseUrl: string) {
  await chrome.storage.local.set({ webBaseUrl });
}

export async function setStoredToken(token: string) {
  await setAuthToken(token);
}

export async function clearStoredToken() {
  await clearAuthToken();
}

export async function getActiveShopId() {
  const result = await chrome.storage.local.get(["activeShopId"]);
  return String(result.activeShopId ?? "");
}

export async function setActiveShopId(activeShopId: string) {
  await chrome.storage.local.set({ activeShopId });
}

export async function clearActiveShopId() {
  await chrome.storage.local.remove(["activeShopId"]);
}

export async function getDomContext() {
  const result = await chrome.storage.local.get(["domContext"]);
  const value = result.domContext;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as ExtensionDomContext;
}

export async function apiRequest(path: string, init?: RequestInit) {
  const token = await getStoredToken();
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      ...(init?.headers ?? {})
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.error?.message ?? `Request failed: ${response.status}`);
  }

  return payload;
}
