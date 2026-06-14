import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qgmffsrgfyphmuqvafdc.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbWZmc3JnZnlwaG11cXZhZmRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NTgyMTUsImV4cCI6MjA5NzAzNDIxNX0.7Mfw9o4cCE7TVxLfMKIhRBXud_ZbqxBjbLC0er6cX_4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
