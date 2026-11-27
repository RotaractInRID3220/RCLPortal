// Browser-side helpers for the registration API. All rules (window, cutoff, gender, category,
// capacity, per-player limits, RI number) are enforced on the server: this layer only sends the
// request and returns the server's answer. Players are identified by `member_id` (RMIS table id).

async function readJson(response) {
    try { return await response.json() } catch { return null }
}

/**
 * Register a player for a sport. The club always comes from the signed-in session.
 * @param {{member_id:number}} member - a member from /api/portal/members
 * @param {number} sport_id
 * @param {boolean} isMainPlayer - false = reserve
 * @param {string|null} riId - RI number typed by the club (required for general members)
 * @returns {Promise<{success:boolean,data?:object,error?:string,code?:string}>}
 */
export const registerPlayer = async (member, sport_id, isMainPlayer, riId = null) => {
    try {
        const response = await fetch('/api/registrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id: member.member_id, sport_id, main_player: Boolean(isMainPlayer), ri_id: riId || null }),
        });
        const body = await readJson(response);
        if (!response.ok || !body?.success) {
            return { success: false, error: body?.error || 'Failed to register player', code: body?.code, statusCode: response.status };
        }
        return { success: true, data: body.data };
    } catch (error) {
        console.error('Error registering player:', error);
        return { success: false, error: 'Network error. Please try again.', isException: true };
    }
}

/**
 * Registrations of the signed-in club (admins may pass club_id).
 * @param {{club_id?:number, sport_id?:number, member_id?:number}|null} filters
 */
export const getRegistrations = async (filters = null) => {
    const params = new URLSearchParams();
    for (const key of ['club_id', 'sport_id', 'member_id']) {
        if (filters?.[key] != null && filters[key] !== '') params.set(key, String(filters[key]));
    }
    const url = params.toString() ? `/api/registrations?${params}` : '/api/registrations';
    const response = await fetch(url);
    const body = await readJson(response);
    if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'Failed to fetch registrations');
    }
    return body;
}

/** Remove a registration (own club, while registration is open). */
export const deleteRegistration = async (member_id, sport_id) => {
    if (!member_id || !sport_id) throw new Error('member_id and sport_id are required for deletion');
    const response = await fetch(
        `/api/registrations?member_id=${encodeURIComponent(member_id)}&sport_id=${encodeURIComponent(sport_id)}`,
        { method: 'DELETE' }
    );
    const body = await readJson(response);
    if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'Failed to delete registration');
    }
    return body;
}

/** Everything matching the filters, fetched in pages of 200 (the server never returns more per call). */
export const getAllRegistrationsWithPlayerData = async (filters = null) => {
    const rows = [];
    let page = 1, totalPages = 1, total = 0;
    do {
        const res = await getRegistrationsWithPlayerData(filters, { page, limit: 200 });
        rows.push(...res.data.map(toAdminRow));
        totalPages = res.totalPages; total = res.total; page++;
    } while (page <= totalPages && page <= 100);
    return { success: true, data: rows, totalCount: total, count: rows.length };
}

// The admin list component reads nested `players` / `clubs`; build them from the flat API row.
const toAdminRow = (r) => ({
    ...r,
    players: { member_id: r.member_id, membership_id: r.membership_id, name: r.player_name, nic: r.nic, birthdate: r.birthdate,
               gender: r.gender, status: r.player_status, ri_id: r.ri_id, converted: r.converted },
    clubs: { club_name: r.club_name },
    sports: { sport_name: r.sport_name, sport_day: r.sport_day, sport_type: r.sport_type, gender_type: r.gender_type },
});

/** Admin list with server-side paging and search. */
export const getRegistrationsWithPlayerData = async (filters = null, pagination = null) => {
    const params = new URLSearchParams();
    if (pagination?.page) params.set('page', String(pagination.page));
    if (pagination?.limit) params.set('limit', String(pagination.limit));
    for (const key of ['sport_id', 'club_id', 'search']) {
        if (filters?.[key] != null && filters[key] !== '') params.set(key, String(filters[key]));
    }
    const response = await fetch(`/api/registrations/with-players?${params}`);
    const body = await readJson(response);
    if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'Failed to fetch registrations');
    }
    return body;
}

/** Admin: convert a general player to prospective (marks the player as converted). */
export const convertPlayer = async (member_id) => {
    const response = await fetch('/api/players', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id }),
    });
    const body = await readJson(response);
    if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'Failed to convert player');
    }
    return body;
}
