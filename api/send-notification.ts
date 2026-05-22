// api/send-notification.ts
// Node.js runtime — uses web-push package
// Called internally when a member is mentioned, replied to,
// or when new posts are published in Community Connection
//
// Payload:
// { recipient_id, sender_id, post_id, comment_id,
//   type: 'mention'|'reply'|'new_post'|'new_agent_post',
//   message, post_title, sender_name }

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const GHL_NOTIFICATION_WEBHOOK =
  'https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/2f84f9a5-7c9a-4964-9e63-9226f4d4ac20';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      recipient_id,
      sender_id,
      post_id,
      comment_id,
      type,
      message,
      post_title,
      sender_name,
    } = req.body;

    if (!recipient_id || !type || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Create in-app notification record
    const { error: notifError } = await supabase
      .from('community_notifications')
      .insert({
        recipient_id,
        sender_id: sender_id ?? null,
        post_id: post_id ?? null,
        comment_id: comment_id ?? null,
        type,
        message,
      });

    if (notifError) {
      console.error('[send-notification] insert error:', notifError);
    }

    // 2. Fetch preferences, profile, and push subscription in parallel
    const [prefsResult, profileResult, subResult] = await Promise.all([
      supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', recipient_id)
        .single(),
      supabase
        .from('profiles')
        .select('email, first_name')
        .eq('id', recipient_id)
        .single(),
      supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', recipient_id)
        .single(),
    ]);

    const prefs = prefsResult.data;
    const profile = profileResult.data;

    if (!prefs) return res.status(200).json({ success: true, note: 'No preferences found' });

    // 3. Resolve preference keys based on notification type
    type NotifType = 'mention' | 'reply' | 'new_post' | 'new_agent_post';
    const safeType = type as NotifType;
    const pushEnabled  = prefs[`${safeType}_push`]  as boolean;
    const emailEnabled = prefs[`${safeType}_email`] as boolean;

    const tasks: Promise<any>[] = [];

    // 4. Web push notification
    if (pushEnabled && subResult.data?.subscription) {
      tasks.push(
        webpush
          .sendNotification(
            subResult.data.subscription,
            JSON.stringify({
              title: 'Community Connection',
              body: message,
              url: 'https://app.druaiconsulting.com/community',
            })
          )
          .catch(err => {
            console.error('[send-notification] push error:', err);
            // If subscription expired (410), remove it
            if (err.statusCode === 410) {
              supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', recipient_id)
                .then(() => console.log('[send-notification] removed expired subscription'));
            }
          })
      );
    }

    // 5. GHL email notification
    if (emailEnabled && profile?.email) {
      tasks.push(
        fetch(GHL_NOTIFICATION_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: profile.email,
            first_name: profile.first_name ?? 'Member',
            notification_type: type,
            message,
            post_title: post_title ?? '',
            post_link: 'https://app.druaiconsulting.com/community',
            sender_name: sender_name ?? 'A community member',
          }),
        }).catch(err => console.error('[send-notification] GHL error:', err))
      );
    }

    await Promise.all(tasks);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[send-notification] error:', err);
    return res.status(500).json({ error: 'Notification failed' });
  }
}
