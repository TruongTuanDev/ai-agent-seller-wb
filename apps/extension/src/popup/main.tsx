import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { setApiBaseUrl } from "../lib/api";

function Popup() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("demo@wb-agent.local");
  const [password, setPassword] = useState("Demo123456!");
  const [apiBaseUrl, setApiBaseUrlState] = useState("http://localhost:4000");
  const [message, setMessage] = useState("Dang nhap bang email/password hoac dan JWT backend.");

  return (
    <div style={{ width: 320, padding: 16, fontFamily: "system-ui", background: "#0f172a", color: "#fff" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>WB Copilot</h1>
      <p style={{ fontSize: 13, opacity: 0.8 }}>{message}</p>
      <input value={apiBaseUrl} onChange={(event) => setApiBaseUrlState(event.target.value)} style={{ width: "100%", marginTop: 12, borderRadius: 12, padding: 12 }} />
      <input value={email} onChange={(event) => setEmail(event.target.value)} style={{ width: "100%", marginTop: 12, borderRadius: 12, padding: 12 }} />
      <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} style={{ width: "100%", marginTop: 12, borderRadius: 12, padding: 12 }} />
      <button
        onClick={async () => {
          await setApiBaseUrl(apiBaseUrl);
          const result = await chrome.runtime.sendMessage({ type: "LOGIN", email, password });
          if (result?.token) {
            setMessage("Dang nhap thanh cong, token da duoc luu trong extension.");
            setToken(result.token);
          } else {
            setMessage(result?.message ?? "Dang nhap that bai.");
          }
        }}
        style={{ marginTop: 12, width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#10b981", color: "#111827", fontWeight: 700 }}
      >
        Dang nhap backend
      </button>
      <textarea value={token} onChange={(event) => setToken(event.target.value)} style={{ width: "100%", minHeight: 100, marginTop: 12, borderRadius: 12, padding: 12 }} />
      <button
        onClick={async () => {
          await setApiBaseUrl(apiBaseUrl);
          await chrome.runtime.sendMessage({ type: "SET_TOKEN", token });
          setMessage("Da luu backend token vao extension storage.");
        }}
        style={{ marginTop: 12, width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#f59e0b", color: "#111827", fontWeight: 700 }}
      >
        Luu token
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
