"use client";
import { useEffect, useState, useCallback } from "react";

interface Job {
  job_id: string; customer_phone: string; trade_required: string;
  problem_summary: string; status: string; bids: Bid[];
  customer_city: string | null; customer_area: string | null;
  created_at: string; assigned_tech_phone: string | null;
}
interface Bid { tech_name: string; price: string; eta: string; tech_phone: string; }

const STATUS_STYLE: Record<string,{bg:string,color:string}> = {
  bidding:  { bg:"rgba(245,158,11,0.12)",  color:"#f59e0b" },
  assigned: { bg:"rgba(59,130,246,0.12)",  color:"#60a5fa" },
  completed:{ bg:"rgba(16,185,129,0.12)",  color:"#34d399" },
};
const TRADE_ICONS: Record<string,string> = {
  Plumber:"💧", Electrician:"⚡", HVAC:"❄️", Carpenter:"🪵", Painter:"🎨", Other:"🔧"
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-PK", { month:"short", day:"numeric",
    hour:"2-digit", minute:"2-digit" });
}

export default function JobsPage() {
  const [jobs, setJobs]       = useState<Job[]>([]);
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/jobs?status=${filter}&limit=100`);
    setJobs(await res.json());
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(job_id: string, status: string) {
    await fetch("/api/admin/jobs", { method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ job_id, status }) });
    await load();
  }

  const filtered = jobs.filter(j =>
    !search ||
    j.problem_summary.toLowerCase().includes(search.toLowerCase()) ||
    j.customer_phone.includes(search) ||
    j.trade_required.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    all: jobs.length,
    bidding: jobs.filter(j=>j.status==="bidding").length,
    assigned: jobs.filter(j=>j.status==="assigned").length,
    completed: jobs.filter(j=>j.status==="completed").length,
  };

  return (
    <div style={{ padding:"32px 36px", maxWidth:1200 }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ color:"#4a5568", fontSize:11, fontFamily:"'IBM Plex Mono',monospace",
          letterSpacing:2, marginBottom:6 }}>SNAPFIX / JOBS</div>
        <h1 style={{ color:"#e6edf3", fontSize:28, fontFamily:"'Syne',sans-serif", fontWeight:800 }}>
          Job Management
        </h1>
      </div>

      {/* Filter tabs with counts */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {(["all","bidding","assigned","completed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:"8px 16px", borderRadius:8, border:"1px solid",
            borderColor: filter===f ? "#f59e0b" : "#1a2332",
            background: filter===f ? "rgba(245,158,11,0.12)" : "transparent",
            color: filter===f ? "#f59e0b" : "#64748b",
            fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6,
          }}>
            <span style={{ textTransform:"capitalize" }}>{f}</span>
            <span style={{
              background: filter===f ? "rgba(245,158,11,0.2)" : "#1a2332",
              color: filter===f ? "#f59e0b" : "#4a5568",
              borderRadius:10, padding:"1px 7px", fontSize:11,
              fontFamily:"'IBM Plex Mono',monospace",
            }}>{counts[f]}</span>
          </button>
        ))}
        <input
          placeholder="Search jobs…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            marginLeft:"auto", padding:"8px 16px", borderRadius:8,
            border:"1px solid #1a2332", background:"#0d1117",
            color:"#e6edf3", fontSize:14, outline:"none", minWidth:200,
          }}
        />
      </div>

      {/* Jobs list */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {loading && (
          <div style={{ padding:"60px", textAlign:"center", color:"#4a5568",
            fontFamily:"'IBM Plex Mono',monospace", animation:"pulse 1.5s infinite" }}>
            Loading jobs…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding:"60px", textAlign:"center", color:"#4a5568" }}>
            No jobs found
          </div>
        )}
        {filtered.map(job => {
          const ss = STATUS_STYLE[job.status] ?? STATUS_STYLE.bidding;
          const isOpen = expanded === job.job_id;
          return (
            <div key={job.job_id} style={{
              background:"#0d1117", border:"1px solid",
              borderColor: isOpen ? "#1e2631" : "#1a2332",
              borderRadius:10, overflow:"hidden",
            }}>
              {/* Job row */}
              <div
                onClick={() => setExpanded(isOpen ? null : job.job_id)}
                style={{ padding:"16px 20px", cursor:"pointer", display:"flex",
                  alignItems:"center", gap:16, transition:"background 0.15s" }}
                onMouseOver={e => { if(!isOpen) e.currentTarget.style.background="#111827"; }}
                onMouseOut={e => { if(!isOpen) e.currentTarget.style.background="transparent"; }}
              >
                <span style={{ fontSize:22, flexShrink:0 }}>{TRADE_ICONS[job.trade_required]}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:"#e6edf3", fontSize:14, fontWeight:500,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {job.problem_summary}
                  </div>
                  <div style={{ color:"#4a5568", fontSize:12, fontFamily:"'IBM Plex Mono',monospace", marginTop:3 }}>
                    {job.customer_phone}
                    {job.customer_city && ` · ${[job.customer_city, job.customer_area].filter(Boolean).join(", ")}`}
                    {" · "}{fmt(job.created_at)}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                  <span style={{ background:ss.bg, color:ss.color, padding:"4px 12px",
                    borderRadius:20, fontSize:11, fontFamily:"'IBM Plex Mono',monospace",
                    border:`1px solid ${ss.color}30` }}>{job.status}</span>
                  <span style={{ color:"#f59e0b", fontFamily:"'IBM Plex Mono',monospace",
                    fontSize:13, minWidth:30 }}>{job.bids?.length ?? 0} bids</span>
                  <span style={{ color:"#4a5568", fontSize:14 }}>{isOpen?"▾":"▸"}</span>
                </div>
              </div>

              {/* Expanded */}
              {isOpen && (
                <div style={{ borderTop:"1px solid #1a2332", padding:"16px 20px",
                  background:"#111827", animation:"fadeIn 0.2s ease" }}>
                  {/* Bids */}
                  <div style={{ color:"#4a5568", fontSize:11, fontFamily:"'IBM Plex Mono',monospace",
                    marginBottom:10, letterSpacing:1 }}>BIDS</div>
                  {(!job.bids||job.bids.length===0) ? (
                    <div style={{ color:"#4a5568", fontSize:13, marginBottom:16 }}>No bids yet</div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
                      {job.bids.map((b,i) => (
                        <div key={i} style={{ display:"flex", gap:16, padding:"10px 14px",
                          background:"#0d1117", borderRadius:8, border:"1px solid #1a2332",
                          alignItems:"center" }}>
                          <span style={{ color:"#e6edf3", fontWeight:600, minWidth:100, fontSize:13 }}>{b.tech_name}</span>
                          <span style={{ color:"#f59e0b", fontFamily:"'IBM Plex Mono',monospace", fontSize:13 }}>{b.price}</span>
                          <span style={{ color:"#60a5fa", fontSize:13 }}>ETA {b.eta}</span>
                          {job.assigned_tech_phone === b.tech_phone && (
                            <span style={{ marginLeft:"auto", color:"#34d399", fontSize:12,
                              background:"rgba(52,211,153,0.1)", padding:"2px 10px",
                              borderRadius:20, border:"1px solid rgba(52,211,153,0.3)" }}>✓ Assigned</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Admin actions */}
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {job.status !== "completed" && (
                      <button onClick={() => updateStatus(job.job_id,"completed")} style={{
                        padding:"7px 16px", borderRadius:6, border:"1px solid rgba(52,211,153,0.3)",
                        background:"rgba(52,211,153,0.1)", color:"#34d399", fontSize:12,
                        cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace",
                      }}>Mark Completed</button>
                    )}
                    {job.status === "completed" && (
                      <button onClick={() => updateStatus(job.job_id,"bidding")} style={{
                        padding:"7px 16px", borderRadius:6, border:"1px solid #1a2332",
                        background:"transparent", color:"#64748b", fontSize:12,
                        cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace",
                      }}>Reopen</button>
                    )}
                    <div style={{ marginLeft:"auto", color:"#4a5568", fontSize:11,
                      fontFamily:"'IBM Plex Mono',monospace", alignSelf:"center" }}>
                      ID: {job.job_id.slice(0,8)}…
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
