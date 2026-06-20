import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import AdminLayout from "../components/AdminLayout";
import MemberAvatar from "./community/MemberAvatar";
import { useCommunityLevels, getGapSignal, levelRank, PATHWAY_STAGES, DEFAULT_LEVEL_NAME, type LevelTier } from "../lib/communityLevels";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Member {
  id: string; first_name: string | null; last_name: string | null;
  email: string; tier: string; community_level: string | null;
  pathway_stage: string | null; clarity_points: number;
  photo_url: string | null;
}

// Local shape kept identical to the rest of this file (textColor, not color) —
// adapts the shared module's { label, bg, color } into what this page expects.
function gapSignalFor(level: string | null, pathway: string | null, levels: LevelTier[]): { label: string; bg: string; textColor: string } {
  const signal = getGapSignal(level ?? '', pathway ?? '', levels);
  if (!signal) return { label: 'No Activity', bg: 'rgba(10,35,66,0.05)', textColor: 'rgba(10,35,66,0.35)' };
  return { label: signal.label, bg: signal.bg, textColor: signal.color };
}

type SignalFilter = 'all' | 'Hot Lead' | 'Aligned' | 'Retention Risk' | 'No Activity';
type TierFilter   = 'all' | 'navigator' | 'accelerator';
type SortBy       = 'points' | 'name' | 'level' | 'pathway';
const PAGE_SIZE = 50;

export default function AdminMemberIntelligence() {
  const levels = useCommunityLevels();
  const [members,      setMembers]      = useState<Member[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all');
  const [tierFilter,   setTierFilter]   = useState<TierFilter>('all');
  const [sortBy,       setSortBy]       = useState<SortBy>('points');
  const [page,         setPage]         = useState(1);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, tier, community_level, pathway_stage, clarity_points, photo_url')
      .in('tier', ['navigator', 'accelerator'])
      .order('clarity_points', { ascending: false });
    setMembers((data as Member[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
    const ch = supabase.channel('member-intel-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchMembers).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { setPage(1); }, [search, signalFilter, tierFilter, sortBy]);

  const withSignal = useMemo(() => members.map(m => ({ ...m, signal: gapSignalFor(m.community_level, m.pathway_stage, levels) })), [members, levels]);

  const counts = useMemo(() => ({
    total:      withSignal.length,
    hotLead:    withSignal.filter(m => m.signal.label === 'Hot Lead').length,
    aligned:    withSignal.filter(m => m.signal.label === 'Aligned').length,
    retention:  withSignal.filter(m => m.signal.label === 'Retention Risk').length,
    noActivity: withSignal.filter(m => m.signal.label === 'No Activity').length,
  }), [withSignal]);

  const filtered = useMemo(() => {
    let r = withSignal;
    if (signalFilter !== 'all') r = r.filter(m => m.signal.label === signalFilter);
    if (tierFilter   !== 'all') r = r.filter(m => m.tier === tierFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(m => (m.first_name ?? '').toLowerCase().includes(q) || (m.last_name ?? '').toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q));
    }
    return [...r].sort((a, b) => {
      if (sortBy === 'name')    return `${a.first_name}${a.last_name}`.localeCompare(`${b.first_name}${b.last_name}`);
      if (sortBy === 'level')   return levelRank(b.community_level ?? '', levels) - levelRank(a.community_level ?? '', levels);
      if (sortBy === 'pathway') return PATHWAY_STAGES.indexOf((b.pathway_stage ?? '') as typeof PATHWAY_STAGES[number]) - PATHWAY_STAGES.indexOf((a.pathway_stage ?? '') as typeof PATHWAY_STAGES[number]);
      return (b.clarity_points ?? 0) - (a.clarity_points ?? 0);
    });
  }, [withSignal, signalFilter, tierFilter, search, sortBy, levels]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    const headers = ['First Name','Last Name','Email','Tier','Community Level','Pathway Stage','Clarity Points','Gap Signal'];
    const rows = filtered.map(m => [m.first_name ?? '', m.last_name ?? '', m.email, m.tier, m.community_level ?? '', m.pathway_stage ?? '', String(m.clarity_points ?? 0), m.signal.label]);
    const csv  = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `dru-member-intelligence-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filterBtn = (active: boolean, color: string): React.CSSProperties => ({
    fontFamily:"'Montserrat', sans-serif", fontSize:'0.63rem', fontWeight:700,
    letterSpacing:'0.08em', textTransform:'uppercase', padding:'0.35rem 0.875rem',
    borderRadius:20, cursor:'pointer',
    border:`1px solid ${active ? color : color + '55'}`,
    background: active ? color + '20' : 'transparent',
    color: active ? color : color + 'AA',
    transition:'all 0.15s',
  });

  const pageNums = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4)       return [1,2,3,4,5,6,7];
    if (page >= totalPages - 3) return Array.from({ length: 7 }, (_, i) => totalPages - 6 + i);
    return [page - 3, page - 2, page - 1, page, page + 1, page + 2, page + 3];
  }, [page, totalPages]);

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex:1, padding:'2rem 1.5rem', maxWidth:1100, margin:'0 auto', width:'100%' }}>

        {/* Header */}
        <div style={{ marginBottom:'1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <h1 style={{ fontFamily:"'Playfair Display', serif", color:'#0A2342', fontSize:'1.75rem', fontWeight:700, lineHeight:1.2, marginBottom:'0.2rem' }}>Member Intelligence</h1>
            <p style={{ color:'rgba(10,35,66,0.45)', fontFamily:"'Inter', sans-serif", fontSize:'0.75rem' }}>
              Community engagement level vs. investment pathway stage · Hot Lead = engaged but not yet invested
            </p>
          </div>
          <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
            <button onClick={handleExport} disabled={filtered.length === 0}
              style={{ fontFamily:"'Montserrat', sans-serif", fontSize:'0.68rem', fontWeight:700, color:'#D4AF37', border:'1px solid rgba(212,175,55,0.35)', borderRadius:8, padding:'0.6rem 1.25rem', letterSpacing:'0.06em', cursor:filtered.length > 0 ? 'pointer' : 'default', background:'transparent', opacity:filtered.length > 0 ? 1 : 0.4 }}>
              Export CSV ↓
            </button>
            <div onClick={() => window.location.href = '/admin-approvals'}
              style={{ fontFamily:"'Montserrat', sans-serif", fontSize:'0.72rem', fontWeight:700, color:'#D4AF37', border:'1px solid rgba(212,175,55,0.35)', borderRadius:8, padding:'0.6rem 1.25rem', letterSpacing:'0.06em', cursor:'pointer' }}>
              ← Intelligence Dashboard
            </div>
            <div onClick={() => window.location.href = '/admin'}
              style={{ fontFamily:"'Montserrat', sans-serif", fontSize:'0.72rem', fontWeight:700, color:'rgba(10,35,66,0.5)', border:'1px solid rgba(10,35,66,0.2)', borderRadius:8, padding:'0.6rem 1.25rem', letterSpacing:'0.06em', cursor:'pointer' }}>
              ← Profit Pulse
            </div>
          </div>
        </div>

        {/* Signal Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'0.75rem', marginBottom:'1.5rem' }}>
          {[
            { label:'Total Members',  value:counts.total,     color:'#D4AF37' },
            { label:'Hot Leads',      value:counts.hotLead,   color:'#C2185B' },
            { label:'Aligned',        value:counts.aligned,   color:'#43A047' },
            { label:'Retention Risk', value:counts.retention, color:'#E67E22' },
          ].map(s => (
            <div key={s.label} style={{ background:'#FFFFFF', border:`1px solid ${s.color}25`, borderRadius:10, padding:'0.875rem 1rem' }}>
              <p style={{ fontFamily:"'Playfair Display', serif", color:s.color, fontSize:'1.75rem', fontWeight:700, margin:0 }}>{loading ? '—' : s.value}</p>
              <p style={{ fontFamily:"'Montserrat', sans-serif", color:'rgba(10,35,66,0.45)', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', margin:'4px 0 0' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Signal Filters */}
        <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
          <button onClick={() => setSignalFilter('all')}            style={filterBtn(signalFilter === 'all',            '#D4AF37')}>All ({counts.total})</button>
          <button onClick={() => setSignalFilter('Hot Lead')}       style={filterBtn(signalFilter === 'Hot Lead',       '#C2185B')}>Hot Lead ({counts.hotLead})</button>
          <button onClick={() => setSignalFilter('Aligned')}        style={filterBtn(signalFilter === 'Aligned',        '#1B4D8E')}>Aligned ({counts.aligned})</button>
          <button onClick={() => setSignalFilter('Retention Risk')} style={filterBtn(signalFilter === 'Retention Risk', '#947B27')}>Retention Risk ({counts.retention})</button>
          <button onClick={() => setSignalFilter('No Activity')}    style={filterBtn(signalFilter === 'No Activity',    'rgba(10,35,66,0.45)')}>No Activity ({counts.noActivity})</button>
        </div>

        {/* Search / Tier / Sort */}
        <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' }}>
          <input type="text" placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex:1, minWidth:200, background:'#FFFFFF', border:'1px solid rgba(10,35,66,0.2)', borderRadius:6, padding:'0.55rem 0.875rem', color:'#0A2342', fontFamily:"'Inter', sans-serif", fontSize:'0.78rem', outline:'none' }} />
          <select value={tierFilter} onChange={e => setTierFilter(e.target.value as TierFilter)}
            style={{ background:'#FFFFFF', border:'1px solid rgba(10,35,66,0.2)', borderRadius:6, padding:'0.55rem 0.875rem', color:'#0A2342', fontFamily:"'Montserrat', sans-serif", fontSize:'0.7rem', fontWeight:700, cursor:'pointer', outline:'none' }}>
            <option value="all">All Tiers</option>
            <option value="navigator">Navigator</option>
            <option value="accelerator">Accelerator</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
            style={{ background:'#FFFFFF', border:'1px solid rgba(10,35,66,0.2)', borderRadius:6, padding:'0.55rem 0.875rem', color:'#0A2342', fontFamily:"'Montserrat', sans-serif", fontSize:'0.7rem', fontWeight:700, cursor:'pointer', outline:'none' }}>
            <option value="points">Sort: Clarity Points™</option>
            <option value="name">Sort: Name</option>
            <option value="level">Sort: Community Level</option>
            <option value="pathway">Sort: Pathway Stage</option>
          </select>
        </div>

        <p style={{ fontFamily:"'Inter', sans-serif", color:'rgba(10,35,66,0.35)', fontSize:'0.68rem', marginBottom:'0.75rem' }}>
          {loading ? 'Loading members...' : `${filtered.length} member${filtered.length !== 1 ? 's' : ''}${signalFilter !== 'all' || tierFilter !== 'all' || search ? ' (filtered)' : ''} · Page ${page} of ${totalPages}`}
        </p>

        {/* Member List */}
        {loading ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'rgba(10,35,66,0.4)', fontFamily:"'Montserrat', sans-serif", fontSize:'0.75rem' }}>LOADING...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'rgba(10,35,66,0.3)', fontFamily:"'Inter', sans-serif", fontSize:'0.85rem' }}>
            {members.length === 0 ? 'No members yet — appears when Navigator and Accelerator members join' : 'No members match your filters'}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
            {paginated.map(member => {
              const isHot = member.signal.label === 'Hot Lead';
              const displayName = (member.first_name || member.last_name) ? [member.first_name, member.last_name].filter(Boolean).join(' ') : member.email;
              return (
                <div key={member.id} style={{ background: isHot ? 'rgba(194,24,91,0.03)' : '#FFFFFF', border: isHot ? '1px solid rgba(194,24,91,0.15)' : '1px solid rgba(10,35,66,0.08)', borderRadius:10, padding:'0.75rem 1rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.75rem', flexWrap:'wrap' }}>

                  {/* Avatar + name + email */}
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', minWidth:160, flex:'1 1 160px' }}>
                    <MemberAvatar
                      firstName={member.first_name || member.email}
                      photoUrl={member.photo_url ?? undefined}
                      size={44}
                    />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily:"'Montserrat', sans-serif", fontSize:'0.72rem', fontWeight:700, color:'#0A2342', margin:0, marginBottom:'1px' }}>{displayName}</p>
                      <p style={{ fontFamily:"'Inter', sans-serif", fontSize:'0.6rem', color:'rgba(10,35,66,0.35)', margin:0 }}>{member.email}</p>
                    </div>
                  </div>

                  <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:'0.58rem', fontWeight:700, padding:'2px 8px', borderRadius:20, flexShrink:0, background:member.tier === 'accelerator' ? 'rgba(194,24,91,0.1)' : 'rgba(212,175,55,0.1)', color:member.tier === 'accelerator' ? '#C2185B' : '#D4AF37', border:`1px solid ${member.tier === 'accelerator' ? 'rgba(194,24,91,0.3)' : 'rgba(212,175,55,0.3)'}` }}>
                    {member.tier === 'accelerator' ? 'Accelerator' : 'Navigator'}
                  </span>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', flexShrink:0 }}>
                    <span style={{ fontFamily:"'Inter', sans-serif", fontSize:'0.68rem', color:'rgba(212,175,55,0.9)', fontWeight:600 }}>{member.community_level ?? DEFAULT_LEVEL_NAME}</span>
                    <span style={{ color:'rgba(10,35,66,0.2)', fontSize:'0.6rem' }}>→</span>
                    <span style={{ fontFamily:"'Inter', sans-serif", fontSize:'0.68rem', color:'rgba(10,35,66,0.5)' }}>{member.pathway_stage ?? 'None'}</span>
                  </div>
                  <div style={{ textAlign:'center', flexShrink:0, minWidth:52 }}>
                    <p style={{ fontFamily:"'Playfair Display', serif", color:'#D4AF37', fontSize:'0.95rem', fontWeight:700, margin:0 }}>{member.clarity_points ?? 0}</p>
                    <p style={{ fontFamily:"'Montserrat', sans-serif", fontSize:'0.5rem', color:'rgba(10,35,66,0.3)', margin:0, letterSpacing:'0.08em' }}>PTS</p>
                  </div>
                  <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:'0.6rem', fontWeight:700, padding:'3px 10px', borderRadius:20, flexShrink:0, background:member.signal.bg, color:member.signal.textColor, whiteSpace:'nowrap' }}>
                    {member.signal.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem', marginTop:'1.5rem', flexWrap:'wrap' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ fontFamily:"'Montserrat', sans-serif", fontSize:'0.65rem', fontWeight:700, padding:'0.45rem 1rem', borderRadius:6, cursor:page === 1 ? 'default' : 'pointer', border:'1px solid rgba(10,35,66,0.15)', background:'transparent', color:page === 1 ? 'rgba(10,35,66,0.2)' : 'rgba(10,35,66,0.6)' }}>
              ← Prev
            </button>
            {pageNums.map(n => (
              <button key={n} onClick={() => setPage(n)}
                style={{ fontFamily:"'Montserrat', sans-serif", fontSize:'0.65rem', fontWeight:700, padding:'0.45rem 0.75rem', borderRadius:6, cursor:'pointer', border:`1px solid ${n === page ? '#D4AF37' : 'rgba(10,35,66,0.15)'}`, background:n === page ? 'rgba(212,175,55,0.12)' : 'transparent', color:n === page ? '#D4AF37' : 'rgba(10,35,66,0.5)' }}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ fontFamily:"'Montserrat', sans-serif", fontSize:'0.65rem', fontWeight:700, padding:'0.45rem 1rem', borderRadius:6, cursor:page === totalPages ? 'default' : 'pointer', border:'1px solid rgba(10,35,66,0.15)', background:'transparent', color:page === totalPages ? 'rgba(10,35,66,0.2)' : 'rgba(10,35,66,0.6)' }}>
              Next →
            </button>
          </div>
        )}

        <div style={{ marginTop:'1.5rem', textAlign:'center', padding:'0.75rem', background:'rgba(212,175,55,0.05)', border:'1px solid rgba(212,175,55,0.2)', borderRadius:8 }}>
          <p style={{ fontFamily:"'Montserrat', sans-serif", fontSize:'0.6rem', color:'rgba(212,175,55,0.7)', margin:0 }}>
            Community Connections Growth and Development with the DRU AI Leadership Ecosystem™ · DRU AI Consulting © 2026
          </p>
        </div>

        <footer style={{ textAlign:'center', padding:'1rem 0 0.5rem', color:'rgba(10,35,66,0.3)', fontFamily:"'Montserrat', sans-serif", fontSize:'0.6rem' }}>
          © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
        </footer>
      </main>
    </AdminLayout>
  );
}

