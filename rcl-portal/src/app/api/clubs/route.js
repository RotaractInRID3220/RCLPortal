import { supabase } from '../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .order('club_name', { ascending: true });

    if (error) {
      console.error('Error fetching clubs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch clubs' },
        { status: 500 }
      );
    }

    return NextResponse.json({ clubs: data || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { club_id, club_name, category } = body;

    // Validate required fields
    if (!club_id || !club_name || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: club_id, club_name, category' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('clubs')
      .insert([{ club_id, club_name, category }])
      .select();

    if (error) {
      console.error('Error creating club:', error);
      return NextResponse.json(
        { error: 'Failed to create club' },
        { status: 500 }
      );
    }

    return NextResponse.json({ club: data[0] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, club_id, club_name, category } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updateData = {};
    if (club_id !== undefined) updateData.club_id = club_id;
    if (club_name !== undefined) updateData.club_name = club_name;
    if (category !== undefined) updateData.category = category;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('clubs')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating club:', error);
      return NextResponse.json(
        { error: 'Failed to update club' },
        { status: 500 }
      );
    }

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Club not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ club: data[0] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
