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
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Newsletter | DRU AI Consulting</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Montserrat:wght@600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  body { margin:0; min-height:100vh; background:#0A2342; color:#FFFFFF; font-family:'Inter', sans-serif; display:flex; align-items:center; justify-content:center; padding:32px 20px; box-sizing:border-box; }
  .card { width:100%; max-width:420px; text-align:center; }
  .logo { height:140px; width:auto; display:block; margin:0 auto 20px; }
  h1 { font-family:'Playfair Display', serif; color:#D4AF37; font-size:28px; line-height:1.3; font-weight:700; margin:0 0 24px; }
  label { display:block; text-align:left; font-size:13px; color:#E6E6E6; margin:0 0 6px; }
  input { width:100%; box-sizing:border-box; padding:12px 14px; font-size:16px; font-family:'Inter', sans-serif; background:rgba(255,255,255,0.07); border:1px solid rgba(212,175,55,0.3); border-radius:6px; margin-bottom:18px; color:#FFFFFF; outline:none; }
  input:focus { border-color:#D4AF37; }
  button { width:100%; padding:14px; font-family:'Montserrat', sans-serif; font-weight:700; font-size:14px; letter-spacing:0.06em; text-transform:uppercase; background:#D4AF37; color:#0A2342; border:0; border-radius:6px; cursor:pointer; }
  button[disabled] { opacity:0.7; cursor:default; }
  #msg { font-size:14px; line-height:1.5; color:#E8C84A; margin-top:16px; min-height:20px; }
  #done { display:none; font-size:18px; line-height:1.6; color:#E6E6E6; }
</style></head>
<body><div class="card">
<img class="logo" src="/new-dru-clear-transparent-logo.png" alt="DRU AI Consulting">
<h1>Subscribe to the newsletter</h1>
<form id="f">
  <label for="n">First name</label>
  <input id="n" name="first_name" type="text" autocomplete="given-name" required>
  <label for="e">Email</label>
  <input id="e" name="email" type="email" autocomplete="email" required>
  <button id="b" type="submit">Subscribe</button>
  <div id="msg" role="status"></div>
</form>
<div id="done">You are subscribed to the newsletter. Thank you.</div>
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
