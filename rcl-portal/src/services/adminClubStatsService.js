// Registered/total clubs per category (a club is "registered" once it has a player).
// One server-side aggregate; nothing is cached in the browser.
export async function getRegisteredClubStats() {
  const response = await fetch('/api/admin/dashboard-stats', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to fetch club stats');
  return result.data.registeredClubs;
}
