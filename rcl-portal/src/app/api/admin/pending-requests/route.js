import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// Fetches count of pending replacement requests for admin dashboard
export async function GET() {
  try {
    // For now, we'll return a mock count since replacement requests table structure isn't clear
    // This can be updated when the actual replacement requests functionality is implemented
    const pendingCount = 10; // Mock data as shown in Figma
    
    return NextResponse.json({
      success: true,
      data: {
        pendingCount
      }
    });

  } catch (error) {
    console.error('Unexpected error in pending requests:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}