/**
 * DRU CLEAR™ Form Validator v3
 * Runtime validation that works independently of the React bundle.
 * Checks: name length (≥2 chars), email format, disposable domains,
 *         DNS MX records (via Cloudflare DoH), typo correction.
 */
(function () {
  'use strict';

  // ── Disposable / fake domain blocklist ──────────────────────────────────────
  var DISPOSABLE = new Set([
    // Well-known disposable services
    'mailinator.com','guerrillamail.com','guerrillamail.net','guerrillamail.org',
    'guerrillamail.biz','guerrillamail.de','guerrillamail.info','grr.la',
    'tempmail.com','temp-mail.org','temp-mail.io','throwam.com','throwam.net',
    'fakeinbox.com','fakeinbox.net','mailnull.com','spamgourmet.com',
    'trashmail.com','trashmail.me','trashmail.net','trashmail.org','trashmail.io',
    'trashmail.at','trashmail.de',
    'yopmail.com','yopmail.fr','cool.fr.nf','jetable.fr.nf','nospam.ze.tc',
    'nomail.xl.cx','mega.zik.dj','speed.1s.fr','courriel.fr.nf','moncourrier.fr.nf',
    'monemail.fr.nf','monmail.fr.nf','dispostable.com','mailnesia.com',
    'spam4.me','spamfree24.org','spamfree24.de','spamfree24.eu','spamfree24.info',
    'spamfree24.net','spamgourmet.com','spamgourmet.net','spamgourmet.org',
    'discard.email','discardmail.com','discardmail.de','sharklasers.com',
    'guerrillamailblock.com','maildrop.cc',
    'getnada.com','nada.email','mailnada.com','nadamail.com',
    'getairmail.com','filzmail.com','filzmail.de',
    'throwam.com','throwam.net','throwam.org','throwam.info',
    'fakeemail.com','fake-email.com','fake.email','fakedomain.com',
    'fakemail.net','fakemail.org','fakemailgenerator.com',
    'mailboxy.fun','mailboxy.net','mailboxy.org',
    'tempinbox.com','tempinbox.co.uk','tempr.email','tempe.email',
    'mohmal.com','mohmal.im','mohmal.tech','mohmal.in',
    'mailtemp.info','mailtemp.net','mailtemp.org',
    'tempmail.net','tempmail.org','tempmail.de','tempmail.fr',
    '10minutemail.com','10minutemail.net','10minutemail.org','10minutemail.de',
    '10minutemail.co.uk','10minutemail.co.za','10minutemail.info',
    '10minutemail.us','10minutemail.ru','10minutemail.be','10minutemail.cf',
    'minutemail.com','minutemail.net','minutemail.org',
    'throwaway.email','throwaway.net','throwaway.org',
    'mailsac.com','mailsac.net','mailsac.org',
    'spambox.us','spambox.info','spambox.org','spambox.net',
    'binkmail.com','bobmail.info','chammy.info','devnullmail.com',
    'dump-email.info','emailsensei.com','frapmail.com','obobbo.com',
    'spamgob.com','spamthisplease.com','suremail.info',
    'trashdevil.com','trashdevil.de','trashdevil.net',
    'wegwerfmail.de','wegwerfmail.net','wegwerfmail.org',
    'zoemail.org','zoemail.net','zoemail.com',
    // Obvious test/fake domains
    'fake.com','test.com','example.com','example.net','example.org',
    'test123.com','testing.com','testmail.com','testdomain.com',
    'notreal.com','notanemail.com','noemail.com','noemailaddress.com',
    'invalid.com','invalidemail.com','bademail.com',
    'abc.com','xyz.com','qwerty.com','asdf.com','aaa.com','zzz.com',
    'none.com','noreply.com','donotreply.com',
    'placeholder.com','dummy.com','dummyemail.com',
    'sample.com','sampleemail.com','sampledomain.com',
    'foo.com','bar.com','foobar.com','foobaz.com',
    'email.com','myemail.com','youremail.com','hisemail.com',
    'notvalid.com','notvalidemail.com',
    'random.com','randomemail.com',
    'junk.com','junkemail.com','spam.com','spamemail.com',
    // More disposable services
    'guerrillamail.com','guerrillamail.net','guerrillamail.org',
    'mailinator.net','mailinator.org','mailinator.info',
    'throwam.com','throwam.net',
    'maildrop.cc','mailnull.com',
    'dispostable.com','mailnesia.com',
    'spamgourmet.com','spamgourmet.net','spamgourmet.org',
    'yopmail.com','yopmail.fr',
    'tempmail.com','temp-mail.org',
    'guerrillamail.com','sharklasers.com','grr.la',
    'spam4.me','trashmail.com',
    'mailboxy.fun','getnada.com',
    '10minutemail.com','minutemail.com',
    'throwaway.email','mailsac.com',
  ]);

  // ── Typo map ─────────────────────────────────────────────────────────────────
  var TYPOS = {
    'gmial.com':'gmail.com','gmai.com':'gmail.com','gmil.com':'gmail.com',
    'gmal.com':'gmail.com','gmali.com':'gmail.com','gmail.co':'gmail.com',
    'gmail.cm':'gmail.com','gmail.con':'gmail.com','gmail.cpm':'gmail.com',
    'yahooo.com':'yahoo.com','yaho.com':'yahoo.com','yahoo.co':'yahoo.com',
    'yahoo.cm':'yahoo.com','yahoo.con':'yahoo.com','yhoo.com':'yahoo.com',
    'hotmal.com':'hotmail.com','hotmial.com':'hotmail.com','hotmail.co':'hotmail.com',
    'hotmail.cm':'hotmail.com','hotmail.con':'hotmail.com',
    'outlok.com':'outlook.com','outloo.com':'outlook.com','outlook.co':'outlook.com',
    'iclod.com':'icloud.com','icoud.com':'icloud.com','icloud.co':'icloud.com',
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function isValidFormat(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function getDomain(email) {
    return email.split('@')[1].toLowerCase().trim();
  }

  async function checkMxRecord(domain) {
    try {
      var resp = await fetch(
        'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(domain) + '&type=MX',
        { headers: { accept: 'application/dns-json' } }
      );
      var data = await resp.json();
      if (!data || data.Status !== 0) return false;
      if (!data.Answer || data.Answer.length === 0) return false;
      // Reject null MX records: "0 ." means explicitly no mail server
      var validRecords = data.Answer.filter(function(a) {
        var d = (a.data || '').trim();
        return d !== '.' && d !== '0 .' && !d.endsWith(' .');
      });
      return validRecords.length > 0;
    } catch (e) {
      return true; // fail open on network error
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────────
  function showError(el, message) {
    clearError(el);
    el.style.borderColor = '#ef4444';
    el.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.2)';
    var err = document.createElement('p');
    err.className = 'dru-ext-error';
    err.style.cssText = 'color:#ef4444;font-size:12px;margin-top:4px;font-family:inherit;';
    err.textContent = message;
    el.parentNode.insertBefore(err, el.nextSibling);
  }

  function showSuggestion(input, suggestion) {
    clearError(input);
    input.style.borderColor = '#D4AF37';
    input.style.boxShadow = '0 0 0 2px rgba(212,175,55,0.2)';
    var wrap = document.createElement('div');
    wrap.className = 'dru-ext-error';
    wrap.style.cssText = 'margin-top:4px;font-family:inherit;';
    var msg = document.createElement('p');
    msg.style.cssText = 'color:#D4AF37;font-size:12px;margin:0 0 4px 0;';
    msg.textContent = 'Did you mean ' + suggestion + '?';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'background:#D4AF37;color:#0A2342;border:none;padding:3px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;';
    btn.textContent = 'Use ' + suggestion;
    btn.addEventListener('click', function() {
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, suggestion);
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
      clearError(input);
      emailVerified = true;
      lastVerifiedEmail = suggestion;
    });
    wrap.appendChild(msg);
    wrap.appendChild(btn);
    input.parentNode.insertBefore(wrap, input.nextSibling);
  }

  function showOk(input) {
    clearError(input);
    input.style.borderColor = '#22c55e';
    input.style.boxShadow = '0 0 0 2px rgba(34,197,94,0.2)';
    var ok = document.createElement('p');
    ok.className = 'dru-ext-error';
    ok.style.cssText = 'color:#22c55e;font-size:12px;margin-top:4px;font-family:inherit;';
    ok.textContent = '✓ Email verified';
    input.parentNode.insertBefore(ok, input.nextSibling);
  }

  function showChecking(input) {
    clearError(input);
    input.style.borderColor = '#D4AF37';
    var checking = document.createElement('p');
    checking.className = 'dru-ext-error';
    checking.style.cssText = 'color:#D4AF37;font-size:12px;margin-top:4px;font-family:inherit;';
    checking.textContent = '⏳ Verifying email...';
    input.parentNode.insertBefore(checking, input.nextSibling);
  }

  function clearError(el) {
    el.style.borderColor = '';
    el.style.boxShadow = '';
    var existing = el.parentNode ? el.parentNode.querySelectorAll('.dru-ext-error') : [];
    existing.forEach(function(e) { e.remove(); });
  }

  // ── State ─────────────────────────────────────────────────────────────────────
  var emailVerified = false;
  var emailVerifying = false;
  var lastVerifiedEmail = '';

  async function runEmailVerification(input) {
    var email = (input.value || '').trim();
    if (!email) { clearError(input); emailVerified = false; return; }
    if (!isValidFormat(email)) {
      showError(input, 'Please enter a valid email address.');
      emailVerified = false;
      return;
    }
    var domain = getDomain(email);
    if (DISPOSABLE.has(domain)) {
      showError(input, 'Disposable or test email addresses are not accepted. Please use your real work or personal email.');
      emailVerified = false;
      return;
    }
    var correct = TYPOS[domain];
    if (correct) {
      showSuggestion(input, email.split('@')[0] + '@' + correct);
      emailVerified = false;
      return;
    }
    showChecking(input);
    emailVerifying = true;
    var hasMx = await checkMxRecord(domain);
    emailVerifying = false;
    if (!hasMx) {
      showError(input, 'This email domain does not accept mail. Please check your email address.');
      emailVerified = false;
      return;
    }
    showOk(input);
    emailVerified = true;
    lastVerifiedEmail = email;
  }

  // ── Name length validation ────────────────────────────────────────────────────
  function validateNameField(input) {
    var val = (input.value || '').trim();
    var existing = input.parentNode ? input.parentNode.querySelectorAll('.dru-ext-error') : [];
    existing.forEach(function(e) { e.remove(); });
    if (val.length > 0 && val.length < 2) {
      input.style.borderColor = '#ef4444';
      var err = document.createElement('p');
      err.className = 'dru-ext-error';
      err.style.cssText = 'color:#ef4444;font-size:12px;margin-top:4px;font-family:inherit;';
      err.textContent = 'Must be at least 2 characters';
      input.parentNode.insertBefore(err, input.nextSibling);
    } else {
      input.style.borderColor = '';
    }
  }

  // ── Attach to form fields ─────────────────────────────────────────────────────
  var attached = false;

  function attachValidators() {
    if (attached) return;

    var emailInput = document.querySelector('input[type="email"], input[placeholder*="email"], input[placeholder*="@"]');
    var firstNameInput = document.querySelector('input[placeholder="First name"]');
    var lastNameInput = document.querySelector('input[placeholder="Last name"]');
    var continueBtn = Array.from(document.querySelectorAll('button')).find(function(b) {
      return b.textContent.trim().toLowerCase().includes('continue');
    });

    if (!emailInput || !continueBtn) return;
    attached = true;

    // Email blur validation
    emailInput.addEventListener('blur', function() {
      runEmailVerification(emailInput);
    });

    emailInput.addEventListener('input', function() {
      if (emailVerified && emailInput.value !== lastVerifiedEmail) {
        emailVerified = false;
        clearError(emailInput);
      }
    });

    // Name blur validation
    if (firstNameInput) {
      firstNameInput.addEventListener('blur', function() { validateNameField(firstNameInput); });
    }
    if (lastNameInput) {
      lastNameInput.addEventListener('blur', function() { validateNameField(lastNameInput); });
    }

    // Intercept Continue button (capture phase = runs before React)
    continueBtn.addEventListener('click', async function(e) {
      var email = (emailInput.value || '').trim();

      // Block if email is empty - let React handle it
      if (!email) return;

      // Block if currently verifying
      if (emailVerifying) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      // Format check
      if (!isValidFormat(email)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showError(emailInput, 'Please enter a valid email address.');
        return;
      }

      var domain = getDomain(email);

      // Disposable check
      if (DISPOSABLE.has(domain)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showError(emailInput, 'Disposable or test email addresses are not accepted. Please use your real work or personal email.');
        return;
      }

      // Typo check
      var correct = TYPOS[domain];
      if (correct) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showSuggestion(emailInput, email.split('@')[0] + '@' + correct);
        return;
      }

      // MX check (only if not already verified for this email)
      if (!emailVerified || lastVerifiedEmail !== email) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showChecking(emailInput);
        emailVerifying = true;
        var hasMx = await checkMxRecord(domain);
        emailVerifying = false;
        if (!hasMx) {
          showError(emailInput, 'This email domain does not accept mail. Please check your email address.');
          return;
        }
        showOk(emailInput);
        emailVerified = true;
        lastVerifiedEmail = email;
        // Re-trigger click after verification passes
        setTimeout(function() { continueBtn.click(); }, 50);
      }
    }, true); // capture phase
  }

  // ── Observe DOM for React rendering the form ──────────────────────────────────
  var observer = new MutationObserver(function() {
    // Reset attached flag when form re-renders (e.g., after navigation)
    var continueBtn = Array.from(document.querySelectorAll('button')).find(function(b) {
      return b.textContent.trim().toLowerCase().includes('continue');
    });
    if (continueBtn && !continueBtn._druIntercepted) {
      attached = false;
      emailVerified = false;
      lastVerifiedEmail = '';
    }
    attachValidators();
    // Mark button as intercepted
    if (continueBtn) continueBtn._druIntercepted = true;
  });

  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachValidators);
  } else {
    attachValidators();
  }
})();
