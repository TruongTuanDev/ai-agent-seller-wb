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
  })();

  return true;
});
