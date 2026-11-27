'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bell, CheckCheck } from 'lucide-react';

// Live announcements for every portal/admin user: sent by admins, plus automated deadline reminders.
// New ones arrive instantly over a server-sent-events stream (polling every 30 s if the stream is
// unavailable). Unread ones are marked until the user opens them or presses "Mark all read".
const when = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

export default function AnnouncementsCard({ showNames = false }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(null);
  const knownIds = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(showNames ? '/api/announcements?names=1' : '/api/announcements', { cache: 'no-store' });
      const body = await res.json();
      if (!body.success) return;
      if (knownIds.current) {
        const fresh = body.data.filter((a) => !knownIds.current.has(a.id) && !a.read);
        if (fresh.length) toast.info(fresh.length === 1 ? fresh[0].title : `${fresh.length} new announcements`, { duration: 6000 });
      }
      knownIds.current = new Set(body.data.map((a) => a.id));
      setItems(body.data);
      setUnread(body.unread);
    } finally {
      setLoaded(true);
    }
  }, [showNames]);

  useEffect(() => {
    load();
    let poll = setInterval(load, 30000);
    let es = null;
    if (typeof EventSource !== 'undefined') {
      es = new EventSource('/api/announcements/stream');
      es.addEventListener('changed', load);
      es.addEventListener('ready', () => { clearInterval(poll); poll = setInterval(load, 120000); });  // the stream is live: poll only as a safety net
    }
    return () => { clearInterval(poll); es?.close(); };
  }, [load]);

  const markRead = async (ids) => {
    setItems((list) => list.map((a) => (!ids || ids.includes(a.id) ? { ...a, read: true } : a)));
    setUnread((n) => (ids ? Math.max(0, n - ids.length) : 0));
    await fetch('/api/announcements/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ids ? { ids } : {}) }).catch(() => {});
  };

  const toggle = (a) => {
    setOpen((cur) => (cur === a.id ? null : a.id));
    if (!a.read) markRead([a.id]);
  };

  return (
    <div className="bg-cranberry/10 border border-cranberry rounded-lg max-h-[700px] min-h-[420px] overflow-y-hidden">
      <div className="p-6">
        <div className="relative mb-6">
          <h2 className="text-xl font-normal text-cranberry text-center">Announcements</h2>
          {unread > 0 && (
            <span className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full bg-cranberry px-2 py-0.5 text-xs text-white">
              <Bell className="h-3 w-3" /> {unread} new
            </span>
          )}
        </div>

        {unread > 0 && (
          <button onClick={() => markRead(null)} className="mb-3 flex cursor-pointer items-center gap-1 text-xs text-white/60 hover:text-white">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}

        <div className="space-y-4 max-h-[560px] overflow-y-auto hide-scrollbar">
          {items.map((a) => {
            const long = a.body.length > 150;
            const expanded = open === a.id;
            return (
              <div key={a.id} onClick={() => toggle(a)} className={`cursor-pointer rounded-lg p-4 ${a.read ? 'bg-black/50' : 'bg-black/70 ring-1 ring-cranberry/60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-white font-semibold text-sm mb-2">{a.title}</h3>
                  {!a.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cranberry" aria-label="unread" />}
                </div>
                {a.body && (
                  <p className="text-white text-sm leading-relaxed mb-3 whitespace-pre-line">
                    {expanded || !long ? a.body : `${a.body.slice(0, 150)}...`}
                  </p>
                )}
                <div className="text-white/50 text-xs">
                  {a.kind === 'auto' ? 'Automated reminder' : a.author_name || `By ${a.sent_as}`} · {when(a.created_at)}
                </div>
              </div>
            );
          })}
        </div>

        {loaded && items.length === 0 && <div className="text-center text-white/50 py-8">No announcements right now</div>}
      </div>
    </div>
  );
}
