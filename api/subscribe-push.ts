// api/subscribe-push.ts
// GET  → returns VAPID public key for client subscription setup
// POST → saves member push subscription to Supabase

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers });

  // GET — return public VAPID key to client
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ publicKey: process.env.VAPID_PUBLIC_KEY }),
      { headers }
    );
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const { subscription } = await req.json();
    if (!subscription) {
      return new Response(JSON.stringify({ error: 'No subscription provided' }), { status: 400, headers });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          subscription,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { headers });
  } catch (err) {
    console.error('[subscribe-push]', err);
    return new Response(JSON.stringify({ error: 'Failed to save subscription' }), { status: 500, headers });
  }
}
