"use client";
import { useEffect, useState, useCallback, useRef } from "react";

const TRADES  = ["Plumber","Electrician","HVAC","Carpenter","Painter","Other"];
const CITIES  = ["Islamabad","Rawalpindi","Lahore","Karachi","Peshawar","Quetta",
                  "Multan","Faisalabad","Sialkot","Gujranwala","Hyderabad","Abbottabad","Other"];
const TRADE_ICONS: Record<string,string> = {
  Plumber:"💧", Electrician:"⚡", HVAC:"❄️", Carpenter:"🪵", Painter:"🎨", Other:"🔧"
};

interface Tech {
  phone_number:string; name:string; trade:string; city:string|null;
  area:string|null; is_active:boolean; approval_status:string;
  experience_years:number; total_jobs_done:number; registration_source:string; created_at:string;
}
interface ImportRow { phone:string; name:string; status:"added"|"duplicate"|"error"; reason?:string; }

// ── Shared styles ─────────────────────────────────────────────────────────────
const mono = "'IBM Plex Mono',monospace";
const syne = "'Syne',sans-serif";
const inp: React.CSSProperties = {
  width:"100%", padding:"10px 14px", borderRadius:8,
  border:"1px solid #1a2332", background:"#080c14",
  color:"#e6edf3", fontSize:14, outline:"none", boxSizing:"border-box",
};
const sel: React.CSSProperties = { ...inp, cursor:"pointer" };
function btn(color:string, size:"sm"|"md"="md"): React.CSSProperties {
  return {
    padding: size==="sm" ? "5px 12px" : "10px 20px",
    borderRadius:8, border:`1px solid ${color}50`,
    background:`${color}18`, color,
    fontSize: size==="sm" ? 12 : 13, cursor:"pointer", fontWeight:500,
    fontFamily:mono, whiteSpace:"nowrap", transition:"opacity .15s",
  };
}

function ApprovalBadge({ status }:{ status:string }) {
  const map:Record<string,{bg:string,color:string}> = {
    approved:{bg:"rgba(16,185,129,.12)",color:"#34d399"},
    pending: {bg:"rgba(245,158,11,.12)", color:"#f59e0b"},
    rejected:{bg:"rgba(239,68,68,.12)",  color:"#f87171"},
  };
  const s = map[status] ?? map.pending;
  return <span style={{background:s.bg,color:s.color,padding:"3px 10px",borderRadius:20,
    fontSize:11,fontFamily:mono,border:`1px solid ${s.color}30`}}>{status}</span>;
}

// ── Manual Add Form ────────────────────────────────────────────────────────────
function AddTechForm({ onAdded }:{ onAdded:()=>void }) {
  const [form, setForm] = useState({
    name:"", phone_number:"", trade:"", city:"", area:"",
    experience_years:"0", cnic:"",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{type:"ok"|"err", text:string}|null>(null);

  function f(k:keyof typeof form, v:string) { setForm(p=>({...p,[k]:v})); }

  async function submit(e:React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg(null);
    const res = await fetch("/api/admin/techs", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg({type:"ok", text:`✅ ${form.name} added successfully!`});
      setForm({name:"",phone_number:"",trade:"",city:"",area:"",experience_years:"0",cnic:""});
      onAdded();
    } else {
      setMsg({type:"err", text:data.error});
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit} style={{
      background:"#0d1117", border:"1px solid #1a2332", borderRadius:12, padding:"24px 28px",
    }}>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div>
          <label style={{color:"#64748b",fontSize:12,fontFamily:mono,display:"block",marginBottom:6}}>FULL NAME *</label>
          <input style={inp} required value={form.name} placeholder="Ali Ahmed"
            onChange={e=>f("name",e.target.value)} />
        </div>
        <div>
          <label style={{color:"#64748b",fontSize:12,fontFamily:mono,display:"block",marginBottom:6}}>WHATSAPP NUMBER *</label>
          <input style={inp} required value={form.phone_number} placeholder="923001234567 or 03001234567"
            onChange={e=>f("phone_number",e.target.value)} />
        </div>
        <div>
          <label style={{color:"#64748b",fontSize:12,fontFamily:mono,display:"block",marginBottom:6}}>TRADE *</label>
          <select style={sel} required value={form.trade} onChange={e=>f("trade",e.target.value)}>
            <option value="">Select trade</option>
            {TRADES.map(t=><option key={t} value={t}>{TRADE_ICONS[t]} {t}</option>)}
          </select>
        </div>
        <div>
          <label style={{color:"#64748b",fontSize:12,fontFamily:mono,display:"block",marginBottom:6}}>CITY *</label>
          <select style={sel} required value={form.city} onChange={e=>f("city",e.target.value)}>
            <option value="">Select city</option>
            {CITIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{color:"#64748b",fontSize:12,fontFamily:mono,display:"block",marginBottom:6}}>AREA / NEIGHBOURHOOD</label>
          <input style={inp} value={form.area} placeholder="DHA, F-7, Gulberg…"
            onChange={e=>f("area",e.target.value)} />
        </div>
        <div>
          <label style={{color:"#64748b",fontSize:12,fontFamily:mono,display:"block",marginBottom:6}}>EXPERIENCE (years)</label>
          <select style={sel} value={form.experience_years} onChange={e=>f("experience_years",e.target.value)}>
            {Array.from({length:21},(_,i)=>i).map(y=>(
              <option key={y} value={y}>{y===0?"< 1 year":`${y} year${y>1?"s":""}`}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{color:"#64748b",fontSize:12,fontFamily:mono,display:"block",marginBottom:6}}>CNIC (optional)</label>
          <input style={inp} value={form.cnic} placeholder="42101-1234567-1"
            onChange={e=>f("cnic",e.target.value)} />
        </div>
      </div>

      {msg && (
        <div style={{
          marginTop:16, padding:"10px 14px", borderRadius:8, fontSize:13,
          background: msg.type==="ok" ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)",
          color: msg.type==="ok" ? "#34d399" : "#f87171",
          border: `1px solid ${msg.type==="ok" ? "#34d39940" : "#f8717140"}`,
        }}>{msg.text}</div>
      )}

      <div style={{marginTop:20}}>
        <button type="submit" disabled={saving} style={{
          ...btn("#10b981","md"), padding:"12px 28px", fontFamily:syne,
          opacity: saving ? .6 : 1,
        }}>
          {saving ? "Adding…" : "Add Technician"}
        </button>
      </div>
    </form>
  );
}

// ── Excel Import Section ──────────────────────────────────────────────────────
function ExcelImport({ onImported }:{ onImported:()=>void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string,string>[]>([]);
  const [results, setResults] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(false);
  const [duplicates, setDuplicates] = useState<ImportRow[]>([]);
  const [dupAction, setDupAction] = useState<"skip"|"overwrite"|null>(null);

  // Download CSV template
  function downloadTemplate() {
    const headers = ["Name","Phone","Trade","City","Area","Experience_Years","CNIC"];
    const example = ["Ali Ahmed","923001234567","Plumber","Islamabad","F-7","5","42101-1234567-1"];
    const csv = [headers.join(","), example.join(",")].join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download="snapfix_technicians_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // Parse CSV/Excel file
  async function handleFile(e:React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResults([]); setPreview(false); setDupAction(null);

    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return;

    const headers = lines[0].split(",").map(h=>h.trim().replace(/"/g,""));
    const parsed = lines.slice(1).map(line => {
      const vals = line.split(",").map(v=>v.trim().replace(/"/g,""));
      const row:Record<string,string> = {};
      headers.forEach((h,i) => { row[h] = vals[i] ?? ""; });
      return row;
    }).filter(r => Object.values(r).some(v=>v.length>0));

    setRows(parsed);
    setPreview(true);
  }

  async function runImport() {
    setImporting(true);
    const res = await fetch("/api/admin/techs", {
      method:"PUT", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    const importResults: ImportRow[] = data.results ?? [];
    setResults(importResults);

    const dups = importResults.filter(r=>r.status==="duplicate");
    if (dups.length > 0) {
      setDuplicates(dups);
    } else {
      onImported();
    }
    setImporting(false);
    setPreview(false);
  }

  const added  = results.filter(r=>r.status==="added").length;
  const errors = results.filter(r=>r.status==="error").length;

  return (
    <div style={{background:"#0d1117",border:"1px solid #1a2332",borderRadius:12,padding:"24px 28px"}}>

      {/* Template download */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24,
        padding:"14px 18px",background:"rgba(96,165,250,.06)",border:"1px solid rgba(96,165,250,.2)",
        borderRadius:8}}>
        <div style={{flex:1}}>
          <div style={{color:"#60a5fa",fontSize:14,fontWeight:600,marginBottom:4}}>Excel/CSV Template</div>
          <div style={{color:"#4a5568",fontSize:12}}>
            Download the template, fill in your technicians, then upload it back.
          </div>
        </div>
        <button onClick={downloadTemplate} style={btn("#60a5fa","md")}>
          ⬇ Download Template
        </button>
      </div>

      {/* Upload area */}
      <div
        onClick={()=>fileRef.current?.click()}
        style={{
          border:"1.5px dashed #1a2332", borderRadius:10, padding:"36px",
          textAlign:"center", cursor:"pointer", marginBottom:16,
          transition:"border-color .15s",
        }}
        onMouseOver={e=>(e.currentTarget.style.borderColor="#f59e0b")}
        onMouseOut={e=>(e.currentTarget.style.borderColor="#1a2332")}
      >
        <div style={{fontSize:32,marginBottom:8}}>📂</div>
        <div style={{color:"#e6edf3",fontSize:14,fontWeight:600}}>Click to upload CSV or Excel</div>
        <div style={{color:"#4a5568",fontSize:12,marginTop:4}}>Supports .csv files</div>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{display:"none"}}
          onChange={handleFile} />
      </div>

      {/* Preview */}
      {preview && rows.length > 0 && (
        <div style={{marginBottom:16}}>
          <div style={{color:"#f59e0b",fontFamily:mono,fontSize:12,marginBottom:10}}>
            {rows.length} ROW{rows.length!==1?"S":""} READY TO IMPORT
          </div>
          <div style={{maxHeight:200,overflowY:"auto",border:"1px solid #1a2332",borderRadius:8}}>
            {rows.slice(0,8).map((r,i)=>(
              <div key={i} style={{padding:"8px 14px",borderBottom:"1px solid #111827",
                fontSize:13,color:"#8b949e",display:"flex",gap:16}}>
                <span style={{color:"#e6edf3",minWidth:120}}>{r.Name||r.name}</span>
                <span style={{fontFamily:mono,fontSize:11}}>{r.Phone||r.phone||r.phone_number}</span>
                <span>{TRADE_ICONS[r.Trade||r.trade]||"🔧"} {r.Trade||r.trade}</span>
                <span>{r.City||r.city}</span>
              </div>
            ))}
            {rows.length>8 && (
              <div style={{padding:"8px 14px",color:"#4a5568",fontSize:12}}>
                …and {rows.length-8} more rows
              </div>
            )}
          </div>
          <button onClick={runImport} disabled={importing} style={{
            ...btn("#10b981","md"), marginTop:12, opacity:importing?.6:1,
          }}>
            {importing ? "Importing…" : `Import ${rows.length} Technicians`}
          </button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div style={{display:"flex",gap:16,marginBottom:14}}>
            <div style={{background:"rgba(16,185,129,.1)",border:"1px solid #34d39940",
              borderRadius:8,padding:"10px 18px",color:"#34d399",fontSize:14}}>
              ✅ {added} added
            </div>
            {duplicates.length > 0 && (
              <div style={{background:"rgba(245,158,11,.1)",border:"1px solid #f59e0b40",
                borderRadius:8,padding:"10px 18px",color:"#f59e0b",fontSize:14}}>
                ⚠️ {duplicates.length} duplicate{duplicates.length!==1?"s":""}
              </div>
            )}
            {errors > 0 && (
              <div style={{background:"rgba(239,68,68,.1)",border:"1px solid #f8717140",
                borderRadius:8,padding:"10px 18px",color:"#f87171",fontSize:14}}>
                ❌ {errors} error{errors!==1?"s":""}
              </div>
            )}
          </div>

          {/* Duplicate resolution */}
          {duplicates.length > 0 && !dupAction && (
            <div style={{background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.2)",
              borderRadius:8,padding:"16px 20px",marginBottom:14}}>
              <div style={{color:"#f59e0b",fontSize:14,fontWeight:600,marginBottom:8}}>
                These numbers already exist — what should we do?
              </div>
              {duplicates.map(d=>(
                <div key={d.phone} style={{color:"#8b949e",fontSize:13,marginBottom:4}}>
                  {d.name} ({d.phone})
                </div>
              ))}
              <div style={{display:"flex",gap:10,marginTop:14}}>
                <button onClick={()=>{setDupAction("skip");onImported();}}
                  style={btn("#64748b","sm")}>Skip duplicates</button>
                <button onClick={async()=>{
                  setDupAction("overwrite");
                  for(const d of duplicates) {
                    const found = rows.find(r=>{
                      const p=(r.Phone||r.phone||"").trim();
                      return p===d.phone||p.replace(/^0/,"92")===d.phone;
                    });
                    if(found) await fetch("/api/admin/techs",{
                      method:"POST",headers:{"Content-Type":"application/json"},
                      body:JSON.stringify({...found,phone_number:d.phone}),
                    });
                  }
                  onImported();
                }} style={btn("#f59e0b","sm")}>Overwrite all</button>
              </div>
            </div>
          )}

          {/* Error details */}
          {errors > 0 && (
            <div style={{maxHeight:160,overflowY:"auto"}}>
              {results.filter(r=>r.status==="error").map((r,i)=>(
                <div key={i} style={{padding:"6px 12px",background:"rgba(239,68,68,.06)",
                  borderRadius:6,fontSize:12,color:"#f87171",marginBottom:4}}>
                  {r.name} ({r.phone}) — {r.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TechniciansPage() {
  const [techs, setTechs]     = useState<Tech[]>([]);
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState<string|null>(null);
  const [tab, setTab]         = useState<"list"|"add"|"import">("list");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/techs?filter=${filter}`);
    setTechs(await res.json());
    setLoading(false);
  }, [filter]);

  useEffect(()=>{ load(); }, [load]);

  async function act(phone:string, action:string) {
    setActing(phone+action);
    await fetch("/api/admin/techs",{method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({phone_number:phone,action})});
    await load(); setActing(null);
  }

  const filtered = techs.filter(t =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.phone_number.includes(search) ||
    t.trade.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{padding:"32px 36px",maxWidth:1200}}>
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        select option{background:#0d1117;color:#e6edf3}
      `}</style>

      {/* Header */}
      <div style={{marginBottom:28}}>
        <div style={{color:"#4a5568",fontSize:11,fontFamily:mono,letterSpacing:2,marginBottom:6}}>
          SNAPFIX / TECHNICIANS
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <h1 style={{color:"#e6edf3",fontSize:28,fontFamily:syne,fontWeight:800}}>
            Technician Registry
          </h1>
          <div style={{color:"#4a5568",fontSize:12,fontFamily:mono}}>
            {techs.length} total
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:24,background:"#0d1117",
        borderRadius:10,padding:4,border:"1px solid #1a2332",width:"fit-content"}}>
        {([
          {key:"list",  label:"Registry",    icon:"◈"},
          {key:"add",   label:"Add manually", icon:"+"},
          {key:"import",label:"Excel import",  icon:"⬆"},
        ] as const).map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{
            padding:"8px 18px",borderRadius:8,border:"none",
            background:tab===t.key?"#1a2332":"transparent",
            color:tab===t.key?"#e6edf3":"#4a5568",
            fontSize:13,fontWeight:tab===t.key?600:400,cursor:"pointer",
            display:"flex",alignItems:"center",gap:6,transition:"all .15s",
          }}>
            <span style={{color:tab===t.key?"#f59e0b":"#4a5568"}}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Registry ── */}
      {tab==="list" && (<>
        <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <input placeholder="Search name, phone, trade…"
            value={search} onChange={e=>setSearch(e.target.value)}
            style={{flex:1,minWidth:200,...inp}}
          />
          {["all","pending","active"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{
              padding:"10px 18px",borderRadius:8,border:"1px solid",
              borderColor:filter===f?"#f59e0b":"#1a2332",
              background:filter===f?"rgba(245,158,11,.12)":"transparent",
              color:filter===f?"#f59e0b":"#64748b",
              fontSize:13,cursor:"pointer",fontFamily:mono,textTransform:"capitalize",
            }}>{f}</button>
          ))}
        </div>

        <div style={{background:"#0d1117",border:"1px solid #1a2332",borderRadius:12,overflow:"hidden"}}>
          {/* Column headers */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 110px 130px 110px 60px 60px 200px",
            padding:"12px 24px",borderBottom:"1px solid #1a2332"}}>
            {["Technician","Trade","Location","Status","Exp","Jobs","Actions"].map((h,i)=>(
              <div key={i} style={{color:"#4a5568",fontSize:11,fontFamily:mono,letterSpacing:.5}}>{h}</div>
            ))}
          </div>

          {loading && (
            <div style={{padding:"40px",textAlign:"center",color:"#4a5568",fontSize:14,
              fontFamily:mono,animation:"pulse 1.5s infinite"}}>Loading…</div>
          )}
          {!loading && filtered.length===0 && (
            <div style={{padding:"48px",textAlign:"center",color:"#4a5568",fontSize:14}}>
              No technicians found
            </div>
          )}

          {filtered.map((tech,i)=>(
            <div key={tech.phone_number} style={{
              display:"grid",gridTemplateColumns:"1fr 110px 130px 110px 60px 60px 200px",
              padding:"14px 24px",borderBottom:i<filtered.length-1?"1px solid #111827":"none",
              alignItems:"center",
            }}>
              <div>
                <div style={{color:"#e6edf3",fontSize:14,fontWeight:500}}>{tech.name}</div>
                <div style={{color:"#4a5568",fontSize:11,fontFamily:mono,marginTop:2}}>
                  {tech.phone_number}
                  {tech.registration_source==="portal" && (
                    <span style={{marginLeft:6,color:"#a78bfa",fontSize:10}}>portal</span>
                  )}
                </div>
              </div>
              <div style={{color:"#8b949e",fontSize:13}}>
                {TRADE_ICONS[tech.trade]??""} {tech.trade}
              </div>
              <div style={{color:"#8b949e",fontSize:13}}>
                {[tech.city,tech.area].filter(Boolean).join(", ")||"—"}
              </div>
              <div><ApprovalBadge status={tech.approval_status} /></div>
              <div style={{color:"#8b949e",fontSize:13,fontFamily:mono}}>{tech.experience_years}y</div>
              <div style={{color:"#f59e0b",fontFamily:mono,fontSize:13}}>{tech.total_jobs_done}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {tech.approval_status==="pending" && (<>
                  <button onClick={()=>act(tech.phone_number,"approve")} disabled={!!acting}
                    style={btn("#10b981","sm")}>
                    {acting===tech.phone_number+"approve"?"…":"Approve"}
                  </button>
                  <button onClick={()=>act(tech.phone_number,"reject")} disabled={!!acting}
                    style={btn("#ef4444","sm")}>
                    {acting===tech.phone_number+"reject"?"…":"Reject"}
                  </button>
                </>)}
                {tech.approval_status==="approved" && (
                  <button
                    onClick={()=>act(tech.phone_number,tech.is_active?"deactivate":"activate")}
                    disabled={!!acting}
                    style={btn(tech.is_active?"#64748b":"#60a5fa","sm")}>
                    {tech.is_active?"Deactivate":"Activate"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </>)}

      {/* ── Tab: Add manually ── */}
      {tab==="add" && (
        <div>
          <div style={{color:"#4a5568",fontSize:13,marginBottom:16}}>
            Technicians added here are immediately active and approved.
            Their default password is the last 6 digits of their phone number.
          </div>
          <AddTechForm onAdded={()=>{ load(); setTab("list"); }} />
        </div>
      )}

      {/* ── Tab: Excel import ── */}
      {tab==="import" && (
        <div>
          <div style={{color:"#4a5568",fontSize:13,marginBottom:16}}>
            Download the CSV template, fill in your technicians, then upload. All rows are validated before import.
          </div>
          <ExcelImport onImported={()=>{ load(); }} />
        </div>
      )}
    </div>
  );
}
