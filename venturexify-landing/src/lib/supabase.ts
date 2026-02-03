import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxbbmwebqjpxvpgzcyph.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YmJtd2VicWpweHZwZ3pjeXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMDUyOTYsImV4cCI6MjA4Mzg4MTI5Nn0.GyE2jR3G8zONJQ5ovnt8vNpgYGt860SClejlqP-SBZ0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface WaitlistEntry {
  id?: string;
  email: string;
  first_name?: string;
  reddit_username?: string;
  referral_source?: string;
  feature_interests?: string[];
  queue_position?: number;
  status?: 'waitlisted' | 'invited' | 'activated' | 'active';
  created_at?: string;
}

export interface JoinWaitlistResult {
  success: boolean;
  position?: number;
  error?: string;
}

export async function joinWaitlist(data: {
  email: string;
  first_name?: string;
  reddit_username?: string;
  referral_source?: string;
  feature_interests?: string[];
}): Promise<JoinWaitlistResult> {
  try {
    // Check if email already exists
    const { data: existing } = await supabase
      .from('waitlist')
      .select('id, queue_position, status')
      .eq('email', data.email.toLowerCase())
      .single();

    if (existing) {
      return {
        success: true,
        position: existing.queue_position,
        error: 'already_registered',
      };
    }

    // Insert new waitlist entry
    const { data: newEntry, error } = await supabase
      .from('waitlist')
      .insert({
        email: data.email.toLowerCase(),
        first_name: data.first_name,
        reddit_username: data.reddit_username,
        referral_source: data.referral_source || 'landing_page',
        feature_interests: data.feature_interests,
        status: 'waitlisted',
      })
      .select('queue_position')
      .single();

    if (error) {
      console.error('Waitlist insert error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      position: newEntry?.queue_position,
    };
  } catch (err) {
    console.error('Waitlist error:', err);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getWaitlistCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Waitlist count error:', error);
      return 500; // Fallback number for display
    }

    return count || 0;
  } catch {
    return 500;
  }
}

export async function getWaitlistStats() {
  try {
    const { count: totalCount } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    const { count: activatedCount } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'activated');

    return {
      total: totalCount || 0,
      activated: activatedCount || 0,
    };
  } catch {
    return { total: 500, activated: 0 };
  }
}
