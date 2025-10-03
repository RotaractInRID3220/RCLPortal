import { NextResponse } from "next/server";
import { createHash } from "crypto";

export async function POST(request) {
    try {
        const { email, password, loginType } = await request.json();

        if (!email || !password || !loginType) {
            return NextResponse.json({ 
                success: false, 
                error: "Email, password, and login type are required" 
            }, { status: 400 });
        }

        // Call your existing authentication API
        const sql = 'SELECT * FROM club_membership_data WHERE m_username = ? LIMIT 1';
        
        const res = await fetch('https://info.rotaract3220.org/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.NEXT_PUBLIC_DBMID_API_KEY,
            },
            body: JSON.stringify({
                sql,
                params: [email],
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            console.error('API Error:', data.error);
            return NextResponse.json({ 
                success: false, 
                error: "Authentication service error" 
            }, { status: 500 });
        }

        const users = data.results || [];
        if (users.length === 0) {
            return NextResponse.json({ 
                success: false, 
                error: "User not found" 
            }, { status: 401 });
        }

        const user = users[0];
        
        // Verify password
        const inputHash = createHash('md5').update(password).digest('hex');
        const storedHash = (user.m_password || '').toLowerCase();
        if (storedHash !== inputHash.toLowerCase()) {
            return NextResponse.json({ 
                success: false, 
                error: "Invalid password" 
            }, { status: 401 });
        }

        // Check role-based access
        const roleId = user.role_id;
        
        // Admin access: role_id should be in [1,2,3,4]
        if (loginType === 'admin' && ![1,2,3,4].includes(roleId)) {
            return NextResponse.json({ 
                success: false, 
                error: "You do not have admin access permissions" 
            }, { status: 403 });
        }
        
        // Portal access: role_id should be in [1,2,3,4,5,6]
        if (loginType === 'portal' && ![1,2,3,4,5,6].includes(roleId)) {
            return NextResponse.json({ 
                success: false, 
                error: "You do not have portal access permissions" 
            }, { status: 403 });
        }

        // Remove sensitive data
        const { m_password, ...safeUser } = user;
        
        return NextResponse.json({ 
            success: true, 
            user: {
                id: safeUser.id || safeUser.m_id,
                email: safeUser.m_username,
                name: safeUser.card_name || safeUser.m_name,
                role_id: safeUser.role_id,
                loginType: loginType,
                userDeets: safeUser
            }
        }, { status: 200 });

    } catch (error) {
        console.error('Authentication error:', error);
        return NextResponse.json({ 
            success: false, 
            error: "Authentication failed" 
        }, { status: 500 });
    }
}