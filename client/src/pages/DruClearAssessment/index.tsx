import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { SplashScreen, WelcomeScreen, CalculatingScreen, ExpiredScreen, NudgeBanner } from "./screens/Utility";
import LeadCapture from "./screens/LeadCapture";
import Pillar from "./screens/Pillar";
import Results from "./screens/Results";
import Diagnose from "./screens/Diagnose";
import { Payment, ThankYouPurchase } from "./screens/Payment";
import Share from "./screens/Share";
import {
  saveExpiryTimestamp, getExpiryStatus, clearExpiryTimestamp,
  PAYMENT_STRATEGIC_URL, PAYMENT_EXECUTIVE_URL,
  CALENDAR_STRATEGIC_URL, CALENDAR_EXECUTIVE_URL,
} from "./config";
import {
  loadProgress, saveProgress, clearProgress,
  flushWebhookQueue, sendWebhook, normalizePhone,
  RESUMABLE_SCREENS, UTM_PARAMS,
} from "./utils";
import type { Screen, LeadData, Scores } from "./types";

export default function DruClearAssessment() {
  const saved = loadProgress();
  const [screen, setScreen]       = useState<Screen>(saved?.screen ?? "splash");
  const [lead, setLead]           = useState<LeadData>(saved?.lead ?? { firstName: "", lastName: "", email: "", phone: "", company: "", role: "" });
  const [scores, setScores]       = useState<Scores>(saved?.scores ?? {});
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const expiryStatus              = getExpiryStatus();
  const [authChecked, setAuthChecked] = useState(false);

  // ── Auth check ───────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user?: unknown } | null } }) => {
      const onAppDomain = window.location.hostname === "app.druaiconsulting.com";
      if (session?.user && onAppDomain) {
        window.location.href = "/portal";
      } else {
        setAuthChecked(true);
      }
    }).catch(() => { setAuthChecked(true); });
  }, []);

  // ── PWA install detection ─────────────────────────────────────────────────
  const ua = navigator.userAgent;
  const isInStandaloneMode = (window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isMobile = isIos || isAndroid;
  const isSamsungBrowser = /samsungbrowser/i.test(ua);
  const isFirefox = /firefox/i.test(ua) && !/seamonkey/i.test(ua);
  const isEdgeBrowser = /edg\//i.test(ua);
  const isOperaBrowser = /opr\//i.test(ua) || /opera/i.test(ua);
  const isChromeBased = /chrome/i.test(ua) && !/edg\//i.test(ua) && !/samsungbrowser/i.test(ua) && !/opr\//i.test(ua);
  const isIosChrome = isIos && /crios/i.test(ua);
  const isIosFirefox = isIos && /fxios/i.test(ua);
  const isIosEdge = isIos && /edgios/i.test(ua);
  const isIosSafari = isIos && !isIosChrome && !isIosFirefox && !isIosEdge;
  const isDesktop = !isMobile;
  const isDesktopChrome = isDesktop && isChromeBased;
  const isDesktopEdge = isDesktop && isEdgeBrowser;
  const isDesktopFirefox = isDesktop && isFirefox;

  type BrowserInstallInfo = { label: string; steps: string[]; note?: string };
  const getBrowserInstallInfo = (): BrowserInstallInfo | null => {
    if (isInStandaloneMode) return null;
    if (isIosChrome)   return { label: "Chrome on iPhone/iPad", steps: ["Tap the Share button (↑) at the bottom of Chrome", "Scroll down and tap \"Add to Home Screen\"", "Tap \"Add\" to confirm"], note: "The Share button is in Chrome's bottom toolbar." };
    if (isIosFirefox)  return { label: "Firefox on iPhone/iPad", steps: ["Tap the Share button (↑) at the bottom of Firefox", "Scroll down and tap \"Add to Home Screen\"", "Tap \"Add\" to confirm"] };
    if (isIosEdge)     return { label: "Edge on iPhone/iPad", steps: ["Tap the Share button (↑) at the bottom of Edge", "Scroll down and tap \"Add to Home Screen\"", "Tap \"Add\" to confirm"] };
    if (isIosSafari)   return { label: "Safari on iPhone/iPad", steps: ["Tap the Share button (↑) at the bottom of Safari", "Scroll down and tap \"Add to Home Screen\"", "Tap \"Add\" to confirm"] };
    if (isSamsungBrowser) return { label: "Samsung Internet", steps: ["Tap the ☰ menu icon (bottom right)", "Tap \"Add page to\"", "Tap \"Home screen\" and confirm"] };
    if (isFirefox && isAndroid) return { label: "Firefox on Android", steps: ["Tap the ⋯ menu (top right)", "Tap \"Install\"", "Tap \"Add\" to confirm"] };
    if (isEdgeBrowser && isAndroid) return { label: "Edge on Android", steps: ["Tap the ⋯ menu (bottom center)", "Tap \"Add to phone\"", "Tap \"Install\" to confirm"] };
    if (isOperaBrowser && isAndroid) return { label: "Opera on Android", steps: ["Tap the ⋯ menu (bottom right)", "Tap \"Home screen\"", "Tap \"Add\" to confirm"] };
    if (isDesktopChrome)  return { label: "Chrome on Desktop", steps: ["Click the install icon (⤓) in the address bar", "Click \"Install\" to confirm"], note: "If no install icon appears, click ⋮ → Save and share → Install page as app." };
    if (isDesktopEdge)    return { label: "Edge on Desktop", steps: ["Click the install icon in the address bar", "Click \"Install\" to confirm"], note: "Or click ⋯ → Apps → Install this site as an app." };
    if (isDesktopFirefox) return { label: "Firefox on Desktop", steps: ["Click the install icon (⤓) in the address bar if visible", "Or open Firefox menu (≡) and click \"Install\"", "Click \"Add\" to confirm"], note: "Firefox desktop PWA support requires Firefox 116 or later." };
    return null;
  };

  const browserInstallInfo       = getBrowserInstallInfo();
  const needsManualInstructions  = browserInstallInfo !== null;
  const [installPromptEvent, setInstallPromptEvent] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner]   = useState(false);
  const [showUpdateAvailable, setShowUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker]             = useState<ServiceWorker | null>(null);
  const [installDismissed, setInstallDismissed]       = useState(() => { try { return localStorage.getItem("dru_install_dismissed") === "1"; } catch { return false; } });
  const [showManualBanner, setShowManualBanner]       = useState(false);
  const [manualBannerDismissed]                       = useState(() => { try { return localStorage.getItem("dru_manual_install_dismissed") === "1"; } catch { return false; } });
  const dismissManualBanner = () => { setShowManualBanner(false); try { localStorage.setItem("dru_manual_install_dismissed", "1"); } catch {} };

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPromptEvent(e); if (!installDismissed) setShowInstallBanner(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [installDismissed]);

  const handleInstall = async () => {
    if (!installPromptEvent) return;
    (installPromptEvent as any).prompt();
    const { outcome } = await (installPromptEvent as any).userChoice;
    if (outcome === "accepted") { setShowInstallBanner(false); setInstallPromptEvent(null); }
  };

  const dismissInstallBanner = () => { setShowInstallBanner(false); setInstallDismissed(true); try { localStorage.setItem("dru_install_dismissed", "1"); } catch {} };

  useEffect(() => {
    if (needsManualInstructions && !isInStandaloneMode && !manualBannerDismissed && (screen === "results" || screen === "share-your-excitement")) {
      const timer = setTimeout(() => setShowManualBanner(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [screen, needsManualInstructions, isInStandaloneMode, manualBannerDismissed]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        if (reg.waiting) { setWaitingWorker(reg.waiting); setShowUpdateAvailable(true); }
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => { if (newWorker.state === "installed" && navigator.serviceWorker.controller) { setWaitingWorker(newWorker); setShowUpdateAvailable(true); } });
        });
      }).catch(() => {});
    }
    flushWebhookQueue();
  }, []);

  useEffect(() => {
    const handleInstalled = () => { sendWebhook({ event_type: "pwa_installed", first_name: lead.firstName, last_name: lead.lastName, email: lead.email, phone: normalizePhone(lead.phone || ""), ai_country_name: lead.country_name || "", ai_country_iso: lead.country_iso || "", company: lead.company, role: lead.role, browser: navigator.userAgent, platform: navigator.platform || "", ...UTM_PARAMS, timestamp: new Date().toISOString() }); };
    window.addEventListener("appinstalled", handleInstalled);
    return () => window.removeEventListener("appinstalled", handleInstalled);
  }, [lead]);

  useEffect(() => {
    if (screen === "results") saveExpiryTimestamp();
    if (screen === "splash") clearExpiryTimestamp();
  }, [screen]);

  useEffect(() => {
    if (RESUMABLE_SCREENS.includes(screen)) { saveProgress(screen, lead, scores); }
    else if (screen === "results" || screen === "calculating") { clearProgress(); }
  }, [screen, lead, scores]);

  const updateScore = (qIndex: number, value: number) => { setScores((prev) => ({ ...prev, [qIndex]: value })); };
  const appRef       = useRef<HTMLDivElement>(null);
  const topAnchorRef = useRef<HTMLDivElement>(null);

  const goTo = (s: Screen) => {
    setScreen(s);
    setTimeout(() => { topAnchorRef.current?.scrollIntoView({ behavior: "auto", block: "start" }); }, 50);
  };

  const resetAssessment = () => {
    clearExpiryTimestamp(); clearProgress();
    setScores({}); setLead({ firstName: "", lastName: "", email: "", phone: "", company: "", role: "" });
    goTo("welcome");
  };

  if (!authChecked) return <div style={{ minHeight: "100dvh", background: "#0A2342" }} />;

  return (
    <div ref={appRef} style={{ minHeight: "100dvh", width: "100%", background: "#0A2342", display: "flex", flexDirection: "column", overflowX: "hidden", position: "relative" }}>
      <div ref={topAnchorRef} style={{ height: 0, overflow: "hidden", position: "absolute", top: 0, left: 0 }} aria-hidden="true" />
      <div key={screen} style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {screen === "splash"       && <SplashScreen onDone={() => goTo("welcome")} />}
        {screen === "welcome"      && <WelcomeScreen onStart={() => goTo("lead-capture")} />}
        {screen === "lead-capture" && <LeadCapture onContinue={(data) => { setLead(data); goTo("clarity"); }} />}

        {screen === "clarity" && <Pillar pillarLetter="C" pillarName="CLARITY" subtitle="AI Vision & Strategic Direction" progress={20} progressLabel="Pillar 1 of 5" questions={["Our organization has a clearly defined AI vision that connects to our overall business strategy.","Leaders and teams across the organization understand why we are pursuing AI and what success looks like.","We have identified specific strategic priorities where AI will have the greatest business impact."]} questionStartIndex={0} scores={scores} onScoreChange={updateScore} onNext={() => goTo("leadership")} />}
        {screen === "leadership" && <Pillar pillarLetter="L" pillarName="LEADERSHIP" subtitle="Executive AI Fluency & Sponsorship" progress={40} progressLabel="Pillar 2 of 5" questions={["Our organizational leaders can clearly articulate how AI connects to our business strategy and competitive position.","There is a designated executive sponsor who is accountable for driving AI transformation.","Our leadership team actively participates in AI learning, development, and decision-making."]} questionStartIndex={3} scores={scores} onScoreChange={updateScore} onNext={() => goTo("execution")} />}
        {screen === "execution" && <Pillar pillarLetter="E" pillarName="EXECUTION" subtitle="Operational AI Implementation Capacity" progress={60} progressLabel="Pillar 3 of 5" questions={["We have identified specific business processes where AI can deliver measurable impact.","Our teams have the skills, tools, and resources needed to implement AI solutions today.","We have completed at least one AI pilot or proof of concept in the past 12 months."]} questionStartIndex={6} scores={scores} onScoreChange={updateScore} onNext={() => goTo("alignment")} />}
        {screen === "alignment" && <Pillar pillarLetter="A" pillarName="ALIGNMENT" subtitle="Cross-Functional Strategic Coherence" progress={80} progressLabel="Pillar 4 of 5" questions={["Our AI initiatives are aligned with our overall business goals and strategic plan.","There is clear and consistent communication between departments about AI priorities and progress.","Our AI efforts are coordinated across teams and business units rather than operating in silos."]} questionStartIndex={9} scores={scores} onScoreChange={updateScore} onNext={() => goTo("results-pillar")} />}
        {screen === "results-pillar" && <Pillar pillarLetter="R" pillarName="RESULTS" subtitle="Measurement, Tracking & Return on Investment" progress={100} progressLabel="Pillar 5 of 5" questions={["We have defined clear Key Performance Indicators to measure the success of our AI initiatives.","We can demonstrate measurable return on investment from at least one AI-related initiative.","We have a system in place to regularly track and report AI progress to leadership."]} questionStartIndex={12} scores={scores} onScoreChange={updateScore} onNext={() => goTo("calculating")} nextLabel="See My Results →" />}

        {screen === "calculating" && <CalculatingScreen onDone={() => goTo("results")} />}

        {screen === "results" && expiryStatus === "expired" && <ExpiredScreen onRetake={resetAssessment} />}
        {screen === "results" && expiryStatus !== "expired" && (
          <>
            {expiryStatus === "nudge" && !nudgeDismissed && <NudgeBanner onDismiss={() => setNudgeDismissed(true)} onBookNow={() => goTo("diagnose")} />}
            <Results lead={lead} scores={scores} onBookCall={() => goTo("diagnose")} />
          </>
        )}

        {screen === "diagnose" && expiryStatus === "expired" && <ExpiredScreen onRetake={resetAssessment} />}
        {screen === "diagnose" && expiryStatus !== "expired" && (
          <>
            {expiryStatus === "nudge" && !nudgeDismissed && <NudgeBanner onDismiss={() => setNudgeDismissed(true)} onBookNow={() => goTo("diagnose")} />}
            <Diagnose lead={lead} scores={scores} onSelectStrategic={() => goTo("payment-strategic")} onSelectExecutive={() => goTo("payment-executive")} onSkipToTransformation={() => goTo("share-your-excitement")} />
          </>
        )}

        {screen === "payment-strategic"  && <Payment tier="strategic" price="$3,497" paymentUrl={PAYMENT_STRATEGIC_URL} onBack={() => goTo("diagnose")} />}
        {screen === "payment-executive"  && <Payment tier="executive" price="$4,997" paymentUrl={PAYMENT_EXECUTIVE_URL} onBack={() => goTo("diagnose")} />}
        {screen === "thankyou-strategic" && <ThankYouPurchase lead={lead} tier="strategic" calendarUrl={CALENDAR_STRATEGIC_URL} onContinue={() => goTo("share-your-excitement")} />}
        {screen === "thankyou-executive" && <ThankYouPurchase lead={lead} tier="executive" calendarUrl={CALENDAR_EXECUTIVE_URL} onContinue={() => goTo("share-your-excitement")} />}

        {screen === "expired"              && <ExpiredScreen onRetake={resetAssessment} />}
        {screen === "share-your-excitement"&& <Share lead={lead} scores={scores} onRevisit={() => goTo("diagnose")} />}
      </div>

      {/* Update available banner */}
      {showUpdateAvailable && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999, background: "linear-gradient(135deg, #0A1628 0%, #0D1F3C 100%)", borderBottom: "1px solid rgba(212,175,55,0.4)", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.04em" }}>Update available</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.7rem" }}>A new version of DRU CLEAR™ is ready</div>
          </div>
          <button onClick={() => { waitingWorker?.postMessage({ type: "SKIP_WAITING" }); window.location.reload(); }} style={{ background: "#D4AF37", color: "#0A1628", border: "none", borderRadius: 4, padding: "0.45rem 0.9rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.06em", cursor: "pointer", flexShrink: 0 }}>TAP TO REFRESH</button>
          <button onClick={() => setShowUpdateAvailable(false)} aria-label="Dismiss" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "1.1rem", flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Install banner */}
      {showInstallBanner && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: "linear-gradient(135deg, #0A1628 0%, #0D1F3C 100%)", borderTop: "1px solid rgba(212,175,55,0.4)", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", boxShadow: "0 -4px 24px rgba(0,0,0,0.5)" }}>
          <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/dru-android-192_87c8fd3a.png" alt="DRU CLEAR™" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.04em", marginBottom: 2 }}>Add to Home Screen</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: "0.7rem", letterSpacing: "0.02em" }}>Save this app for instant access to your Leadership with AI transformation</div>
          </div>
          <button onClick={handleInstall} style={{ background: "#D4AF37", color: "#0A1628", border: "none", borderRadius: 4, padding: "0.45rem 0.9rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.06em", cursor: "pointer", flexShrink: 0 }}>INSTALL</button>
          <button onClick={dismissInstallBanner} aria-label="Dismiss" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "0.25rem", flexShrink: 0, fontSize: "1.1rem", lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Manual install banner */}
      {showManualBanner && browserInstallInfo && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: "linear-gradient(135deg, #0A1628 0%, #0D1F3C 100%)", borderTop: "1px solid rgba(212,175,55,0.4)", padding: "1rem 1.25rem 1.5rem", boxShadow: "0 -4px 24px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/dru-android-192_87c8fd3a.png" alt="DRU CLEAR™" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.04em", marginBottom: 2 }}>Save this app for instant access to your Leadership with AI Transformation</div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: "0.65rem", letterSpacing: "0.02em" }}>{browserInstallInfo.label}</div>
            </div>
            <button onClick={dismissManualBanner} aria-label="Dismiss" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "0.25rem", flexShrink: 0, fontSize: "1.1rem", lineHeight: 1, marginTop: "-2px" }}>×</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 6, padding: "0.65rem 0.75rem" }}>
            {browserInstallInfo.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.65rem", minWidth: 16, marginTop: 1 }}>{i + 1}.</span>
                <span style={{ color: "rgba(255,255,255,0.75)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", letterSpacing: "0.02em", lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}
          </div>
          {browserInstallInfo.note && (
            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "flex-start", gap: "0.4rem" }}>
              <span style={{ color: "#D4AF37", fontSize: "0.7rem", flexShrink: 0, marginTop: 1 }}>&#9432;</span>
              <span style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.63rem", letterSpacing: "0.02em", lineHeight: 1.5, fontStyle: "italic" }}>{browserInstallInfo.note}</span>
            </div>
          )}
        </div>
      )}

      {screen !== "splash" && screen !== "calculating" && (
        <footer style={{ textAlign: "center", padding: "0.75rem 1rem", color: "rgba(255,255,255,0.25)", fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: "0.65rem", letterSpacing: "0.04em", background: "transparent" }}>
          © 2026 DRU CLEAR™ &nbsp;·&nbsp; All Rights Reserved &nbsp;·&nbsp; DRU AI Consulting
        </footer>
      )}
    </div>
  );
}
