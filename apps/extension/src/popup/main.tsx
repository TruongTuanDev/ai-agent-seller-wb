import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getApiBaseUrl, getWebBaseUrl, setApiBaseUrl, setWebBaseUrl } from "../lib/api";

function Popup() {
  const [apiBaseUrl, setApiBaseUrlState] = useState("http://localhost:4000");
  const [webBaseUrl, setWebBaseUrlState] = useState("http://localhost:3000");
  const [message, setMessage] = useState("Mo side panel de dang nhap va dieu hanh shop. Popup chi dung de mo nhanh va doi URL staging neu can.");

  useEffect(() => {
    Promise.all([getApiBaseUrl(), getWebBaseUrl()])
      .then(([nextApiBaseUrl, nextWebBaseUrl]) => {
        setApiBaseUrlState(nextApiBaseUrl);
        setWebBaseUrlState(nextWebBaseUrl);
      })
      .catch(() => undefined);
  }, []);

  async function saveSettings() {
    await setApiBaseUrl(apiBaseUrl.trim() || "http://localhost:4000");
    await setWebBaseUrl(webBaseUrl.trim() || "http://localhost:3000");
    setMessage("Da luu API URL va Web URL cho extension.");
  }

  async function openCopilot() {
    await saveSettings();
    await chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" });
    window.close();
  }

  return (
    <div style={{ width: 360, padding: 16, fontFamily: "system-ui", background: "#0f172a", color: "#fff" }}>
      <p style={{ letterSpacing: "0.18em", textTransform: "uppercase", color: "#f59e0b", fontSize: 12 }}>WB Operator AI</p>
      <h1 style={{ fontSize: 22, margin: "8px 0 0" }}>Extension-first Copilot</h1>
      <p style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.85 }}>{message}</p>

      <label style={{ display: "block", marginTop: 12, fontSize: 12, color: "#cbd5e1" }}>API URL</label>
      <input value={apiBaseUrl} onChange={(event) => setApiBaseUrlState(event.target.value)} style={{ width: "100%", marginTop: 6, borderRadius: 12, padding: 12 }} />

      <label style={{ display: "block", marginTop: 12, fontSize: 12, color: "#cbd5e1" }}>Web URL</label>
      <input value={webBaseUrl} onChange={(event) => setWebBaseUrlState(event.target.value)} style={{ width: "100%", marginTop: 6, borderRadius: 12, padding: 12 }} />

      <button
        onClick={() => {
          void saveSettings().catch((error) => {
            setMessage(error instanceof Error ? error.message : "Khong the luu URL.");
          });
        }}
        style={{ marginTop: 12, width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#38bdf8", color: "#0f172a", fontWeight: 700 }}
      >
        Luu cau hinh
      </button>

      <button
        onClick={() => {
          void openCopilot().catch((error) => {
            setMessage(error instanceof Error ? error.message : "Khong the mo side panel.");
          });
        }}
        style={{ marginTop: 12, width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#f59e0b", color: "#111827", fontWeight: 700 }}
      >
        Mo AI Copilot
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
