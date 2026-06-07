export async function getAuthToken() {
  const result = await chrome.storage.local.get(["backendToken"]);
  return String(result.backendToken ?? "");
}

export async function setAuthToken(token: string) {
  await chrome.storage.local.set({ backendToken: token });
}

export async function clearAuthToken() {
  await chrome.storage.local.remove(["backendToken"]);
}
