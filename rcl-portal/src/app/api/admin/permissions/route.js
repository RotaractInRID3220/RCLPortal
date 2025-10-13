import { NextResponse } from "next/server";
import { supabase } from '../../../../lib/supabaseClient.js';

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('permissions')
            .select('*');

        if (error) {
            throw error;
        }

        return NextResponse.json({ permissions: data }, { status: 200 });

    } catch (error) {
        console.error('Error fetching permissions:', error);
        return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { RMIS_ID, permission_level, card_name } = await request.json();

        if (!RMIS_ID || !permission_level) {
            return NextResponse.json({ error: "RMIS_ID and permission_level are required" }, { status: 400 });
        }

        if (!['super_admin', 'admin'].includes(permission_level)) {
            return NextResponse.json({ error: "Invalid permission_level" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('permissions')
            .upsert({ RMIS_ID, permission_level, card_name })
            .select();

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true, permission: data ? data[0] : { RMIS_ID, permission_level, card_name } }, { status: 200 });

    } catch (error) {
        console.error('Error adding permission:', error);
        return NextResponse.json({ error: 'Failed to add permission' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { RMIS_ID } = await request.json();

        if (!RMIS_ID) {
            return NextResponse.json({ error: "RMIS_ID is required" }, { status: 400 });
        }

        const { error } = await supabase
            .from('permissions')
            .delete()
            .eq('RMIS_ID', RMIS_ID);

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error) {
        console.error('Error removing permission:', error);
        return NextResponse.json({ error: 'Failed to remove permission' }, { status: 500 });
    }
}