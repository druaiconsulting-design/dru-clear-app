/**
 * DRU CLEAR™ Email Validator
 * Runtime email validation that works independently of the React bundle.
 * Checks: format, disposable domains, DNS MX records (via Cloudflare DoH)
 */
(function () {
  'use strict';

  // ── Disposable domain blocklist ──────────────────────────────────────────
  var DISPOSABLE = new Set([
    'mailinator.com','guerrillamail.com','guerrillamail.net','guerrillamail.org',
    'guerrillamail.biz','guerrillamail.de','guerrillamail.info','grr.la',
    'tempmail.com','temp-mail.org','temp-mail.io','throwam.com','throwam.net',
    'fakeinbox.com','fakeinbox.net','mailnull.com','spamgourmet.com',
    'trashmail.com','trashmail.me','trashmail.net','trashmail.org','trashmail.io',
    'trashmail.at','trashmail.de','trashmail.io','trashmail.me',
    'yopmail.com','yopmail.fr','cool.fr.nf','jetable.fr.nf','nospam.ze.tc',
    'nomail.xl.cx','mega.zik.dj','speed.1s.fr','courriel.fr.nf','moncourrier.fr.nf',
    'monemail.fr.nf','monmail.fr.nf','dispostable.com','mailnesia.com',
    'mailnull.com','spamgourmet.com','spamgourmet.net','spamgourmet.org',
    'spam4.me','spamfree24.org','spamfree24.de','spamfree24.eu','spamfree24.info',
    'spamfree24.net','spamgourmet.com','spamgourmet.net','spamgourmet.org',
    'discard.email','discardmail.com','discardmail.de','sharklasers.com',
    'guerrillamailblock.com','spam4.me','spamfree24.org','spamfree24.de',
    'spamfree24.eu','spamfree24.info','spamfree24.net','spamgourmet.com',
    'maildrop.cc','mailnull.com','spamgourmet.com','throwam.com',
    'getnada.com','nada.email','mailnada.com','nadamail.com',
    'getairmail.com','airmail.com','filzmail.com','filzmail.de',
    'throwam.com','throwam.net','throwam.org','throwam.info',
    'fakeemail.com','fake-email.com','fake.email','fakedomain.com',
    'fakemail.net','fakemail.org','fakemailgenerator.com',
    'mailboxy.fun','mailboxy.net','mailboxy.org',
    'tempinbox.com','tempinbox.co.uk','tempr.email','tempe.email',
    'dispostable.com','mailnesia.com','mailnull.com','spamgourmet.com',
    'spamgourmet.net','spamgourmet.org','spam4.me','spamfree24.org',
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
    'discard.email','discardmail.com','discardmail.de',
    'binkmail.com','bobmail.info','chammy.info','devnullmail.com',
    'dispostable.com','dump-email.info','emailsensei.com',
    'frapmail.com','obobbo.com','spamgob.com','spamthisplease.com',
    'suremail.info','trashdevil.com','trashdevil.de','trashdevil.net',
    'wegwerfmail.de','wegwerfmail.net','wegwerfmail.org',
    'yopmail.com','yopmail.fr','yopmail.net','yopmail.org',
    'zoemail.org','zoemail.net','zoemail.com',
  ]);

  // ── Typo map ─────────────────────────────────────────────────────────────
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  function isValidFormat(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function getDomain(email) {
    return email.split('@')[1].toLowerCase().trim();
  }

  function isDisposable(domain) {
    return DISPOSABLE.has(domain);
  }

  function getTypoSuggestion(email, domain) {
    var correct = TYPOS[domain];
    return correct ? email.replace(domain, correct) : null;
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
      return true; // On network error, allow through (fail open)
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function showEmailError(input, message) {
    clearEmailError(input);
    input.style.borderColor = '#ef4444';
    input.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.2)';
    var err = document.createElement('p');
    err.id = 'dru-email-error';
    err.style.cssText = 'color:#ef4444;font-size:12px;margin-top:4px;font-family:inherit;';
    err.textContent = message;
    input.parentNode.insertBefore(err, input.nextSibling);
  }

  function showEmailSuggestion(input, suggestion) {
    clearEmailError(input);
    input.style.borderColor = '#D4AF37';
    input.style.boxShadow = '0 0 0 2px rgba(212,175,55,0.2)';
    var wrap = document.createElement('div');
    wrap.id = 'dru-email-error';
    wrap.style.cssText = 'margin-top:4px;font-family:inherit;';
    var msg = document.createElement('p');
    msg.style.cssText = 'color:#D4AF37;font-size:12px;margin:0 0 4px 0;';
    msg.textContent = 'Did you mean ' + suggestion + '?';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'background:#D4AF37;color:#0A2342;border:none;padding:3px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;';
    btn.textContent = 'Use ' + suggestion;
    btn.addEventListener('click', function() {
      input.value = suggestion;
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
      clearEmailError(input);
    });
    wrap.appendChild(msg);
    wrap.appendChild(btn);
    input.parentNode.insertBefore(wrap, input.nextSibling);
  }

  function showEmailOk(input) {
    clearEmailError(input);
    input.style.borderColor = '#22c55e';
    input.style.boxShadow = '0 0 0 2px rgba(34,197,94,0.2)';
    var ok = document.createElement('p');
    ok.id = 'dru-email-error';
    ok.style.cssText = 'color:#22c55e;font-size:12px;margin-top:4px;font-family:inherit;';
    ok.textContent = '✓ Email verified';
    input.parentNode.insertBefore(ok, input.nextSibling);
  }

  function showEmailChecking(input) {
    clearEmailError(input);
    input.style.borderColor = '#D4AF37';
    var checking = document.createElement('p');
    checking.id = 'dru-email-error';
    checking.style.cssText = 'color:#D4AF37;font-size:12px;margin-top:4px;font-family:inherit;';
    checking.textContent = '⏳ Verifying email...';
    input.parentNode.insertBefore(checking, input.nextSibling);
  }

  function clearEmailError(input) {
    input.style.borderColor = '';
    input.style.boxShadow = '';
    var existing = document.getElementById('dru-email-error');
    if (existing) existing.remove();
  }

  // ── State ─────────────────────────────────────────────────────────────────
  var emailVerified = false;
  var emailVerifying = false;
  var lastVerifiedEmail = '';

  async function verifyEmail(input) {
    var email = (input.value || '').trim();
    if (!email) { clearEmailError(input); emailVerified = false; return; }
    if (!isValidFormat(email)) {
      showEmailError(input, 'Please enter a valid email address.');
      emailVerified = false;
      return;
    }
    var domain = getDomain(email);
    if (isDisposable(domain)) {
      showEmailError(input, 'Disposable email addresses are not accepted. Please use your work or personal email.');
      emailVerified = false;
      return;
    }
    var suggestion = getTypoSuggestion(email, domain);
    if (suggestion) {
      showEmailSuggestion(input, suggestion);
      emailVerified = false;
      return;
    }
    // DNS MX check
    showEmailChecking(input);
    emailVerifying = true;
    var hasMx = await checkMxRecord(domain);
    emailVerifying = false;
    if (!hasMx) {
      showEmailError(input, 'This email domain does not appear to accept mail. Please check your email address.');
      emailVerified = false;
      return;
    }
    showEmailOk(input);
    emailVerified = true;
    lastVerifiedEmail = email;
  }

  // ── DOM observer to attach to email input ─────────────────────────────────
  function attachToEmailInput() {
    var emailInput = document.querySelector('input[type="email"], input[placeholder*="email"], input[placeholder*="@"]');
    if (!emailInput || emailInput._druValidated) return;
    emailInput._druValidated = true;

    emailInput.addEventListener('blur', function() {
      verifyEmail(emailInput);
    });

    emailInput.addEventListener('input', function() {
      if (emailVerified && emailInput.value !== lastVerifiedEmail) {
        emailVerified = false;
        clearEmailError(emailInput);
      }
    });

    // Intercept the Continue button
    var continueBtn = Array.from(document.querySelectorAll('button')).find(function(b) {
      return b.textContent.trim().toLowerCase().includes('continue');
    });
    if (continueBtn && !continueBtn._druIntercepted) {
      continueBtn._druIntercepted = true;
      continueBtn.addEventListener('click', async function(e) {
        var email = (emailInput.value || '').trim();
        if (!email) return; // Let React handle empty field
        if (emailVerifying) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        if (!isValidFormat(email)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showEmailError(emailInput, 'Please enter a valid email address.');
          return;
        }
        var domain = getDomain(email);
        if (isDisposable(domain)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showEmailError(emailInput, 'Disposable email addresses are not accepted. Please use your work or personal email.');
          return;
        }
        var suggestion = getTypoSuggestion(email, domain);
        if (suggestion) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showEmailSuggestion(emailInput, suggestion);
          return;
        }
        if (!emailVerified || lastVerifiedEmail !== email) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showEmailChecking(emailInput);
          emailVerifying = true;
          var hasMx = await checkMxRecord(domain);
          emailVerifying = false;
          if (!hasMx) {
            showEmailError(emailInput, 'This email domain does not appear to accept mail. Please check your email address.');
            return;
          }
          showEmailOk(emailInput);
          emailVerified = true;
          lastVerifiedEmail = email;
          // Re-trigger click after verification passes
          setTimeout(function() { continueBtn.click(); }, 50);
        }
      }, true); // capture phase
    }
  }

  // ── Observe DOM for React rendering the form ──────────────────────────────
  var observer = new MutationObserver(function() {
    attachToEmailInput();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Also try immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachToEmailInput);
  } else {
    attachToEmailInput();
  }
})();
