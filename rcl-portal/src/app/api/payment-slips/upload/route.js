import { supabase } from '../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const club_id = formData.get('club_id');

        if (!file || !club_id) {
            return NextResponse.json({ 
                error: 'Missing required fields: file and club_id' 
            }, { status: 400 });
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ 
                error: 'Invalid file type. Only images are allowed.' 
            }, { status: 400 });
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ 
                error: 'File size too large. Maximum size is 5MB.' 
            }, { status: 400 });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const fileName = `${club_id}/${timestamp}.${fileExtension}`;

        // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('payment-slips')
            .upload(fileName, buffer, {
                contentType: file.type,
                cacheControl: '3600'
            });

        if (error) {
            console.error('Storage upload error:', error);
            return NextResponse.json({ 
                error: 'Failed to upload image to storage' 
            }, { status: 500 });
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from('payment-slips')
            .getPublicUrl(fileName);

        return NextResponse.json({ 
            success: true, 
            publicUrl: publicUrlData.publicUrl,
            path: fileName
        });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ 
            error: 'Internal server error during upload' 
        }, { status: 500 });
    }
}
