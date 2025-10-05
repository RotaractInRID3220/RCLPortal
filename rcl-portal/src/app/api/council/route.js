import { NextResponse } from "next/server";
import { createHash } from "crypto";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const username = searchParams.get("username");
        const password = searchParams.get("password");
        const clubID = searchParams.get("clubID");

        // Handle club members request
        if (clubID) {
            // Get cutoff datetime from environment variable, default to current time if not set
            const cutoffDate = process.env.NEXT_PUBLIC_MEMBERSHIP_CUTOFF_DATE ? new Date(process.env.NEXT_PUBLIC_MEMBERSHIP_CUTOFF_DATE) : new Date();
            
            // Format date to match database format: YYYY-MM-DD HH:mm:ss
            const membershipCutoffDate = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');
            
            console.log('Using membership cutoff date:', membershipCutoffDate);
            console.log('Fetching members for club ID:', clubID);
            
            const sql = 'SELECT * FROM club_membership_data WHERE club_id = ? AND status IN (1,3, 5) AND created_datetime <= ?';

            const res = await fetch('https://info.rotaract3220.org/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.NEXT_PUBLIC_DBMID_API_KEY,
                },
                body: JSON.stringify({
                    sql,
                    params: [clubID, membershipCutoffDate],
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'API Error');
            }

            const clubMembers = data.results || [];

            // console.log(`Fetched ${clubMembers.length} members for club ${clubID}:`, clubMembers);

            // Remove sensitive fields like m_password from all members and normalize status
            const safeMembers = clubMembers.map(({ m_password, status, ...safeMember }) => ({
                ...safeMember,
                status: status === 3 ? 1 : status // Replace status 3 with 1
            }));

            return NextResponse.json({ 
                success: true, 
                members: safeMembers,
                count: safeMembers.length,
                clubID: clubID
            }, { status: 200 });
        }

        // Handle user authentication request (existing logic)
        if (!username) {
            return NextResponse.json({ error: "Username is required" }, { status: 400 });
        }

        const sql = 'SELECT * FROM club_membership_data WHERE m_username = ? LIMIT 1';

        const res = await fetch('https://info.rotaract3220.org/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.NEXT_PUBLIC_DBMID_API_KEY,
            },
            body: JSON.stringify({
                sql,
                params: [username],
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'API Error');
        }

        const users = data.results || [];

        console.log('Fetched users:', users);

        if (users.length === 0) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (!password) {
            return NextResponse.json({ error: "Password is required" }, { status: 400 });
        }

        // Hash the incoming password with MD5 and compare (case-insensitive) to stored hash
        const inputHash = createHash('md5').update(password).digest('hex');
        const storedHash = (users[0].m_password || '').toLowerCase();
        if (storedHash !== inputHash.toLowerCase()) {
            return NextResponse.json({ authorized: false, error: "Invalid password" }, { status: 401 });
        }

        // Omit sensitive fields like m_password from the response
        const { m_password, ...safeUser } = users[0];
        return NextResponse.json({ authorized: true, user: safeUser }, { status: 200 });

    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }
}