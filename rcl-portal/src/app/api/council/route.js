import { NextResponse } from "next/server";
import { createHash } from "crypto";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const username = searchParams.get("username");
        const password = searchParams.get("password");


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