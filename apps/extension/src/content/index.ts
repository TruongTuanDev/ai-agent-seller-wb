const rootId = "wb-operator-ai-agent-root";

function createButton(label: string, action: string) {
  const button = document.createElement("button");
  button.textContent = label;
  button.dataset.action = action;
  button.style.cssText = "padding:10px 14px;border-radius:12px;border:none;background:#111827;color:#fff;cursor:pointer;font-size:12px;";
  return button;
}

function mount() {
  if (document.getElementById(rootId)) return;

  const container = document.createElement("div");
  container.id = rootId;
  container.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:999999;display:flex;gap:8px;flex-direction:column;background:#ffffff;padding:12px;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,0.18);";

  const title = document.createElement("div");
  title.textContent = "WB Copilot";
  title.style.cssText = "font:600 13px system-ui;color:#111827;";
  container.appendChild(title);

  ["Analyze Shop", "Generate Review Replies", "Product Doctor"].forEach((label) => {
    container.appendChild(createButton(label, label));
  });

  container.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    if (!target.dataset.action) return;

    const domContext = {
      url: location.href,
      title: document.title,
      kpiHints: Array.from(document.querySelectorAll("[data-testid], h1, h2"))
        .slice(0, 5)
        .map((item) => item.textContent?.trim())
        .filter(Boolean)
    };

    await chrome.storage.local.set({ domContext });
    await chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" }).catch(() => undefined);
    alert(`Da ghi nhan yeu cau: ${target.dataset.action}`);
  });

  document.body.appendChild(container);
}

if (location.hostname.includes("seller.wildberries.ru")) {
  mount();
}
