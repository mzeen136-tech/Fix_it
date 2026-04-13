"use client";
import { useEffect, useState, useCallback } from "react";

interface Stats {
  total_technicians: number; active_technicians: number;
  pending_approval: number; bidding_jobs: number;
  assigned_jobs: number; completed_today: number; completed_total: number;
}
interface Job {
  job_id: string; customer_phone: string; trade_required: string;
  problem_summary: string; status: string; bids: Bid[];
  customer_city: string | null; customer_area: string | null;
  created_at: string; assigned_tech_phone: string | null;
}
interface Bid { tech_name: string; price: string; eta: string; tech_phone: string; received_at: string; }
interface Tech {
  phone_number: string; name: string; trade: string;
  city: string | null; approval_status: string; created_at: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; glow: string }> = {
  bidding:  { bg:"rgba(245,158,11,0.12)",  color:"#f59e0b",  glow:"rgba(245,158,11,0.3)" },
  assigned: { bg:"rgba(59,130,246,0.12)",  color:"#60a5fa",  glow:"rgba(59,130,246,0.3)" },
  completed:{ bg:"rgba(16,185,129,0.12)",  color:"#34d399",  glow:"rgba(16,185,129,0.3)" },
};
const TRADE_ICONS: Record<string, string> = {
  Plumber:"💧", Electrician:"⚡", HVAC:"❄️", Carpenter:"🪵", Painter:"🎨", Other:"🔧"
};

function StatCard({ label, value, sub, accent }: { label:string; value:number|string; sub?:string; accent:string }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    if (typeof value !== "number") return;
    let start = 0; const end = value; const dur = 800;
    const step = Math.ceil(end / (dur / 16));
    const t = setInterval(() => {
      start += step;
      if (start >= end) { setDisplayed(end); clearInterval(t); }
      else setDisplayed(start);
    }, 16);
    return () => clearInterval(t);
  }, [value]);

  return (
    <div style={{
      background:"#0d1117", border:"1px solid #1a2332", borderRadius:12,
      padding:"24px", flex:1, minWidth:160,
      borderTop:`2px solid ${accent}`, position:"relative", overflow:"hidden",
    }}>
      <div style={{ position:"absolute", top:0, right:0, width:80, height:80,
        background:`radial-gradient(circle at top right, ${accent}15, transparent 70%)` }}/>
      <div style={{ color:"#4a5568", fontSize:11, fontFamily:"'IBM Plex Mono',monospace",
        letterSpacing:1, marginBottom:10 }}>{label.toUpperCase()}</div>
      <div style={{ color:"#e6edf3", fontSize:36, fontFamily:"'Syne',sans-serif",
        fontWeight:800, lineHeight:1 }}>
        {typeof value === "number" ? displayed : value}
      </div>
      {sub && <div style={{ color:"#4a5568", fontSize:12, marginTop:6 }}>{sub}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg:"#1e2631", color:"#64748b", glow:"transparent" };
  return (
    <span style={{
      background:s.bg, color:s.color, fontSize:11, fontWeight:600,
      padding:"3px 10px", borderRadius:20, fontFamily:"'IBM Plex Mono',monospace",
      letterSpacing:0.5, boxShadow:`0 0 8px ${s.glow}`,
      border:`1px solid ${s.color}30`,
    }}>{status}</span>
  );
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}

export default function AdminDashboard() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [jobs, setJobs]     = useState<Job[]>([]);
  const [techs, setTechs]   = useState<Tech[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobFilter, setJobFilter] = useState("all");

  const load = useCallback(async () => {
    const [sRes, jRes, tRes] = await Promise.all([
      fetch("/api/admin/stats"),
      fetch(`/api/admin/jobs?limit=30&status=${jobFilter}`),
      fetch("/api/admin/techs?filter=pending"),
    ]);
    const [s, j, t] = await Promise.all([sRes.json(), jRes.json(), tRes.json()]);
    setStats(s); setJobs(j); setTechs(t); setLoading(false);
  }, [jobFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  async function approveTech(phone: string, action: string) {
    await fetch("/api/admin/techs", { method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ phone_number: phone, action }) });
    load();
  }

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>
      <div style={{ color:"#f59e0b", fontFamily:"'IBM Plex Mono',monospace", fontSize:14,
        animation:"pulse 1.5s infinite" }}>Initializing…</div>
    </div>
  );

  return (
    <div style={{ padding:"32px 36px", maxWidth:1200 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:32 }}>
        <div>
          <div style={{ color:"#4a5568", fontSize:11, fontFamily:"'IBM Plex Mono',monospace",
            letterSpacing:2, marginBottom:6 }}>SNAPFIX / OVERVIEW</div>
          <h1 style={{ color:"#e6edf3", fontSize:28, fontFamily:"'Syne',sans-serif",
            fontWeight:800, letterSpacing:-0.5 }}>Mission Control</h1>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8,
          color:"#4a5568", fontSize:12, fontFamily:"'IBM Plex Mono',monospace" }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"#10b981",
            display:"inline-block", animation:"pulse 2s infinite" }}/>
          Live · auto-refresh 15s
        </div>
      </div>

      {/* Pending Approvals Banner */}
      {techs.length > 0 && (
        <div style={{
          background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.3)",
          borderRadius:10, padding:"16px 20px", marginBottom:28,
          display:"flex", alignItems:"center", gap:12,
        }}>
          <span style={{ fontSize:18 }}>⏳</span>
          <div style={{ flex:1 }}>
            <span style={{ color:"#f59e0b", fontWeight:600, fontSize:14 }}>
              {techs.length} technician{techs.length > 1 ? "s" : ""} waiting for approval
            </span>
            <span style={{ color:"#64748b", fontSize:13, marginLeft:8 }}>
              — {techs.map(t => t.name).join(", ")}
            </span>
          </div>
          <a href="/admin/technicians" style={{
            color:"#f59e0b", fontSize:13, fontWeight:600, textDecoration:"none",
            border:"1px solid rgba(245,158,11,0.3)", borderRadius:6, padding:"6px 14px",
          }}>Review →</a>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display:"flex", gap:16, marginBottom:32, flexWrap:"wrap" }}>
        <StatCard label="Active Techs"     value={stats?.active_technicians ?? 0} accent="#10b981" sub={`${stats?.total_technicians ?? 0} total registered`} />
        <StatCard label="Open Jobs"        value={stats?.bidding_jobs ?? 0}       accent="#f59e0b" sub="awaiting bids" />
        <StatCard label="Assigned"         value={stats?.assigned_jobs ?? 0}      accent="#60a5fa" sub="in progress" />
        <StatCard label="Done Today"       value={stats?.completed_today ?? 0}    accent="#a78bfa" sub={`${stats?.completed_total ?? 0} all time`} />
      </div>

      {/* Jobs Table */}
      <div style={{ background:"#0d1117", border:"1px solid #1a2332", borderRadius:12, overflow:"hidden" }}>

        {/* Table header */}
        <div style={{ padding:"18px 24px", borderBottom:"1px solid #1a2332",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <h2 style={{ color:"#e6edf3", fontSize:16, fontFamily:"'Syne',sans-serif", fontWeight:700 }}>
            Live Jobs
          </h2>
          <div style={{ display:"flex", gap:6 }}>
            {["all","bidding","assigned","completed"].map(f => (
              <button key={f} onClick={() => setJobFilter(f)} style={{
                padding:"5px 12px", borderRadius:6, border:"1px solid",
                borderColor: jobFilter===f ? "#f59e0b" : "#1a2332",
                background: jobFilter===f ? "rgba(245,158,11,0.12)" : "transparent",
                color: jobFilter===f ? "#f59e0b" : "#64748b",
                fontSize:12, cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace",
                textTransform:"capitalize",
              }}>{f}</button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        <div style={{ display:"grid", gridTemplateColumns:"40px 1fr 120px 90px 100px 80px",
          padding:"10px 24px", borderBottom:"1px solid #1a2332" }}>
          {["","Problem","Location","Trade","Status","Bids"].map((h,i) => (
            <div key={i} style={{ color:"#4a5568", fontSize:11,
              fontFamily:"'IBM Plex Mono',monospace", letterSpacing:0.5 }}>{h}</div>
          ))}
        </div>

        {jobs.length === 0 && (
          <div style={{ padding:"48px", textAlign:"center", color:"#4a5568", fontSize:14 }}>
            No jobs found
          </div>
        )}

        {jobs.map(job => (
          <div key={job.job_id}>
            <div
              onClick={() => setExpanded(expanded === job.job_id ? null : job.job_id)}
              style={{
                display:"grid", gridTemplateColumns:"40px 1fr 120px 90px 100px 80px",
                padding:"14px 24px", borderBottom:"1px solid #111827",
                cursor:"pointer", transition:"background 0.1s",
                background: expanded === job.job_id ? "#111827" : "transparent",
              }}
              onMouseOver={e => { if(expanded !== job.job_id) e.currentTarget.style.background="#0f1623"; }}
              onMouseOut={e => { if(expanded !== job.job_id) e.currentTarget.style.background="transparent"; }}
            >
              <div style={{ color:"#4a5568", fontSize:14, paddingTop:2 }}>
                {expanded === job.job_id ? "▾" : "▸"}
              </div>
              <div>
                <div style={{ color:"#e6edf3", fontSize:14, marginBottom:2 }}>{job.problem_summary}</div>
                <div style={{ color:"#4a5568", fontSize:11, fontFamily:"'IBM Plex Mono',monospace" }}>
                  {job.customer_phone} · {timeAgo(job.created_at)}
                </div>
              </div>
              <div style={{ color:"#8b949e", fontSize:13 }}>
                {[job.customer_city, job.customer_area].filter(Boolean).join(", ") || "—"}
              </div>
              <div style={{ fontSize:20 }}>{TRADE_ICONS[job.trade_required] ?? "🔧"}</div>
              <div><StatusPill status={job.status} /></div>
              <div style={{ color:"#f59e0b", fontFamily:"'IBM Plex Mono',monospace", fontSize:13 }}>
                {job.bids?.length ?? 0}
              </div>
            </div>

            {/* Expanded bids row */}
            {expanded === job.job_id && (
              <div style={{ padding:"16px 64px 20px", background:"#111827",
                borderBottom:"1px solid #1a2332", animation:"fadeIn 0.2s ease" }}>
                <div style={{ color:"#4a5568", fontSize:11, fontFamily:"'IBM Plex Mono',monospace",
                  letterSpacing:1, marginBottom:12 }}>BIDS</div>
                {(!job.bids || job.bids.length === 0) ? (
                  <div style={{ color:"#4a5568", fontSize:13 }}>No bids yet</div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {job.bids.map((bid, i) => (
                      <div key={i} style={{
                        background:"#0d1117", border:"1px solid #1a2332", borderRadius:8,
                        padding:"12px 16px", display:"flex", alignItems:"center", gap:16,
                      }}>
                        <div style={{ color:"#e6edf3", fontSize:14, fontWeight:600, minWidth:100 }}>
                          {bid.tech_name}
                        </div>
                        <div style={{ color:"#f59e0b", fontFamily:"'IBM Plex Mono',monospace",
                          fontSize:13, minWidth:100 }}>{bid.price}</div>
                        <div style={{ color:"#60a5fa", fontSize:13 }}>ETA: {bid.eta}</div>
                        {job.assigned_tech_phone === bid.tech_phone && (
                          <span style={{ marginLeft:"auto", color:"#34d399", fontSize:12,
                            background:"rgba(16,185,129,0.1)", padding:"2px 10px", borderRadius:20,
                            border:"1px solid rgba(52,211,153,0.3)" }}>✓ Hired</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
