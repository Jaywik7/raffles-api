import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAGIC_EDEN_API_KEY = process.env.MAGIC_EDEN_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  // Set CORS headers for local development if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { raffleId, mintAddress } = req.body;

  if (!raffleId || !mintAddress) {
    return res.status(400).json({ error: 'Missing raffleId or mintAddress' });
  }

  try {
    console.log(`Fetching floor for mint: ${mintAddress}`);
    
    // 1. Get collection symbol from MagicEden
    const tokenRes = await fetch(`https://api-mainnet.magiceden.io/v2/tokens/${mintAddress}`, {
      headers: {
        'Authorization': `Bearer ${MAGIC_EDEN_API_KEY}`,
        'accept': 'application/json'
      }
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`MagicEden Token API error: ${tokenRes.status} - ${errText}`);
    }

    const tokenData = await tokenRes.json();
    const collectionSymbol = tokenData.collection;

    if (!collectionSymbol) {
      throw new Error(`No collection symbol found for mint ${mintAddress}`);
    }

    console.log(`Collection found: ${collectionSymbol}`);

    // 2. Get floor price for collection
    const statsRes = await fetch(`https://api-mainnet.magiceden.io/v2/collections/${collectionSymbol}/stats`, {
      headers: {
        'Authorization': `Bearer ${MAGIC_EDEN_API_KEY}`,
        'accept': 'application/json'
      }
    });

    if (!statsRes.ok) {
      const errText = await statsRes.text();
      throw new Error(`MagicEden Stats API error: ${statsRes.status} - ${errText}`);
    }

    const statsData = await statsRes.json();
    const floorPriceLamports = statsData.floorPrice;
    
    // Convert lamports (9 decimals) to SOL
    const floorPriceSOL = floorPriceLamports / 1_000_000_000;

    console.log(`Floor Price: ${floorPriceSOL} SOL`);

    // 3. Update Supabase
    const { error: dbError } = await supabase
      .from('raffles')
      .update({ floor_price: floorPriceSOL })
      .eq('id', raffleId);

    if (dbError) throw dbError;

    return res.status(200).json({ 
      success: true, 
      floorPrice: floorPriceSOL,
      collection: collectionSymbol 
    });

  } catch (error) {
    console.error('Error in fetch-floor:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

