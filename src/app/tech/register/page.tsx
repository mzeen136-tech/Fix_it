"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CITIES = ["Islamabad","Rawalpindi","Lahore","Karachi","Peshawar",
  "Quetta","Multan","Faisalabad","Sialkot","Gujranwala","Hyderabad","Abbottabad","Other"];
const TRADES = ["Plumber","Electrician","HVAC","Carpenter","Painter","Other"];
const TRADE_URDU: Record<string,string> = {
  Plumber:"پلمبر", Electrician:"الیکٹریشن", HVAC:"اے سی مکینک",
  Carpenter:"بڑھئی", Painter:"پینٹر", Other:"دیگر"
};

export default function TechRegister() {
  const router = useRouter();
  const [step, setStep]     = useState<"form"|"success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [form, setForm] = useState({
    name:"", phone_number:"", trade:"", city:"", area:"",
    experience_years:"0", password:"", confirm_password:"",
  });

  function field(key: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match | پاس ورڈ مماثل نہیں ہیں"); return;
    }
    setLoading(true);
    const res = await fetch("/api/tech/register", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) { setStep("success"); }
    else { setError(data.error); }
    setLoading(false);
  }

  if (step === "success") return (
    <div style={{ minHeight:"100vh", background:"#f0fdf4", display:"flex",
      alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#fff", borderRadius:20, padding:"48px 40px",
        maxWidth:440, width:"100%", textAlign:"center", boxShadow:"0 4px 40px rgba(0,0,0,0.08)" }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:"#dcfce7",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:36, margin:"0 auto 20px" }}>✓</div>
        <h2 style={{ fontSize:24, fontWeight:700, color:"#14532d", marginBottom:8,
          fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Registration Submitted!</h2>
        <p style={{ color:"#166534", fontSize:15, marginBottom:8 }}>
          Your application is under review. You will be notified via WhatsApp once approved.
        </p>
        <p style={{ color:"#4ade80", fontSize:16, direction:"rtl",
          fontFamily:"'Noto Nastaliq Urdu',serif", marginBottom:24, lineHeight:2 }}>
          آپ کی درخواست جمع ہو گئی۔ منظوری کے بعد واٹس ایپ پر اطلاع ملے گی۔
        </p>
        <button onClick={() => router.push("/tech/login")} style={{
          background:"#059669", color:"#fff", border:"none", borderRadius:10,
          padding:"14px 32px", fontSize:15, fontWeight:600, cursor:"pointer",
          fontFamily:"'Plus Jakarta Sans',sans-serif",
        }}>Sign In / لاگ ان</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;600&display=swap');*{box-sizing:border-box}`}</style>

      {/* Top nav */}
      <nav style={{ background:"#fff", borderBottom:"1px solid #e5e7eb", padding:"16px 24px",
        display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:"#059669",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🔧</div>
        <span style={{ fontWeight:700, fontSize:18, color:"#111827" }}>SnapFix</span>
        <span style={{ marginLeft:"auto", color:"#6b7280", fontSize:14 }}>
          Already registered?{" "}
          <a href="/tech/login" style={{ color:"#059669", fontWeight:600, textDecoration:"none" }}>Sign in</a>
        </span>
      </nav>

      <div style={{ maxWidth:520, margin:"40px auto", padding:"0 16px" }}>
        {/* Hero text */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <h1 style={{ fontSize:28, fontWeight:700, color:"#111827", marginBottom:8 }}>
            Join as a Technician
          </h1>
          <p style={{ color:"#6b7280", fontSize:15 }}>
            Start receiving job alerts on WhatsApp
          </p>
          <p style={{ color:"#059669", fontSize:16, fontFamily:"'Noto Nastaliq Urdu',serif",
            direction:"rtl", marginTop:6, lineHeight:2 }}>
            واٹس ایپ پر نئے کام کی اطلاع پائیں
          </p>
        </div>

        <form onSubmit={submit} style={{ background:"#fff", borderRadius:16, padding:"32px",
          boxShadow:"0 2px 20px rgba(0,0,0,0.06)", border:"1px solid #e5e7eb" }}>

          {/* Name */}
          <Label en="Full Name" ur="پورا نام" required />
          <Input value={form.name} onChange={v => field("name",v)} placeholder="Ali Ahmed" required />

          {/* Phone */}
          <Label en="WhatsApp Number" ur="واٹس ایپ نمبر" required />
          <Input value={form.phone_number} onChange={v => field("phone_number",v)}
            placeholder="923001234567" required type="tel" />
          <Hint en="Format: 923001234567 (no + or spaces)" ur="مثال: 923001234567" />

          {/* Trade */}
          <Label en="Your Trade" ur="آپ کا پیشہ" required />
          <select required value={form.trade} onChange={e => field("trade",e.target.value)}
            style={selectStyle}>
            <option value="">Select trade / پیشہ منتخب کریں</option>
            {TRADES.map(t => (
              <option key={t} value={t}>{t} / {TRADE_URDU[t]}</option>
            ))}
          </select>

          {/* City */}
          <Label en="City" ur="شہر" required />
          <select required value={form.city} onChange={e => field("city",e.target.value)}
            style={selectStyle}>
            <option value="">Select city / شہر منتخب کریں</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Area */}
          <Label en="Area / Neighbourhood" ur="علاقہ" />
          <Input value={form.area} onChange={v => field("area",v)}
            placeholder="e.g. DHA, F-7, Gulberg" />

          {/* Experience */}
          <Label en="Years of Experience" ur="تجربے کے سال" />
          <select value={form.experience_years} onChange={e => field("experience_years",e.target.value)}
            style={selectStyle}>
            {Array.from({length:21},(_,i)=>i).map(y => (
              <option key={y} value={y}>{y === 0 ? "Less than 1 year" : `${y} year${y>1?"s":""}`}</option>
            ))}
          </select>

          {/* Password */}
          <Label en="Password" ur="پاس ورڈ" required />
          <Input value={form.password} onChange={v => field("password",v)}
            placeholder="Min 6 characters" required type="password" />

          <Label en="Confirm Password" ur="پاس ورڈ دوبارہ" required />
          <Input value={form.confirm_password} onChange={v => field("confirm_password",v)}
            placeholder="Repeat password" required type="password" />

          {error && (
            <div style={{ background:"#fef2f2", border:"1px solid #fecaca",
              borderRadius:8, padding:"10px 14px", color:"#991b1b",
              fontSize:14, marginBottom:16 }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width:"100%", padding:"14px", borderRadius:10, border:"none",
            background: loading ? "#d1fae5" : "#059669",
            color:"#fff", fontSize:16, fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
            transition:"background 0.2s", fontFamily:"'Plus Jakarta Sans',sans-serif",
          }}>
            {loading ? "Submitting… / جمع ہو رہا ہے…" : "Register / رجسٹر کریں"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Label({ en, ur, required }: { en: string; ur: string; required?: boolean }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      marginBottom:6, marginTop:18 }}>
      <span style={{ fontSize:14, fontWeight:600, color:"#374151" }}>
        {en}{required && <span style={{ color:"#ef4444" }}>*</span>}
      </span>
      <span style={{ fontSize:14, color:"#6b7280", fontFamily:"'Noto Nastaliq Urdu',serif",
        direction:"rtl" }}>{ur}</span>
    </div>
  );
}

function Input({ value, onChange, placeholder, required, type="text" }:{
  value:string; onChange:(v:string)=>void; placeholder?:string; required?:boolean; type?:string;
}) {
  return (
    <input type={type} value={value} required={required} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ width:"100%", padding:"11px 14px", borderRadius:8,
        border:"1px solid #d1d5db", fontSize:15, outline:"none",
        transition:"border 0.15s", background:"#fafafa", color:"#111827" }}
      onFocus={e => e.target.style.borderColor="#059669"}
      onBlur={e => e.target.style.borderColor="#d1d5db"}
    />
  );
}

function Hint({ en, ur }: { en: string; ur: string }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, marginBottom:2 }}>
      <span style={{ fontSize:12, color:"#9ca3af" }}>{en}</span>
      <span style={{ fontSize:12, color:"#9ca3af", fontFamily:"'Noto Nastaliq Urdu',serif", direction:"rtl" }}>{ur}</span>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width:"100%", padding:"11px 14px", borderRadius:8,
  border:"1px solid #d1d5db", fontSize:15, outline:"none",
  background:"#fafafa", color:"#111827", cursor:"pointer",
};
