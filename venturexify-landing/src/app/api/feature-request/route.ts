import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { suggestion } = await request.json();

    if (!suggestion || typeof suggestion !== 'string' || suggestion.trim().length === 0) {
      return NextResponse.json({ error: 'Suggestion is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // If Supabase isn't configured, just log and return success
      console.log('Feature request (no Supabase):', suggestion.trim());
      return NextResponse.json({ success: true, fallback: true });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('feature_requests')
      .insert({ suggestion: suggestion.trim() });

    if (error) {
      console.error('Supabase insert error:', error);
      // Still return success to user — don't expose backend errors
      return NextResponse.json({ success: true, fallback: true });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Feature request error:', err);
    return NextResponse.json({ success: true, fallback: true });
  }
}
