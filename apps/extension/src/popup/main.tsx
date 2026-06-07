import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { setApiBaseUrl } from "../lib/api";

function Popup() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("demo@wb-agent.local");
  const [password, setPassword] = useState("Demo123456!");
  const [apiBaseUrl, setApiBaseUrlState] = useState("http://localhost:4000");
  const [message, setMessage] = useState("Dang nhap backend de mo chat-first Copilot trong side panel.");

  async function openCopilot() {
    await chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" });
    window.close();
  }

  return (
    <div style={{ width: 340, padding: 16, fontFamily: "system-ui", background: "#0f172a", color: "#fff" }}>
      <p style={{ letterSpacing: "0.18em", textTransform: "uppercase", color: "#f59e0b", fontSize: 12 }}>WB Operator AI</p>
      <h1 style={{ fontSize: 22, margin: "8px 0 0" }}>Popup Login</h1>
      <p style={{ fontSize: 13, opacity: 0.85 }}>{message}</p>

      <input value={apiBaseUrl} onChange={(event) => setApiBaseUrlState(event.target.value)} style={{ width: "100%", marginTop: 12, borderRadius: 12, padding: 12 }} />
      <input value={email} onChange={(event) => setEmail(event.target.value)} style={{ width: "100%", marginTop: 12, borderRadius: 12, padding: 12 }} />
      <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} style={{ width: "100%", marginTop: 12, borderRadius: 12, padding: 12 }} />

      <button
        onClick={async () => {
          try {
            await setApiBaseUrl(apiBaseUrl);
            const result = await chrome.runtime.sendMessage({ type: "LOGIN", email, password });
            if (result?.token) {
              setMessage("Dang nhap thanh cong. Copilot da san sang.");
              setToken(result.token);
              return;
            }
            setMessage(result?.message ?? "Dang nhap that bai.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Dang nhap that bai.");
          }
        }}
        style={{ marginTop: 12, width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#f59e0b", color: "#111827", fontWeight: 700 }}
      >
        Dang nhap backend
      </button>

      <textarea
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="Hoac paste backend JWT neu can"
        style={{ width: "100%", minHeight: 90, marginTop: 12, borderRadius: 12, padding: 12 }}
      />

      <button
        onClick={async () => {
          await setApiBaseUrl(apiBaseUrl);
          await chrome.runtime.sendMessage({ type: "SET_TOKEN", token });
          setMessage("Da luu backend JWT vao extension storage.");
        }}
        style={{ marginTop: 12, width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#38bdf8", color: "#0f172a", fontWeight: 700 }}
      >
        Luu JWT
      </button>

      <button
        onClick={openCopilot}
        style={{ marginTop: 12, width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#fff", fontWeight: 700 }}
      >
        Mo AI Copilot
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
