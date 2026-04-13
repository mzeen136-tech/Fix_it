import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export interface Technician {
  phone_number: string;
  name: string;
  trade: string;
  service_area: string;
  city: string | null;
  area: string | null;
  is_active: boolean;
  approval_status: "pending" | "approved" | "rejected";
  registration_source: "admin" | "portal";
  experience_years: number;
  total_jobs_done: number;
  profile_photo_url: string | null;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bid {
  tech_phone: string;
  tech_name: string;
  price: string;
  eta: string;
  received_at: string;
}

export interface ActiveJob {
  job_id: string;
  customer_phone: string;
  customer_city: string | null;
  customer_area: string | null;
  trade_required: string;
  problem_summary: string;
  status: "bidding" | "assigned" | "completed";
  bids: Bid[];
  assigned_tech_phone: string | null;
  customer_rating: number | null;
  created_at: string;
  updated_at: string;
}

export const CITIES = [
  "Islamabad","Rawalpindi","Lahore","Karachi","Peshawar",
  "Quetta","Multan","Faisalabad","Sialkot","Gujranwala",
  "Hyderabad","Abbottabad","Murree","Other"
] as const;

export const TRADES = [
  "Plumber","Electrician","HVAC","Carpenter","Painter","Other"
] as const;
