"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { router.push("/admin"); router.refresh(); }
    else { setError("Invalid username or password"); setLoading(false); }
  }

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", background:"#0f172a",
    }}>
      <div style={{
        background:"#1e293b", borderRadius:16, padding:"48px 40px",
        width:"100%", maxWidth:400, boxShadow:"0 25px 50px rgba(0,0,0,0.5)",
      }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{
            width:56, height:56, borderRadius:14, background:"#10b981",
            display:"flex", alignItems:"center", justifyContent:"center",
            margin:"0 auto 16px", fontSize:28,
          }}>🔧</div>
          <h1 style={{ color:"#f8fafc", fontSize:24, fontWeight:700, margin:0 }}>SnapFix Admin</h1>
          <p style={{ color:"#64748b", fontSize:14, marginTop:6 }}>Dashboard access</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:16 }}>
            <label style={{ color:"#94a3b8", fontSize:13, fontWeight:500, display:"block", marginBottom:6 }}>
              Username
            </label>
            <input
              type="text" required autoFocus
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              style={{
                width:"100%", padding:"12px 16px", borderRadius:8, border:"1px solid #334155",
                background:"#0f172a", color:"#f8fafc", fontSize:15, outline:"none",
                boxSizing:"border-box",
              }}
            />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ color:"#94a3b8", fontSize:13, fontWeight:500, display:"block", marginBottom:6 }}>
              Password
            </label>
            <input
              type="password" required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{
                width:"100%", padding:"12px 16px", borderRadius:8, border:"1px solid #334155",
                background:"#0f172a", color:"#f8fafc", fontSize:15, outline:"none",
                boxSizing:"border-box",
              }}
            />
          </div>

          {error && (
            <div style={{
              background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8,
              padding:"10px 14px", color:"#fca5a5", fontSize:14, marginBottom:16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width:"100%", padding:"14px", borderRadius:8, border:"none",
              background: loading ? "#064e3b" : "#10b981",
              color:"#fff", fontSize:16, fontWeight:600,
              cursor: loading ? "not-allowed" : "pointer",
              transition:"background 0.2s",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
