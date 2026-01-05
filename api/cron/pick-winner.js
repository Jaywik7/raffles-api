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
      
      if (!rpcError && winner) {
        try {
          // Fetch full raffle data and entry count for Discord
          const { data: fullRaffle } = await supabase
            .from('raffles')
            .select('*')
            .eq('id', raffle.id)
            .single();

          const { count: participantCount } = await supabase
            .from('entries')
            .select('*', { count: 'exact', head: true })
            .eq('raffle_id', raffle.id);

          // Send Discord Webhook
          const MICROS_COLORS = [0xFFC0F5, 0x00E3FA, 0x5CFCA9, 0xFFD55F, 0xFF9161];
          const WEBHOOK_URL = 'https://discord.com/api/webhooks/1446887414910943242/KeOlEdoTT_pibsQ7Q4Hl5DMESD7PV6N-ZQMVet6A9vV8gUWqLvCSWHZzZyUmko68oR1W';
          const SITE_URL = "https://raffles.microsnft.xyz";

          const embed = {
            title: `🏁 RAFFLE ENDED: ${fullRaffle.name}`,
            url: SITE_URL,
            color: MICROS_COLORS[2], // Green
            timestamp: new Date().toISOString(),
            footer: { text: "Micros Raffles", icon_url: "https://raffles.microsnft.xyz/assets/micros.png" },
            thumbnail: { url: fullRaffle.image_url },
            fields: [
              { name: "👑 Winner", value: `[${winner.slice(0, 8)}...${winner.slice(-8)}](https://solscan.io/account/${winner})`, inline: false },
              { name: "👥 Participants", value: `${participantCount || 0}`, inline: true },
              { name: "🎫 Tickets Sold", value: `${fullRaffle.ticket_sold}/${fullRaffle.ticket_supply}`, inline: true },
              { name: "🎁 Prize Info", value: `• ${fullRaffle.name}${fullRaffle.prize_token_mint ? `\n• ${fullRaffle.prize_token_amount.toLocaleString()} ${fullRaffle.prize_token_symbol}` : ''}`, inline: false }
            ]
          };

          await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
          });
        } catch (discordErr) {
          console.error("Discord Cron Webhook Error:", discordErr);
        }
      }
      
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
