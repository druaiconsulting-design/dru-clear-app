import NavBar from '../../components/NavBar';
import { NAVIGATOR_PAYMENT_LINK, ACCELERATOR_PAYMENT_LINK, NAVIGATOR_FEATURES, ACCELERATOR_FEATURES } from './types';
import { useBrandCopy } from '../../lib/brandCopy';

// =============================================================================
// JOIN PAGE — shown to free-tier users
// =============================================================================
export default function CommunityJoin() {
  const positioning = useBrandCopy('positioning');
  return (
    <div style={{ minHeight: '100dvh', background: '#0A2342', display: 'flex', flexDirection: 'column' }}>
      <NavBar active="/community" />
      <main style={{ flex: 1, padding: '0 0 4rem' }}>
        {/* Hero */}
        <div style={{ background: 'linear-gradient(135deg, #0A2342 0%, #0d2d56 50%, #0A2342 100%)', borderBottom: '1px solid rgba(212,175,55,0.2)', padding: '3.5rem 1.5rem 3rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse, rgba(194,24,91,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#C2185B', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '1rem' }}>🔥 Founders Special — Limited Time</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: '#FFFFFF', fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 700, lineHeight: 1.2, maxWidth: 640, margin: '0 auto 1rem' }}>
            Join the DRU AI Consulting<br /><span style={{ color: '#D4AF37' }}>Community Connection</span>
          </h1>
          <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.75)', fontSize: '0.95rem', lineHeight: 1.7, maxWidth: 520, margin: '0 auto 2rem' }}>
            A community built for leaders who are serious about navigating the AI era with clarity, confidence, and a concrete pathway forward.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.35)', borderRadius: 50, padding: '0.5rem 1.25rem' }}>
            <span style={{ color: '#D4AF37', fontSize: '0.75rem' }}>⭐</span>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#D4AF37', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Founding Members Lock In Pricing Forever</p>
          </div>
        </div>

        {/* Pricing cards */}
        <div style={{ padding: '2.5rem 1.5rem', maxWidth: 720, margin: '0 auto' }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#D4AF37', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '1.5rem' }}>Choose Your Path</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Navigator */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ background: 'rgba(212,175,55,0.07)', borderBottom: '1px solid rgba(212,175,55,0.2)', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#D4AF37', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>DRU CLEAR™</p>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", color: '#FFFFFF', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>Navigator</h3>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.55)', fontSize: '0.75rem' }}>Self-directed AI leadership transformation</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", color: '#D4AF37', fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>$97</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.5)', fontSize: '0.68rem' }}>/month</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.35)', fontSize: '0.63rem', textDecoration: 'line-through', marginTop: '0.2rem' }}>normally $147</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  {NAVIGATOR_FEATURES.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <span style={{ color: '#D4AF37', fontSize: '0.7rem', marginTop: 3, flexShrink: 0 }}>✓</span>
                      <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.8)', fontSize: '0.78rem', lineHeight: 1.5 }}>{f.replace('{POSITIONING}', positioning)}</p>
                    </div>
                  ))}
                </div>
                <a href={NAVIGATOR_PAYMENT_LINK} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', width: '100%', background: 'transparent', border: '1.5px solid #D4AF37', borderRadius: 8, padding: '0.85rem', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D4AF37', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
                  Join as Navigator Founder →
                </a>
              </div>
            </div>

            {/* Accelerator */}
            <div style={{ background: 'rgba(194,24,91,0.06)', border: '2px solid rgba(194,24,91,0.5)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ background: 'rgba(194,24,91,0.1)', borderBottom: '1px solid rgba(194,24,91,0.3)', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                  <div style={{ background: '#C2185B', borderRadius: 50, padding: '0.3rem 0.75rem' }}>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#FFFFFF', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Best Value</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#C2185B', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>DRU CLEAR™</p>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", color: '#FFFFFF', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>Accelerator</h3>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.55)', fontSize: '0.75rem' }}>Premium access + monthly DeAnna video</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", color: '#C2185B', fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>$167</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.5)', fontSize: '0.68rem' }}>/month</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.35)', fontSize: '0.63rem', textDecoration: 'line-through', marginTop: '0.2rem' }}>normally $207</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  {ACCELERATOR_FEATURES.map((f, i) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <span style={{ color: i === 0 ? 'rgba(230,230,230,0.4)' : '#C2185B', fontSize: '0.7rem', marginTop: 3, flexShrink: 0 }}>{i === 0 ? '—' : '✓'}</span>
                      <p style={{ fontFamily: "'Inter', sans-serif", color: i === 0 ? 'rgba(230,230,230,0.5)' : 'rgba(230,230,230,0.85)', fontSize: '0.78rem', lineHeight: 1.5, fontStyle: i === 0 ? 'italic' : 'normal' }}>{f.replace('{POSITIONING}', positioning)}</p>
                    </div>
                  ))}
                </div>
                <a href={ACCELERATOR_PAYMENT_LINK} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', width: '100%', background: '#C2185B', border: 'none', borderRadius: 8, padding: '0.85rem', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FFFFFF', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
                  Join as Accelerator Founder →
                </a>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem', textAlign: 'center', padding: '1.25rem 1.5rem', background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 10 }}>
            <p style={{ fontFamily: "'Playfair Display', serif", color: '#FFFFFF', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>The answers are already inside you.</p>
            <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.55)', fontSize: '0.78rem', lineHeight: 1.6 }}>This community is where you find the clarity, the tools, and the people to move forward — with confidence — in the AI era.</p>
          </div>
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.35)', fontSize: '0.75rem' }}>Already a member?</p>
            <a href="/login?redirect=/community" style={{ fontFamily: "'Montserrat', sans-serif", color: '#D4AF37', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textDecoration: 'none', borderBottom: '1px solid rgba(212,175,55,0.4)', paddingBottom: '1px' }}>Log in to access your content →</a>
          </div>
        </div>
      </main>
      <footer style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,0.2)', fontFamily: "'Montserrat', sans-serif", fontSize: '0.65rem', letterSpacing: '0.04em' }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
