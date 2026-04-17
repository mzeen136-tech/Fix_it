"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TelegramLinkPage() {
  const [chatId, setChatId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const searchParams = useSearchParams();

  const phone = searchParams?.get("phone") || "";

  async function linkTelegram() {
    if (!chatId.trim()) {
      setError("Please enter your Telegram chat ID");
      return;
    }
    if (!phone) {
      setError("Phone number required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/tech/link-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, telegram_chat_id: chatId.trim() }),
      });

      const data = await res.json();
      if (!res.ok) setError(data.error || "Failed to link");
      else setSuccess(true);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 16 }}>Telegram Linked!</div>
          <p style={{ color: "#888", marginTop: 8 }}>You will now receive FREE job alerts on Telegram</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#fff", fontFamily: "system-ui", padding: 40, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 400 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, textAlign: "center" }}>🔗 Link Telegram</h1>
        <p style={{ color: "#888", textAlign: "center", marginBottom: 24 }}>Receive FREE job alerts via Telegram</p>

        <div style={{ background: "#161b22", borderRadius: 12, padding: 24, border: "1px solid #30363d" }}>
          <label style={{ display: "block", marginBottom: 8, color: "#8b949e" }}>Telegram Chat ID</label>
          <input
            type="text"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="e.g., 123456789"
            style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#fff", outline: "none" }}
          />

          {error && <div style={{ marginTop: 12, color: "#f85149", fontSize: 14 }}>{error}</div>}

          <button onClick={linkTelegram} disabled={loading} style={{ width: "100%", marginTop: 20, padding: 14, borderRadius: 8, border: "none", background: loading ? "#484f58" : "#238636", color: "#fff", cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Linking..." : "Link Telegram"}
          </button>
        </div>

        <div style={{ marginTop: 24, color: "#8b949e", fontSize: 13 }}>
          <strong>How to find Chat ID:</strong>
          <ol style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>Search <strong>@userinfobot</strong> on Telegram</li>
            <li>Start a chat - it shows your Chat ID</li>
          </ol>
        </div>
      </div>
    </div>
  );
}