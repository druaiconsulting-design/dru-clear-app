// api/newsletter-subscribe.ts
// The subscribe form that opens from a link in a social media post (Nov 26, 2026), at
// app.druaiconsulting.com/subscribe?from=<platform>.
//
// A plain page with only the form: first name, email and a Subscribe button, then a thank-you.
// The page posts to the same signup the website form uses (api/jaylen-nonmember-signup.ts), which
// starts a non-member on the welcome emails, or turns the newsletter on for someone who already has
// a member profile. The platform name in the link (instagram, facebook, linkedin, ...) goes along
// and becomes a "from-<platform>" tag on the person's GHL record.

import type { VercelRequest, VercelResponse } from '@vercel/node';

function cleanSource(raw: unknown): string {
  const v = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '');
  return v.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const source = cleanSource(req.query?.from);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>LEAD, CLARITY, WIN!</title>
<style>
  body { margin:0; padding:40px 20px; font-family: Georgia, serif; color:#0A2342; background:#ffffff; }
  .card { max-width:420px; margin:0 auto; }
  h1 { font-size:26px; line-height:1.3; text-align:center; margin:0 0 24px; }
  label { display:block; font-size:15px; margin:0 0 6px; }
  input { width:100%; box-sizing:border-box; padding:12px; font-size:16px; font-family:inherit; border:1px solid #b8c0cc; border-radius:6px; margin-bottom:18px; color:#0A2342; }
  button { width:100%; padding:14px; font-size:17px; font-family:inherit; background:#0A2342; color:#ffffff; border:0; border-radius:6px; cursor:pointer; }
  button[disabled] { opacity:0.6; cursor:default; }
  #msg { font-size:15px; line-height:1.5; text-align:center; margin-top:16px; min-height:20px; }
  #done { display:none; text-align:center; font-size:18px; line-height:1.6; }
</style></head>
<body><div class="card">
<h1>LEAD, CLARITY, WIN!</h1>
<form id="f">
  <label for="n">First name</label>
  <input id="n" name="first_name" type="text" autocomplete="given-name" required>
  <label for="e">Email</label>
  <input id="e" name="email" type="email" autocomplete="email" required>
  <button id="b" type="submit">Subscribe</button>
  <div id="msg" role="status"></div>
</form>
<div id="done">You are subscribed. Thank you.</div>
</div>
<script>
  var SOURCE = ${JSON.stringify(source)};
  var form = document.getElementById('f'), btn = document.getElementById('b'), msg = document.getElementById('msg');
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    btn.disabled = true; msg.textContent = '';
    fetch('/api/jaylen-nonmember-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email.value.trim(), first_name: form.first_name.value.trim(), source: SOURCE })
    }).then(function (r) {
      if (!r.ok) throw new Error('bad');
      form.style.display = 'none';
      document.getElementById('done').style.display = 'block';
    }).catch(function () {
      btn.disabled = false;
      msg.textContent = 'Something went wrong. Please try again.';
    });
  });
</script></body></html>`;
  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').setHeader('Cache-Control', 'no-store').send(html);
}
