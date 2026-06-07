import { apiRequest, getStoredToken, setStoredToken } from "../lib/api";
import type { ExtensionMessage } from "../types/messages";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  (async () => {
    if (message.type === "OPEN_SIDE_PANEL") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "SET_TOKEN") {
      await setStoredToken(message.token);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "LOGIN") {
      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: message.email,
          password: message.password
        })
      });
      if (result?.token) {
        await setStoredToken(result.token);
      }
      sendResponse(result);
      return;
    }

    if (message.type === "GET_TOKEN") {
      sendResponse({ token: await getStoredToken() });
      return;
    }

    if (message.type === "ANALYZE_SHOP") {
      sendResponse(await apiRequest(`/ai/${message.shopId}/health-report`, { method: "POST" }));
      return;
    }

    if (message.type === "REVIEW_REPLY") {
      sendResponse(await apiRequest(`/ai/${message.shopId}/review-reply-draft`, { method: "POST" }));
      return;
    }

    if (message.type === "PRODUCT_DOCTOR") {
      sendResponse(await apiRequest(`/ai/${message.shopId}/product-doctor`, { method: "POST" }));
    }
  })();

  return true;
});
