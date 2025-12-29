import { createClient } from '@supabase/supabase-js';

// This function will be called by Vercel Cron
export default async function handler(req, res) {
  // Check for Vercel Cron Secret to ensure only Vercel can trigger this
  const authHeader = req.headers['authorization'];
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return res.status(500).json({ success: false, message: 'Missing environment variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    // 1. Find all expired raffles that are still 'active'
    const { data: expiredRaffles, error: fetchError } = await supabase
      .from('raffles')
      .select('id')
      .eq('status', 'active')
      .lt('ends_at', new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!expiredRaffles || expiredRaffles.length === 0) {
      return res.status(200).json({ success: true, message: 'No expired raffles to process' });
    }

    console.log(`Processing ${expiredRaffles.length} expired raffles...`);

    const results = [];
    for (const raffle of expiredRaffles) {
      // 2. Trigger the pick_raffle_winner RPC for each
      const { data: winner, error: rpcError } = await supabase.rpc('pick_raffle_winner', { 
        target_raffle_id: raffle.id 
      });
      
      results.push({ id: raffle.id, winner, error: rpcError });
    }

    return res.status(200).json({ 
      success: true, 
      processed: expiredRaffles.length, 
      results 
    });

  } catch (error) {
    console.error('Cron Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
