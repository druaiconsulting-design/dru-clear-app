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
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>LEAD, CLARITY, WIN! Newsletter | DRU AI Consulting</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Montserrat:wght@600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; background:#FAFAF8; color:#0A2342; font-family:'Inter', sans-serif; }
  .bar { background:rgba(27,77,142,0.97); border-bottom:1px solid rgba(212,175,55,0.22); height:84px; display:flex; align-items:center; justify-content:center; }
  .brand { font-family:'Playfair Display', serif; font-size:1.5rem; font-weight:700; color:#D4AF37; letter-spacing:0.02em; }
  .card { max-width:460px; margin:0 auto; padding:44px 24px 56px; text-align:center; }
  h1 { font-family:'Playfair Display', serif; color:#D4AF37; font-size:1.9rem; line-height:1.25; font-weight:700; margin:0 0 12px; }
  .divider { width:48px; height:2px; background:#D4AF37; margin:0 auto 28px; }
  .names { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  form { display:flex; flex-direction:column; gap:14px; text-align:left; }
  input { width:100%; padding:14px 16px; font-size:16px; font-family:'Inter', sans-serif; border-radius:6px; border:1px solid rgba(10,35,66,0.18); background:#ffffff; color:#0A2342; outline:none; }
  input:focus { border-color:#D4AF37; }
  button { margin-top:4px; padding:15px 28px; font-family:'Montserrat', sans-serif; font-weight:700; font-size:0.85rem; letter-spacing:0.08em; text-transform:uppercase; background:#C2185B; color:#ffffff; border:0; border-radius:6px; cursor:pointer; }
  button[disabled] { opacity:0.7; cursor:default; }
  .req { font-family:'Montserrat', sans-serif; font-size:0.75rem; color:rgba(10,35,66,0.65); text-align:center; }
  #msg { font-family:'Montserrat', sans-serif; font-size:0.75rem; color:rgba(10,35,66,0.65); text-align:center; min-height:18px; }
  #done { display:none; font-size:1.1rem; line-height:1.6; color:#0A2342; }
  .done-title { font-family:'Playfair Display', serif; font-size:1.6rem; font-weight:700; color:#D4AF37; margin-bottom:8px; }
</style></head>
<body>
<div class="bar"><span class="brand">DRU AI Consulting</span></div>
<div class="card">
<h1>LEAD, CLARITY, WIN! Newsletter</h1>
<div class="divider"></div>
<form id="f">
  <div class="names">
    <input id="n" name="first_name" type="text" placeholder="First Name *" autocomplete="given-name" required>
    <input id="l" name="last_name" type="text" placeholder="Last Name *" autocomplete="family-name" required>
  </div>
  <input id="e" name="email" type="email" placeholder="Email Address *" autocomplete="email" required>
  <input id="p" name="phone" type="tel" placeholder="Phone Number *" autocomplete="tel" style="display:none">
  <button id="b" type="submit">Subscribe Now!</button>
  <div class="req">* Required</div>
  <div id="msg" role="status"></div>
</form>
<div id="done"><div class="done-title">You Are Subscribed!</div><div>Thank you, Enjoy!</div></div>
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
      body: JSON.stringify({ email: form.email.value.trim(), first_name: form.first_name.value.trim(), last_name: form.last_name.value.trim(), phone: form.phone.value.trim(), source: SOURCE })
    }).then(function (r) {
      if (!r.ok) throw new Error('bad');
      return r.json();
    }).then(function (data) {
      if (data && data.needPhone) {
        var ph = document.getElementById('p');
        ph.style.display = 'block'; ph.required = true; ph.focus();
        msg.textContent = form.phone.value.trim() ? 'Enter a valid phone number.' : '';
        btn.disabled = false;
        return;
      }
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
