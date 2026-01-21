// src/app/api/config/portal-status/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET - Fetch current portal status
 * Returns the registration portal open/close status
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('portal_settings')
      .select('*')
      .eq('setting_key', 'registration_portal_open')
      .single();

    if (error) {
      // If no record exists, return default closed state
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          data: {
            isOpen: false,
            updatedBy: null,
            updatedAt: null,
            message: 'Registration portal is currently closed'
          }
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        isOpen: data.is_enabled,
        updatedBy: data.updated_by,
        updatedAt: data.updated_at,
        message: data.is_enabled 
          ? 'Registration portal is open' 
          : 'Registration portal is currently closed'
      }
    });

  } catch (error) {
    console.error('Error fetching portal status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch portal status' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update portal status (super_admin only)
 * Requires authentication and super_admin permission
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { isOpen, updatedBy } = body;

    if (typeof isOpen !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isOpen must be a boolean value' },
        { status: 400 }
      );
    }

    if (!updatedBy) {
      return NextResponse.json(
        { success: false, error: 'updatedBy is required' },
        { status: 400 }
      );
    }

    // Upsert the portal status
    const { data, error } = await supabase
      .from('portal_settings')
      .upsert({
        setting_key: 'registration_portal_open',
        is_enabled: isOpen,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'setting_key' 
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        isOpen: data.is_enabled,
        updatedBy: data.updated_by,
        updatedAt: data.updated_at,
        message: data.is_enabled 
          ? 'Registration portal has been opened' 
          : 'Registration portal has been closed'
      }
    });

  } catch (error) {
    console.error('Error updating portal status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update portal status' },
      { status: 500 }
    );
  }
}
