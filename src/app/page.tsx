export default function Home() {
  return (
    <main style={{
      minHeight:"100vh", background:"#080c14", display:"flex",
      flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'DM Sans','Segoe UI',sans-serif", gap:32, padding:24,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap')`}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🔧</div>
        <h1 style={{ color:"#e6edf3", fontSize:36, fontFamily:"'Syne',sans-serif",
          fontWeight:800, letterSpacing:-1, margin:0 }}>SnapFix</h1>
        <p style={{ color:"#4a5568", fontSize:15, marginTop:8 }}>
          WhatsApp Home Services Dispatch
        </p>
      </div>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
        {[
          { href:"/admin",         label:"Admin Dashboard", color:"#f59e0b" },
          { href:"/tech/register", label:"Tech Register",   color:"#10b981" },
          { href:"/tech/login",    label:"Tech Login",      color:"#60a5fa" },
        ].map(l => (
          <a key={l.href} href={l.href} style={{
            padding:"12px 24px", borderRadius:10, textDecoration:"none",
            background:`${l.color}15`, border:`1px solid ${l.color}40`,
            color:l.color, fontSize:14, fontWeight:600, transition:"all 0.15s",
          }}>
            {l.label} →
          </a>
        ))}
      </div>
      <div style={{ color:"#1e2631", fontSize:12, fontFamily:"'IBM Plex Mono',monospace" }}>
        v2.0 · POST /api/whatsapp
      </div>
    </main>
  );
}
