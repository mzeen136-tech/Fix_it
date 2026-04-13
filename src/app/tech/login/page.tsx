"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TechLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ phone_number:"", password:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    const res = await fetch("/api/tech/login", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) { router.push("/tech/dashboard"); router.refresh(); }
    else { setError(data.error); setLoading(false); }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc",
      fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif",
      display:"flex", flexDirection:"column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;600&display=swap');*{box-sizing:border-box}`}</style>

      <nav style={{ background:"#fff", borderBottom:"1px solid #e5e7eb", padding:"16px 24px",
        display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:"#059669",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🔧</div>
        <span style={{ fontWeight:700, fontSize:18, color:"#111827" }}>SnapFix</span>
      </nav>

      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ background:"#fff", borderRadius:16, padding:"40px 36px",
          maxWidth:420, width:"100%", boxShadow:"0 2px 20px rgba(0,0,0,0.06)",
          border:"1px solid #e5e7eb" }}>
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{ width:56, height:56, borderRadius:14, background:"#dcfce7",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:28, margin:"0 auto 14px" }}>🔧</div>
            <h1 style={{ fontSize:22, fontWeight:700, color:"#111827", marginBottom:4 }}>
              Technician Sign In
            </h1>
            <p style={{ color:"#059669", fontSize:15, fontFamily:"'Noto Nastaliq Urdu',serif",
              direction:"rtl", lineHeight:2 }}>تکنیشن لاگ ان</p>
          </div>

          <form onSubmit={submit}>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <label style={{ fontSize:14, fontWeight:600, color:"#374151" }}>WhatsApp Number</label>
                <label style={{ fontSize:14, color:"#6b7280", fontFamily:"'Noto Nastaliq Urdu',serif", direction:"rtl" }}>واٹس ایپ نمبر</label>
              </div>
              <input type="tel" required value={form.phone_number}
                onChange={e => setForm(f=>({...f, phone_number:e.target.value}))}
                placeholder="923001234567"
                style={{ width:"100%", padding:"12px 14px", borderRadius:8,
                  border:"1px solid #d1d5db", fontSize:15, outline:"none", background:"#fafafa" }}
                onFocus={e => e.target.style.borderColor="#059669"}
                onBlur={e => e.target.style.borderColor="#d1d5db"}
              />
            </div>
            <div style={{ marginBottom:24 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <label style={{ fontSize:14, fontWeight:600, color:"#374151" }}>Password</label>
                <label style={{ fontSize:14, color:"#6b7280", fontFamily:"'Noto Nastaliq Urdu',serif", direction:"rtl" }}>پاس ورڈ</label>
              </div>
              <input type="password" required value={form.password}
                onChange={e => setForm(f=>({...f, password:e.target.value}))}
                placeholder="Your password"
                style={{ width:"100%", padding:"12px 14px", borderRadius:8,
                  border:"1px solid #d1d5db", fontSize:15, outline:"none", background:"#fafafa" }}
                onFocus={e => e.target.style.borderColor="#059669"}
                onBlur={e => e.target.style.borderColor="#d1d5db"}
              />
            </div>

            {error && (
              <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8,
                padding:"10px 14px", color:"#991b1b", fontSize:14, marginBottom:16 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width:"100%", padding:"14px", borderRadius:10, border:"none",
              background: loading ? "#d1fae5" : "#059669",
              color:"#fff", fontSize:16, fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
            }}>
              {loading ? "Signing in…" : "Sign In / لاگ ان"}
            </button>
          </form>

          <div style={{ textAlign:"center", marginTop:20, color:"#6b7280", fontSize:14 }}>
            Not registered?{" "}
            <a href="/tech/register" style={{ color:"#059669", fontWeight:600, textDecoration:"none" }}>
              Join SnapFix
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
