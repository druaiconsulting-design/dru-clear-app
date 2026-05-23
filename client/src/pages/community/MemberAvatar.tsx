// =============================================================================
// MEMBER AVATAR
// =============================================================================
export default function MemberAvatar({
  firstName, photoUrl, size = 32,
}: {
  firstName: string; photoUrl?: string; size?: number;
}) {
  const initials  = firstName ? firstName.charAt(0).toUpperCase() : '?';
  const bgColors  = ['#0A2342','#B8941F','#9B0D44','#1a6b3c','#4a3580'];
  const bg        = bgColors[(firstName.charCodeAt(0) || 0) % bgColors.length];

  if (photoUrl) {
    return (
      <img
        src={photoUrl} alt={firstName}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #E8E4DF' }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: `${Math.round(size * 0.38)}px`, fontWeight: '700', color: '#fff' }}>
        {initials}
      </span>
    </div>
  );
}
