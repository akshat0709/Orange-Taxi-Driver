import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("⚠️ Warning: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing. Connect your project to Supabase.");
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headerObj: Record<string, string> = {};

    if (init?.headers) {
      if (typeof (init.headers as any).forEach === 'function') {
        (init.headers as any).forEach((value: string, key: string) => {
          headerObj[key] = String(value);
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            headerObj[key] = String(value);
          }
        });
      } else if (typeof init.headers === 'object') {
        Object.entries(init.headers).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            headerObj[key] = String(value);
          }
        });
      }
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey)) {
      const authHeader = headerObj['Authorization'] || headerObj['authorization'];
      if (authHeader === `Bearer ${supabaseKey}`) {
        delete headerObj['Authorization'];
        delete headerObj['authorization'];
      }
    }

    headerObj['apikey'] = supabaseKey;
    return fetch(input, { ...init, headers: headerObj });
  };
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: createSupabaseFetch(SUPABASE_ANON_KEY),
  },
});
