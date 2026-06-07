export async function getStoredToken() {
  const result = await chrome.storage.local.get(["backendToken"]);
  return String(result.backendToken ?? "");
}

export async function getApiBaseUrl() {
  const result = await chrome.storage.local.get(["apiBaseUrl"]);
  return String(result.apiBaseUrl ?? "http://localhost:4000");
}

export async function setStoredToken(token: string) {
  await chrome.storage.local.set({ backendToken: token });
}

export async function setApiBaseUrl(apiBaseUrl: string) {
  await chrome.storage.local.set({ apiBaseUrl });
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

  return response.json();
}
