// DRU AI Leadership Ecosystem™ — api/social-reply-publisher.ts
// Fires approved social response cards back to Make.com for posting
// Called by AdminApprovals.tsx when DeAnna approves a social_response card
// Make.com receives the payload and posts the reply to the original comment/DM/mention

export const config = { maxDuration: 30 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const webhookUrl = process.env.MAKE_SOCIAL_REPLY_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[social-reply-publisher] MAKE_SOCIAL_REPLY_WEBHOOK_URL not set');
    res.status(500).json({ error: 'Reply webhook not configured' });
    return;
  }

  const {
    approval_id,
    platform,
    interaction_type,
    interaction_id,
    post_id,
    reply_text,
    author_handle,
  } = req.body || {};

  if (!reply_text || !platform || !interaction_type) {
    res.status(400).json({ error: 'Missing required fields: reply_text, platform, interaction_type' });
    return;
  }

  console.log(`[social-reply-publisher] Firing ${platform} ${interaction_type} reply → Make.com`);

  try {
    const makeRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approval_id:      approval_id ?? null,
        platform,
        interaction_type,
        interaction_id:   interaction_id ?? null,
        post_id:          post_id ?? null,
        reply_text,
        author_handle:    author_handle ?? null,
      }),
    });

    if (!makeRes.ok) {
      console.error(`[social-reply-publisher] Make.com webhook failed: ${makeRes.status}`);
      res.status(502).json({ error: 'Make.com webhook failed' });
      return;
    }

    console.log(`[social-reply-publisher] Reply sent successfully for approval ${approval_id}`);
    res.status(200).json({ success: true, approval_id });

  } catch (error) {
    console.error('[social-reply-publisher] Error:', error);
    res.status(500).json({ error: 'Reply publish failed' });
  }
}
