import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null kada server nije podešen – aplikacija tada radi lokalno na uređaju. */
// PKCE: povratni linkovi (potvrda emaila, nova lozinka) koriste ?code=, pa ne smetaju HashRouter-u
export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null;
export const cloudEnabled = supabase !== null;
