type PageType = "dashboard" | "product" | "feedbacks" | "analytics" | "orders" | "unknown";

function detectPageType(url: URL): PageType {
  const path = url.pathname.toLowerCase();
  if (path.includes("feedback")) {
    return "feedbacks";
  }
  if (path.includes("analytics")) {
    return "analytics";
  }
  if (path.includes("order")) {
    return "orders";
  }
  if (path.includes("product") || path.includes("card")) {
    return "product";
  }
  if (path === "/" || path.includes("dashboard")) {
    return "dashboard";
  }
  return "unknown";
}

function extractProductId(url: URL) {
  const match = `${url.pathname}${url.search}`.match(/(\d{5,})/);
  return match?.[1];
}

function extractSku() {
  const text = document.body?.innerText ?? "";
  const match = text.match(/(?:SKU|nmID|vendor code|vendorcode|Артикул)\s*[:#-]?\s*([A-Z0-9-]{4,})/i);
  return match?.[1];
}

function buildVisibleTextSummary() {
  return Array.from(document.querySelectorAll("h1, h2, h3, [data-testid], [role='heading'], button"))
    .map((item) => item.textContent?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value) => value.length >= 3)
    .slice(0, 18)
    .join(" | ")
    .slice(0, 900);
}

async function syncDomContext() {
  const url = new URL(location.href);
  const domContext = {
    url: location.href,
    pageType: detectPageType(url),
    productId: extractProductId(url),
    sku: extractSku(),
    visibleTextSummary: buildVisibleTextSummary()
  };

  await chrome.storage.local.set({ domContext });
}

function mountCopilotButton() {
  if (document.getElementById("wb-operator-copilot-button")) {
    return;
  }

  const button = document.createElement("button");
  button.id = "wb-operator-copilot-button";
  button.textContent = "WB Copilot";
  Object.assign(button.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: "999999",
    padding: "12px 16px",
    borderRadius: "999px",
    border: "none",
    background: "linear-gradient(135deg, #f59e0b, #fb7185)",
    color: "#111827",
    fontWeight: "700",
    boxShadow: "0 12px 28px rgba(0,0,0,0.22)",
    cursor: "pointer"
  });

  button.addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" });
  });

  document.body.appendChild(button);
}

if (location.hostname.includes("seller.wildberries.ru")) {
  const syncSoon = () => {
    window.clearTimeout((window as Window & { __wbOperatorContextTimer?: number }).__wbOperatorContextTimer);
    (window as Window & { __wbOperatorContextTimer?: number }).__wbOperatorContextTimer = window.setTimeout(() => {
      void syncDomContext();
    }, 250);
  };

  void syncDomContext();
  const observer = new MutationObserver(syncSoon);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: false });
  window.addEventListener("popstate", syncSoon);
  window.addEventListener("hashchange", syncSoon);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountCopilotButton, { once: true });
  } else {
    mountCopilotButton();
  }
}
