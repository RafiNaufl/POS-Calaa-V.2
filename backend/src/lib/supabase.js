const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
// We use the Service Role Key for backend administrative tasks (bypass RLS)
// OR the Anon Key if we just want to act as a public client.

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  // Warn but don't crash immediately, as it might be a build step
  console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_KEY/SERVICE_ROLE_KEY env vars')
}

// Standard client (uses the key provided, usually service role in backend env)
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder', {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Admin client (explicitly uses service role key if available)
const supabaseAdmin = supabaseAdminKey 
  ? createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAdminKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

module.exports = { supabase, supabaseAdmin }
