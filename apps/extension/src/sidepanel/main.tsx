import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { apiRequest } from "../lib/api";

function SidePanel() {
  const [shopId, setShopId] = useState("shop-demo-1");
  const [result, setResult] = useState<string>("San sang phan tich shop.");
  const [status, setStatus] = useState<string>("Chua goi backend.");

  useEffect(() => {
    chrome.storage.local.get(["domContext"]).then((value) => {
      if (value.domContext?.title) {
        setResult(`DOM context: ${value.domContext.title}`);
      }
    });
  }, []);

  async function run(path: string) {
    try {
      const data = await apiRequest(path, { method: "POST" });
      setStatus("Backend tra ve thanh cong.");
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Goi backend that bai.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", padding: 16, fontFamily: "system-ui", background: "#111827", color: "#fff" }}>
      <p style={{ letterSpacing: "0.18em", textTransform: "uppercase", color: "#fbbf24", fontSize: 12 }}>WB Copilot</p>
      <h1 style={{ fontSize: 28, marginTop: 8 }}>Seller Side Panel</h1>
      <input value={shopId} onChange={(event) => setShopId(event.target.value)} style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12 }} />
      <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
        <button style={{ padding: 12, borderRadius: 12 }} onClick={() => run(`/ai/${shopId}/health-report`)}>Analyze Shop</button>
        <button style={{ padding: 12, borderRadius: 12 }} onClick={() => run(`/ai/${shopId}/review-reply-draft`)}>Generate Review Replies</button>
        <button style={{ padding: 12, borderRadius: 12 }} onClick={() => run(`/ai/${shopId}/product-doctor`)}>Product Doctor</button>
      </div>
      <p style={{ marginTop: 12, opacity: 0.8 }}>{status}</p>
      <pre style={{ whiteSpace: "pre-wrap", marginTop: 16, padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.06)" }}>{result}</pre>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<SidePanel />);
