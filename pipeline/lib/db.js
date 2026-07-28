import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

export function env() {
  const out = { ...process.env };
  for (const file of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
        if (m && !out[m[1]]) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    } catch {}
  }
  return out;
}

// supabase-js builds a realtime client on createClient even for REST-only use,
// and that needs WebSocket. Node 22 has it natively; Node 20 does not.
async function realtimeOptions() {
  if (typeof WebSocket !== 'undefined') return undefined;
  try {
    const { default: ws } = await import('ws');
    return { transport: ws };
  } catch {
    throw new Error(
      'Node 20 has no native WebSocket. Either upgrade to Node 22, which is the '
        + 'supported LTS since Node 20 went end of life in April 2026, or run: npm install ws',
    );
  }
}

export async function connect() {
  const E = env();
  const url = E.VITE_SUPABASE_URL;
  const secret = E.SUPABASE_SECRET_KEY || E.SUPABASE_SERVICE_KEY;

  if (!url || !secret) {
    console.error('Need VITE_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local');
    console.error('Both are under Project Settings > API keys. Never expose the secret to the browser.');
    process.exit(1);
  }

  // Secret key bypasses RLS, which a script with no user session needs.
  const db = createClient(url, secret, {
    auth: { persistSession: false },
    realtime: await realtimeOptions(),
  });

  return { db, E };
}
