// Check-in switch ("portal status"), stored in the settings table (`checkin.open`).
// No Realtime: pages poll, so every browser sees the change within a few seconds.

/** @returns {Promise<{isOpen: boolean, updatedBy: number|null, updatedAt: string|null}>} */
export const getPortalStatus = async () => {
  const response = await fetch('/api/config/portal-status', { cache: 'no-store' });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to fetch portal status');
  return result.data;
};

/** Open or close check-in (administrator level). `updatedBy` is ignored: the server uses the session. */
export const updatePortalStatus = async (isOpen) => {
  const response = await fetch('/api/config/portal-status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isOpen }),
  });
  return response.json();
};

/**
 * Real-time check-in status: server-sent events (the server pushes the moment an admin opens/closes
 * check-in or changes the day). If the stream cannot be opened or drops, falls back to polling every
 * 5 s until it reconnects. Calls back only when the open/day state actually changed. Returns an unsubscribe.
 */
export const subscribeToPortalStatus = (callback) => {
  let last = null; // "open|day"
  let es = null, poll = null, stopped = false;
  const handle = (s) => {
    const key = `${s.isOpen}|${s.currentDay ?? ''}`;
    if (last !== null && key !== last) callback(s);
    last = key;
  };
  const startPolling = () => {
    if (poll || stopped) return;
    poll = setInterval(async () => { try { handle(await getPortalStatus()); } catch { /* keep last state */ } }, 5000);
  };
  const stopPolling = () => { if (poll) { clearInterval(poll); poll = null; } };

  if (typeof EventSource === 'undefined') {
    startPolling();
  } else {
    es = new EventSource('/api/config/portal-status/stream');
    es.addEventListener('status', (e) => { stopPolling(); try { handle(JSON.parse(e.data)); } catch { /* ignore a bad frame */ } });
    es.onerror = () => startPolling();   // EventSource reconnects by itself; polling covers the gap
  }
  return () => { stopped = true; es?.close(); stopPolling(); };
};
