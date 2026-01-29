import { createClient } from '@supabase/supabase-js';

// Environment variable handling for different build tools (Vite, CRA, Next.js)
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

if (supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn('Supabase URL or Key is missing. Authentication will not work. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);