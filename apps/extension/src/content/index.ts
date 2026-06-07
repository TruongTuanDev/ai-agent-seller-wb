async function syncDomContext() {
  const domContext = {
    url: location.href,
    title: document.title,
    kpiHints: Array.from(document.querySelectorAll("[data-testid], h1, h2"))
      .slice(0, 5)
      .map((item) => item.textContent?.trim())
      .filter(Boolean)
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
  void syncDomContext();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountCopilotButton, { once: true });
  } else {
    mountCopilotButton();
  }
}
