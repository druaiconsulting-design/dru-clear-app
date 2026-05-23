import { useState, useEffect, useRef } from 'react';
import { supabase, formatDate } from './types';
import type { CommunityNotification, NotificationPreferences, NotifType } from './types';
import MemberAvatar from './MemberAvatar';

// =============================================================================
// NOTIFICATION BELL
// =============================================================================
export function NotificationBell({
  userId, userFirstName, userPhotoUrl, onOpenSettings,
}: {
  userId: string; userFirstName: string; userPhotoUrl?: string; onOpenSettings: () => void;
}) {
  const [panelOpen, setPanelOpen]         = useState(false);
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [unread, setUnread]               = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from('community_notifications').select('*').eq('recipient_id', userId)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => {
        const notifs = (data ?? []) as CommunityNotification[];
        setNotifications(notifs);
        setUnread(notifs.filter(n => !n.is_read).length);
      });
    const channel = supabase.channel(`notif_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_notifications', filter: `recipient_id=eq.${userId}` }, (payload) => {
        const n = payload.new as CommunityNotification;
        setNotifications(prev => [n, ...prev]);
        setUnread(c => c + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false);
    };
    if (panelOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [panelOpen]);

  const markAllRead = async () => {
    await supabase.from('community_notifications').update({ is_read: true }).eq('recipient_id', userId).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const notifIcon: Record<NotifType, string> = { mention: '@', reply: '↪', new_post: '◆', new_agent_post: '◆' };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }} ref={panelRef}>
      <button
        onClick={() => { setPanelOpen(!panelOpen); if (!panelOpen && unread > 0) markAllRead(); }}
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(10,35,66,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: '0', right: '0', background: '#C2185B', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: '700' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Avatar — opens settings */}
      <button onClick={onOpenSettings} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', borderRadius: '50%' }}>
        <MemberAvatar firstName={userFirstName} photoUrl={userPhotoUrl} size={44} />
      </button>

      {panelOpen && (
        <div style={{ position: 'absolute', top: '54px', right: '0', width: '320px', background: '#fff', border: '1px solid #E8E4DF', borderRadius: '12px', boxShadow: '0 8px 32px rgba(10,35,66,0.12)', zIndex: 100, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'Cinzel', serif", fontSize: '13px', fontWeight: '600', color: '#0A2342', letterSpacing: '0.5px' }}>Notifications</span>
            {notifications.some(n => !n.is_read) && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: '#B8941F', fontWeight: '600' }}>Mark all read</button>
            )}
          </div>
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(10,35,66,0.35)', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontStyle: 'italic' }}>No notifications yet</div>
            ) : notifications.map(n => (
              <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F8F6F3', display: 'flex', alignItems: 'flex-start', gap: '10px', background: n.is_read ? '#fff' : '#FFFBEE' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: n.is_read ? '#F0EDE8' : '#F0D980', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '700', color: n.is_read ? 'rgba(10,35,66,0.4)' : '#7A5C00' }}>
                  {notifIcon[n.type] ?? '◆'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: 'rgba(10,35,66,0.8)', lineHeight: '1.5', margin: '0 0 3px' }}>{n.message}</p>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.35)', margin: 0 }}>{formatDate(n.created_at)}</p>
                </div>
                {!n.is_read && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C2185B', flexShrink: 0, marginTop: '6px' }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SETTINGS PANEL
// =============================================================================
export function SettingsPanel({
  userId, userFirstName, userPhotoUrl, onClose, onPhotoUpdate,
}: {
  userId: string; userFirstName: string; userPhotoUrl?: string;
  onClose: () => void; onPhotoUpdate: (url: string) => void;
}) {
  const [tab, setTab]             = useState<'profile' | 'notifications'>('profile');
  const [prefs, setPrefs]         = useState<NotificationPreferences | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('notification_preferences').select('*').eq('user_id', userId).single()
      .then(({ data }) => { if (data) setPrefs(data as NotificationPreferences); });
    if ('Notification' in window) setPushEnabled(Notification.permission === 'granted');
  }, [userId]);

  const togglePref = async (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    await supabase.from('notification_preferences').update({ [key]: !prefs[key] }).eq('user_id', userId);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    const ext  = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ photo_url: url }).eq('id', userId);
      onPhotoUpdate(url);
    }
    setUploading(false);
  };

  const prefGroups: { key: string; label: string; push: keyof NotificationPreferences; inapp: keyof NotificationPreferences; email: keyof NotificationPreferences }[] = [
    { key: 'mention',        label: '@Mentions',      push: 'mention_push',        inapp: 'mention_inapp',        email: 'mention_email' },
    { key: 'reply',          label: 'Thread replies', push: 'reply_push',          inapp: 'reply_inapp',          email: 'reply_email' },
    { key: 'new_agent_post', label: 'Agent posts',    push: 'new_agent_post_push', inapp: 'new_agent_post_inapp', email: 'new_agent_post_email' },
    { key: 'new_post',       label: 'New posts',      push: 'new_post_push',       inapp: 'new_post_inapp',       email: 'new_post_email' },
  ];

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{ width: '36px', height: '20px', borderRadius: '10px', background: on ? '#0A2342' : '#E8E4DF', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,35,66,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '80px 24px 0 0' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '340px', background: '#fff', borderRadius: '14px', border: '1px solid #E8E4DF', boxShadow: '0 16px 48px rgba(10,35,66,0.15)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'Cinzel', serif", fontSize: '13px', fontWeight: '600', color: '#0A2342', letterSpacing: '0.5px' }}>Settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(10,35,66,0.4)', fontSize: '16px', padding: '0' }}>✕</button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid #F0EDE8' }}>
          {(['profile', 'notifications'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? '#0A2342' : 'transparent'}`, fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: tab === t ? '#0A2342' : 'rgba(10,35,66,0.4)', cursor: 'pointer', textTransform: 'capitalize', letterSpacing: '0.3px', transition: 'all 0.15s' }}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div style={{ padding: '20px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <MemberAvatar firstName={userFirstName} photoUrl={userPhotoUrl} size={72} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: '15px', fontWeight: '600', color: '#0A2342', marginBottom: '4px' }}>{userFirstName}</p>
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.4)' }}>Community Member</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                style={{ background: 'transparent', border: '1.5px solid #0A2342', borderRadius: '8px', padding: '9px 20px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '700', color: '#0A2342', cursor: uploading ? 'default' : 'pointer', letterSpacing: '0.5px', opacity: uploading ? 0.5 : 1 }}>
                {uploading ? 'Uploading...' : userPhotoUrl ? 'Change Photo' : 'Upload Photo'}
              </button>
            </div>
          </div>
        )}

        {tab === 'notifications' && prefs && (
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F0EDE8', marginBottom: '4px' }}>
              <div>
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '700', color: '#0A2342', margin: '0 0 2px' }}>Push notifications</p>
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.4)', margin: 0 }}>{pushEnabled ? 'Enabled on this device' : 'Not enabled'}</p>
              </div>
              {!pushEnabled && (
                <button onClick={async () => { const perm = await Notification.requestPermission(); if (perm === 'granted') setPushEnabled(true); }}
                  style={{ background: '#0A2342', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Enable</button>
              )}
            </div>
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: '6px', paddingLeft: '120px' }}>
                {['Push', 'In-App', 'Email'].map(l => (
                  <span key={l} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: '700', color: 'rgba(10,35,66,0.4)', textAlign: 'center', letterSpacing: '0.5px' }}>{l.toUpperCase()}</span>
                ))}
              </div>
              {prefGroups.map(group => (
                <div key={group.key} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F8F6F3' }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: '#0A2342', width: '120px', flexShrink: 0 }}>{group.label}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><Toggle on={prefs[group.push]} onClick={() => togglePref(group.push)} /></div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><Toggle on={prefs[group.inapp]} onClick={() => togglePref(group.inapp)} /></div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><Toggle on={prefs[group.email]} onClick={() => togglePref(group.email)} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
