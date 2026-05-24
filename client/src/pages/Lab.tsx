import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface LabVideo {
  id: string;
  title: string;
  month_year: string;
  video_url: string;
  is_active: boolean;
  created_at: string;
}

export default function Lab() {
  const { isLoggedIn, loading: authLoading, user } = useAuth();
  const [tier, setTier]               = useState<string | null>(null);
  const [tierLoading, setTierLoading] = useState(true);
  const [videos, setVideos]           = useState<LabVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<LabVideo | null>(null);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) window.location.replace("/login");
  }, [authLoading, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !(user as any)?.id) return;
    supabase.from("profiles").select("tier").eq("id", (user as any).id).single()
      .then(({ data }) => { setTier(data?.tier ?? null); setTierLoading(false); });
  }, [isLoggedIn, (user as any)?.id]);

  useEffect(() => {
    if (!isLoggedIn || tier !== "accelerator") { setVideosLoading(false); return; }
    supabase.from("lab_videos").select("*").eq("is_active", true).order("created_at", { ascending: false })
      .then(({ data }) => {
        const vids = (data ?? []) as LabVideo[];
        setVideos(vids);
        if (vids.length > 0) setActiveVideo(vids[0]);
        setVideosLoading(false);
      });
  }, [isLoggedIn, tier]);

  if (authLoading || tierLoading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(212,175,55,0.6)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", letterSpacing: "0.1em" }}>LOADING...</p>
      </div>
    );
  }

  if (tier !== "accelerator") {
    return (
      <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
        <NavBar active="/lab" />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
          <div style={{ maxWidth: 480, textAlign: "center" as const, border: "1px solid rgba(212,175,55,0.3)", borderRadius: 16, padding: "2.5rem 2rem", background: "rgba(212,175,55,0.04)" }}>
            <p style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🎬</p>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.75rem" }}>Accelerator Exclusive</p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem", lineHeight: 1.3 }}>DeAnna's Leadership Lab™</h1>
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: "1.75rem" }}>
              Monthly exclusive sessions with DeAnna — strategy, leadership, and AI mastery — are available to Accelerator members only.
            </p>
            <a href="https://link.druaiconsulting.com/payment-link/69ead3d37dd3512d920794b1"
              style={{ display: "inline-block", background: "#D4AF37", color: "#0A2342", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", padding: "0.875rem 2rem", borderRadius: 8, textDecoration: "none" }}>
              Upgrade to Accelerator — $147/mo
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/lab" />
      <main style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 900, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.5rem" }}>Accelerator Exclusive</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.25rem" }}>DeAnna's Leadership Lab™</h1>
          <p style={{ color: "rgba(230,230,230,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>Monthly exclusive sessions — strategy, leadership, and AI mastery</p>
        </div>

        {videosLoading ? (
          <div style={{ textAlign: "center" as const, padding: "3rem", color: "rgba(212,175,55,0.6)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", letterSpacing: "0.1em" }}>LOADING SESSIONS...</div>
        ) : videos.length === 0 ? (
          <div style={{ textAlign: "center" as const, padding: "3rem 2rem", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 12, background: "rgba(212,175,55,0.03)" }}>
            <p style={{ fontSize: "2.5rem", marginBottom: "0.875rem" }}>🎬</p>
            <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>First session coming soon</p>
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.4)", fontSize: "0.8rem", lineHeight: 1.6 }}>You'll receive an email when DeAnna's first Leadership Lab session is live.</p>
          </div>
        ) : (
          <>
            {/* Current video — hero */}
            {activeVideo && (
              <div style={{ marginBottom: "2rem" }}>
                <div style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: "rgba(212,175,55,0.08)", borderBottom: "1px solid rgba(212,175,55,0.2)", padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "0.5rem" }}>
                    <div>
                      <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "3px" }}>{activeVideo.month_year}</p>
                      <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1rem", fontWeight: 600, margin: 0 }}>{activeVideo.title}</p>
                    </div>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#D4AF37", color: "#0A2342", letterSpacing: "0.06em" }}>NOW PLAYING</span>
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <video
                      key={activeVideo.id}
                      controls
                      controlsList="nodownload"
                      disablePictureInPicture
                      playsInline
                      onContextMenu={(e) => e.preventDefault()}
                      style={{ width: "100%", borderRadius: 8, background: "#000", maxHeight: 500, display: "block" }}
                    >
                      <source src={activeVideo.video_url} type="video/mp4" />
                      Your browser does not support video playback.
                    </video>
                  </div>
                </div>
              </div>
            )}

            {/* Archive */}
            {videos.length > 1 && (
              <div>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(212,175,55,0.7)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.875rem" }}>Previous Sessions</p>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
                  {videos.slice(1).map(video => (
                    <div key={video.id} onClick={() => setActiveVideo(video)}
                      style={{ background: activeVideo?.id === video.id ? "rgba(212,175,55,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${activeVideo?.id === video.id ? "rgba(212,175,55,0.35)" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, padding: "0.875rem 1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.15s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(212,175,55,0.35)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = activeVideo?.id === video.id ? "rgba(212,175,55,0.35)" : "rgba(255,255,255,0.08)"; }}>
                      <div>
                        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(212,175,55,0.7)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "3px" }}>{video.month_year}</p>
                        <p style={{ fontFamily: "'Inter', sans-serif", color: "#FFFFFF", fontSize: "0.8rem", margin: 0 }}>{video.title}</p>
                      </div>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", color: "rgba(212,175,55,0.6)", letterSpacing: "0.06em", flexShrink: 0 }}>▶ Play</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <footer style={{ textAlign: "center" as const, padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
