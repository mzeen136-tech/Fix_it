"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/admin",              label: "Overview",      icon: "◈" },
  { href: "/admin/jobs",         label: "Jobs",          icon: "⚡" },
  { href: "/admin/technicians",  label: "Technicians",   icon: "🔧" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  if (pathname === "/admin/login") return <>{children}</>;

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#080c14", fontFamily:"'DM Sans', 'Segoe UI', sans-serif" }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:#0d1117;} ::-webkit-scrollbar-thumb{background:#1e2631;border-radius:4px;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes countUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Sidebar */}
      <aside style={{
        width:220, background:"#0d1117", borderRight:"1px solid #1a2332",
        display:"flex", flexDirection:"column", padding:"0", flexShrink:0,
        position:"sticky", top:0, height:"100vh",
      }}>
        {/* Logo */}
        <div style={{ padding:"28px 20px 24px", borderBottom:"1px solid #1a2332" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#d97706,#f59e0b)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, boxShadow:"0 0 20px rgba(245,158,11,0.3)",
            }}>🔧</div>
            <div>
              <div style={{ color:"#e6edf3", fontSize:16, fontFamily:"'Syne',sans-serif", fontWeight:700 }}>SnapFix</div>
              <div style={{ color:"#4a5568", fontSize:10, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1 }}>MISSION CONTROL</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:"16px 12px" }}>
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <a key={href} href={href} style={{
                display:"flex", alignItems:"center", gap:10,
                padding:"10px 12px", borderRadius:8, marginBottom:4,
                background: active ? "rgba(245,158,11,0.12)" : "transparent",
                borderLeft: active ? "2px solid #f59e0b" : "2px solid transparent",
                color: active ? "#f59e0b" : "#64748b",
                textDecoration:"none", fontSize:14, fontWeight: active ? 600 : 400,
                transition:"all 0.15s",
              }}>
                <span style={{ fontSize:16 }}>{icon}</span>
                {label}
                {active && <div style={{ marginLeft:"auto", width:4, height:4, borderRadius:"50%", background:"#f59e0b" }}/>}
              </a>
            );
          })}
        </nav>

        {/* Bottom: logout */}
        <div style={{ padding:"16px 12px", borderTop:"1px solid #1a2332" }}>
          <div style={{ color:"#4a5568", fontSize:10, fontFamily:"'IBM Plex Mono',monospace", padding:"0 12px 8px" }}>SIGNED IN AS ADMIN</div>
          <button onClick={logout} disabled={loggingOut} style={{
            width:"100%", padding:"10px 12px", borderRadius:8, border:"none",
            background:"transparent", color:"#64748b", fontSize:14,
            cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:10,
            transition:"all 0.15s",
          }}
          onMouseOver={e => (e.currentTarget.style.color = "#ef4444")}
          onMouseOut={e => (e.currentTarget.style.color = "#64748b")}
          >
            <span>⟵</span> {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, overflow:"auto", animation:"fadeIn 0.3s ease" }}>
        {children}
      </main>
    </div>
  );
}
