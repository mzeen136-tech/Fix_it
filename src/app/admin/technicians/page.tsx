"use client";
import { useEffect, useState, useCallback } from "react";

interface Tech {
  phone_number: string; name: string; trade: string; city: string | null;
  area: string | null; is_active: boolean; approval_status: string;
  experience_years: number; total_jobs_done: number;
  registration_source: string; created_at: string;
}

const TRADE_ICONS: Record<string, string> = {
  Plumber:"💧", Electrician:"⚡", HVAC:"❄️", Carpenter:"🪵", Painter:"🎨", Other:"🔧"
};

function ApprovalBadge({ status }: { status: string }) {
  const map: Record<string,{bg:string,color:string}> = {
    approved: { bg:"rgba(16,185,129,0.12)", color:"#34d399" },
    pending:  { bg:"rgba(245,158,11,0.12)", color:"#f59e0b" },
    rejected: { bg:"rgba(239,68,68,0.12)",  color:"#f87171" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{ background:s.bg, color:s.color, padding:"3px 10px",
      borderRadius:20, fontSize:11, fontFamily:"'IBM Plex Mono',monospace",
      border:`1px solid ${s.color}30` }}>
      {status}
    </span>
  );
}

export default function TechniciansPage() {
  const [techs, setTechs]   = useState<Tech[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/techs?filter=${filter}`);
    setTechs(await res.json());
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function act(phone: string, action: string) {
    setActing(phone + action);
    await fetch("/api/admin/techs", { method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ phone_number: phone, action }) });
    await load();
    setActing(null);
  }

  const filtered = techs.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.phone_number.includes(search) || t.trade.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding:"32px 36px", maxWidth:1200 }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <div style={{ color:"#4a5568", fontSize:11, fontFamily:"'IBM Plex Mono',monospace",
          letterSpacing:2, marginBottom:6 }}>SNAPFIX / TECHNICIANS</div>
        <h1 style={{ color:"#e6edf3", fontSize:28, fontFamily:"'Syne',sans-serif", fontWeight:800 }}>
          Technician Registry
        </h1>
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:12, marginBottom:24, flexWrap:"wrap" }}>
        <input
          placeholder="Search name, phone, trade…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            flex:1, minWidth:200, padding:"10px 16px", borderRadius:8,
            border:"1px solid #1a2332", background:"#0d1117",
            color:"#e6edf3", fontSize:14, outline:"none",
          }}
        />
        {["all","pending","active"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:"10px 18px", borderRadius:8, border:"1px solid",
            borderColor: filter===f ? "#f59e0b" : "#1a2332",
            background: filter===f ? "rgba(245,158,11,0.12)" : "transparent",
            color: filter===f ? "#f59e0b" : "#64748b",
            fontSize:13, cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace",
            textTransform:"capitalize",
          }}>{f}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:"#0d1117", border:"1px solid #1a2332", borderRadius:12, overflow:"hidden" }}>
        {/* Column headers */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 120px 110px 80px 80px 180px",
          padding:"12px 24px", borderBottom:"1px solid #1a2332" }}>
          {["Technician","Trade","Location","Status","Exp.","Jobs","Actions"].map((h,i) => (
            <div key={i} style={{ color:"#4a5568", fontSize:11,
              fontFamily:"'IBM Plex Mono',monospace", letterSpacing:0.5 }}>{h}</div>
          ))}
        </div>

        {loading && (
          <div style={{ padding:"40px", textAlign:"center", color:"#4a5568", fontSize:14,
            fontFamily:"'IBM Plex Mono',monospace", animation:"pulse 1.5s infinite" }}>
            Loading…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding:"48px", textAlign:"center", color:"#4a5568", fontSize:14 }}>
            No technicians found
          </div>
        )}

        {filtered.map((tech, i) => (
          <div key={tech.phone_number} style={{
            display:"grid", gridTemplateColumns:"1fr 100px 120px 110px 80px 80px 180px",
            padding:"16px 24px", borderBottom: i < filtered.length-1 ? "1px solid #111827" : "none",
            alignItems:"center",
          }}>
            {/* Name + phone */}
            <div>
              <div style={{ color:"#e6edf3", fontSize:14, fontWeight:500 }}>{tech.name}</div>
              <div style={{ color:"#4a5568", fontSize:11, fontFamily:"'IBM Plex Mono',monospace", marginTop:2 }}>
                {tech.phone_number}
                {tech.registration_source === "portal" && (
                  <span style={{ marginLeft:8, color:"#a78bfa", fontSize:10 }}>portal</span>
                )}
              </div>
            </div>

            {/* Trade */}
            <div style={{ color:"#8b949e", fontSize:14 }}>
              {TRADE_ICONS[tech.trade] ?? "🔧"} {tech.trade}
            </div>

            {/* Location */}
            <div style={{ color:"#8b949e", fontSize:13 }}>
              {[tech.city, tech.area].filter(Boolean).join(", ") || "—"}
            </div>

            {/* Status */}
            <div><ApprovalBadge status={tech.approval_status} /></div>

            {/* Experience */}
            <div style={{ color:"#8b949e", fontSize:13, fontFamily:"'IBM Plex Mono',monospace" }}>
              {tech.experience_years}y
            </div>

            {/* Jobs */}
            <div style={{ color:"#f59e0b", fontFamily:"'IBM Plex Mono',monospace", fontSize:13 }}>
              {tech.total_jobs_done}
            </div>

            {/* Actions */}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {tech.approval_status === "pending" && (<>
                <button onClick={() => act(tech.phone_number,"approve")}
                  disabled={!!acting} style={btnStyle("#10b981")}>
                  {acting === tech.phone_number+"approve" ? "…" : "Approve"}
                </button>
                <button onClick={() => act(tech.phone_number,"reject")}
                  disabled={!!acting} style={btnStyle("#ef4444")}>
                  {acting === tech.phone_number+"reject" ? "…" : "Reject"}
                </button>
              </>)}
              {tech.approval_status === "approved" && (
                <button onClick={() => act(tech.phone_number, tech.is_active ? "deactivate" : "activate")}
                  disabled={!!acting} style={btnStyle(tech.is_active ? "#64748b" : "#60a5fa")}>
                  {tech.is_active ? "Deactivate" : "Activate"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function btnStyle(color: string) {
  return {
    padding:"5px 12px", borderRadius:6,
    border:`1px solid ${color}50`, background:`${color}15`,
    color, fontSize:12, cursor:"pointer", fontWeight:500,
    fontFamily:"'IBM Plex Mono',monospace", whiteSpace:"nowrap" as const,
  };
}
