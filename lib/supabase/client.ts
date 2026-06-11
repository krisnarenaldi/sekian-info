/**
 * Supabase client helpers
 *
 * - `createServerClient` — menggunakan SUPABASE_SERVICE_ROLE_KEY untuk operasi
 *   backend (cron, pipeline, server-side queries). JANGAN diekspos ke browser.
 *
 * - `createBrowserClient` — menggunakan NEXT_PUBLIC_SUPABASE_ANON_KEY untuk
 *   operasi client-side yang aman diekspos ke browser.
 *
 * Requirements: 12.1, 13.4
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ─── Server Client (Service Role) ────────────────────────────────────────────

/**
 * Membuat Supabase client dengan service role key.
 * Gunakan di API routes, cron handlers, dan server components.
 * Klien ini melewati Row Level Security (RLS) — jangan diekspos ke browser.
 */
export function createServerClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!serviceRoleKey) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Service role key tidak memerlukan session persistence
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// ─── Browser Client (Anon Key) ────────────────────────────────────────────────

/**
 * Membuat Supabase client dengan anon key.
 * Aman digunakan di client components dan browser.
 * Tunduk pada Row Level Security (RLS) Supabase.
 */
export function createBrowserClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!anonKey) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createClient(supabaseUrl, anonKey)
}
