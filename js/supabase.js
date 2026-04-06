import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"

// ⭐ 這兩個改成你的
const SUPABASE_URL = "https://ccuyfocwoiahtsmtikhn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjdXlmb2N3b2lhaHRzbXRpa2huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNzg4MzgsImV4cCI6MjA4OTY1NDgzOH0.RY4kMYJmym6oqbAUP1I21P8It_nmYCRaJ_qpjy-6pg4"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)