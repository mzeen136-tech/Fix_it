"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface TechProfile {
  phone_number: string;
  name: string; trade: string; city: string|null; area: string|null;
  experience_years: number; total_jobs_done: number; is_active: boolean;
  approval_status: string; created_at: string; telegram_chat_id: string | null;
}
interface Job {
  job_id: string; trade_required: string; problem_summary: string;
  status: string; customer_city: string|null; customer_area: string|null;
  bids: Bid[]; created_at: string; updated_at: string;
}
interface Bid { tech_phone: string; price: string; eta: string; }
interface DashData { tech: TechProfile; jobs: Job[]; openJobs: Job[]; earnings: number; }

const STATUS_STYLE: Record<string,{bg:string,color:string,label:string,urdu:string}> = {
  assigned:  { bg:"#eff6ff", color:"#1d4ed8", label:"In Progress", urdu:"جاری ہے" },
  completed: { bg:"#f0fdf4", color:"#15803d", label:"Completed",   urdu:"مکمل" },
  bidding:   { bg:"#fffbeb", color:"#92400e", label:"Bidding",      urdu:"بولی" },
};
const TRADE_ICONS: Record<string,string> = {
  Plumber:"💧", Electrician:"⚡", HVAC:"❄️", Carpenter:"🪵", Painter:"🎨", Other:"🔧"
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { month:"short", day:"numeric", year:"numeric" });
}

export default function TechDashboard() {
  const router = useRouter();
  const [data, setData]       = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string|null>(null);
  const [tab, setTab]         = useState<"assigned"|"open"|"history">("assigned");

  async function load() {
    const res = await fetch("/api/tech/dashboard");
    if (res.status === 401) { router.push("/tech/login"); return; }
    setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function completeJob(job_id: string) {
    setCompleting(job_id);
    await fetch("/api/tech/complete-job", { method:"POST",
      headers:{"Content-Type":"application/json"}, body: JSON.stringify({ job_id }) });
    await load();
    setCompleting(null);
  }

  async function logout() {
    await fetch("/api/tech/logout", { method:"POST" });
    router.push("/tech/login");
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"#f8fafc", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ color:"#059669", fontSize:15 }}>Loading… / لوڈ ہو رہا ہے…</div>
    </div>
  );

  const { tech, jobs, openJobs, earnings } = data!;
  const assignedJobs  = jobs.filter(j => j.status === "assigned");
  const completedJobs = jobs.filter(j => j.status === "completed");

  const myBidPrice = (job: Job, phone?: string) => {
    const bid = job.bids?.find((b: Bid) => b.tech_phone === phone);
    return bid?.price ?? "—";
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc",
      fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;600&display=swap');*{box-sizing:border-box}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>

      {/* Nav */}
      <nav style={{ background:"#fff", borderBottom:"1px solid #e5e7eb",
        padding:"14px 24px", display:"flex", alignItems:"center", gap:12,
        position:"sticky", top:0, zIndex:10 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:"#059669",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🔧</div>
        <div>
          <div style={{ fontWeight:700, fontSize:16, color:"#111827" }}>SnapFix</div>
          <div style={{ fontSize:12, color:"#6b7280" }}>Technician Portal</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#111827" }}>{tech.name}</div>
            <div style={{ fontSize:12, color:"#059669" }}>
              {TRADE_ICONS[tech.trade]} {tech.trade}
            </div>
          </div>
          <button onClick={logout} style={{ padding:"8px 14px", borderRadius:8, border:"1px solid #e5e7eb",
            background:"#fff", color:"#6b7280", fontSize:13, cursor:"pointer" }}>
            Sign out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth:700, margin:"0 auto", padding:"28px 16px" }}>

        {/* Welcome */}
        <div style={{ marginBottom:24, animation:"fadeIn 0.3s ease" }}>
          <h1 style={{ fontSize:24, fontWeight:700, color:"#111827", marginBottom:2 }}>
            Welcome, {tech.name}!
          </h1>
          <p style={{ color:"#059669", fontSize:16, fontFamily:"'Noto Nastaliq Urdu',serif",
            direction:"rtl", lineHeight:2 }}>خوش آمدید، {tech.name}!</p>
        </div>

        {/* Stat cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:28 }}>
          {[
            { label:"Total Earned", urdu:"کل کمائی", value:`Rs. ${earnings.toLocaleString()}`, color:"#059669" },
            { label:"Jobs Done",    urdu:"مکمل کام",  value:tech.total_jobs_done,                color:"#1d4ed8" },
            { label:"Experience",   urdu:"تجربہ",     value:`${tech.experience_years}y`,          color:"#7c3aed" },
          ].map(s => (
            <div key={s.label} style={{ background:"#fff", borderRadius:12, padding:"18px",
              border:"1px solid #e5e7eb", borderTop:`3px solid ${s.color}` }}>
              <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>{s.label}</div>
              <div style={{ fontSize:22, fontWeight:700, color:"#111827", marginBottom:2 }}>{s.value}</div>
              <div style={{ fontSize:12, color:"#9ca3af", fontFamily:"'Noto Nastaliq Urdu',serif",
                direction:"rtl" }}>{s.urdu}</div>
            </div>
          ))}
        </div>

        {/* Pending approval notice */}
        {tech.approval_status === "pending" && (
          <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:10,
            padding:"14px 18px", marginBottom:20, display:"flex", gap:10 }}>
            <span style={{ fontSize:20 }}>⏳</span>
            <div>
              <div style={{ fontWeight:600, color:"#92400e", fontSize:14 }}>Pending Approval</div>
              <div style={{ color:"#b45309", fontSize:13, marginTop:2 }}>
                Your account is under review. Job alerts will start once approved.
              </div>
              <div style={{ color:"#b45309", fontSize:14, fontFamily:"'Noto Nastaliq Urdu',serif",
                direction:"rtl", marginTop:4, lineHeight:2 }}>
                آپ کا اکاؤنٹ زیر جائزہ ہے۔
              </div>
            </div>
          </div>
        )}

        {/* Telegram not linked notice */}
        {!tech.telegram_chat_id && tech.approval_status === "approved" && (
          <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10,
            padding:"14px 18px", marginBottom:20, display:"flex", gap:10, alignItems:"center" }}>
            <span style={{ fontSize:20 }}>✈️</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600, color:"#1d4ed8", fontSize:14 }}>Get FREE Job Alerts!</div>
              <div style={{ color:"#6b7280", fontSize:13, marginTop:2 }}>
                Link Telegram to receive instant job notifications - completely FREE!
              </div>
            </div>
            <a href={`/tech/link-telegram?phone=${encodeURIComponent(data?.tech?.phone_number || "")}`}
              style={{ padding:"8px 16px", borderRadius:8, background:"#1d4ed8", color:"#fff",
                fontSize:13, fontWeight:600, textDecoration:"none" }}>
              Link Telegram
            </a>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:20,
          background:"#fff", borderRadius:10, padding:4, border:"1px solid #e5e7eb" }}>
          {([
            { key:"assigned", label:`In Progress (${assignedJobs.length})`, urdu:"جاری" },
            { key:"open",     label:`Open Jobs (${openJobs.length})`,        urdu:"کھلے کام" },
            { key:"history",  label:`History (${completedJobs.length})`,     urdu:"تاریخ" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex:1, padding:"10px 8px", borderRadius:8, border:"none",
              background: tab===t.key ? "#059669" : "transparent",
              color: tab===t.key ? "#fff" : "#6b7280",
              fontSize:13, fontWeight: tab===t.key ? 700 : 400, cursor:"pointer",
              transition:"all 0.15s", display:"flex", flexDirection:"column",
              alignItems:"center", gap:2,
            }}>
              <span>{t.label}</span>
              <span style={{ fontSize:11, opacity:0.8, fontFamily:"'Noto Nastaliq Urdu',serif" }}>{t.urdu}</span>
            </button>
          ))}
        </div>

        {/* Jobs list */}
        <div style={{ display:"flex", flexDirection:"column", gap:10, animation:"fadeIn 0.2s ease" }}>
          {tab === "assigned" && assignedJobs.map(job => (
            <JobCard key={job.job_id} job={job} showComplete
              onComplete={() => completeJob(job.job_id)}
              completing={completing === job.job_id}
              myPrice={myBidPrice(job)} />
          ))}
          {tab === "assigned" && assignedJobs.length === 0 && <Empty en="No jobs in progress" ur="کوئی کام جاری نہیں" />}

          {tab === "open" && openJobs.map(job => (
            <JobCard key={job.job_id} job={job} showComplete={false}
              onComplete={() => {}} completing={false} myPrice="" />
          ))}
          {tab === "open" && openJobs.length === 0 && <Empty en="No open jobs right now" ur="ابھی کوئی کھلا کام نہیں" />}

          {tab === "history" && completedJobs.map(job => (
            <JobCard key={job.job_id} job={job} showComplete={false}
              onComplete={() => {}} completing={false}
              myPrice={myBidPrice(job)} isCompleted />
          ))}
          {tab === "history" && completedJobs.length === 0 && <Empty en="No completed jobs yet" ur="ابھی تک کوئی کام مکمل نہیں" />}
        </div>
      </div>
    </div>
  );
}

function JobCard({ job, showComplete, onComplete, completing, myPrice, isCompleted }: {
  job: Job; showComplete: boolean; onComplete: () => void;
  completing: boolean; myPrice: string; isCompleted?: boolean;
}) {
  const ss = STATUS_STYLE[job.status] ?? STATUS_STYLE.bidding;
  return (
    <div style={{ background:"#fff", borderRadius:12, padding:"18px 20px",
      border:"1px solid #e5e7eb", animation:"fadeIn 0.2s ease" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <span style={{ fontSize:20 }}>{TRADE_ICONS[job.trade_required]}</span>
            <span style={{ fontWeight:600, fontSize:15, color:"#111827" }}>{job.problem_summary}</span>
          </div>
          {(job.customer_city || job.customer_area) && (
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:4 }}>
              📍 {[job.customer_city, job.customer_area].filter(Boolean).join(", ")}
            </div>
          )}
          <div style={{ fontSize:12, color:"#9ca3af" }}>{fmt(job.created_at)}</div>
          {myPrice && myPrice !== "—" && (
            <div style={{ marginTop:8, fontSize:13, color:"#059669", fontWeight:600 }}>
              Your price: {myPrice}
            </div>
          )}
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8, flexShrink:0 }}>
          <span style={{ background:ss.bg, color:ss.color, padding:"4px 12px",
            borderRadius:20, fontSize:12, fontWeight:600 }}>
            {ss.label} / {ss.urdu}
          </span>
          {showComplete && (
            <button onClick={onComplete} disabled={completing} style={{
              padding:"8px 16px", borderRadius:8, border:"none",
              background: completing ? "#d1fae5" : "#059669",
              color:"#fff", fontSize:13, fontWeight:600, cursor: completing ? "not-allowed" : "pointer",
            }}>
              {completing ? "Saving…" : "Mark Done ✓"}
            </button>
          )}
          {isCompleted && (
            <span style={{ fontSize:12, color:"#15803d" }}>✓ Completed</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ en, ur }: { en: string; ur: string }) {
  return (
    <div style={{ textAlign:"center", padding:"48px 20px", color:"#9ca3af" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
      <div style={{ fontSize:15, marginBottom:4 }}>{en}</div>
      <div style={{ fontSize:14, fontFamily:"'Noto Nastaliq Urdu',serif", direction:"rtl" }}>{ur}</div>
    </div>
  );
}
