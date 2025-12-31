import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from 'https://esm.sh/@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferCheckedInstruction } from 'https://esm.sh/@solana/spl-token';
import { useWallet, useConnection } from 'https://esm.sh/@solana/wallet-adapter-react?deps=react@18';
import { WalletMultiButton } from 'https://esm.sh/@solana/wallet-adapter-react-ui?deps=react@18';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import confetti from 'https://esm.sh/canvas-confetti';
import StaggeredMenu from './StaggeredMenu.js';
import { SolanaProvider } from './SolanaProvider.js';

const SUPABASE_URL = 'https://olzrecbpyoqbthuffmuj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lqylXbxVwhVVse47MCYXGg_VGicG04Q';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const RAFFLE_STAR_COLORS = ['#FFC0F5', '#00E3FA', '#5CFCA9', '#FFD55F', '#FF9161'];

function GalaxyBackground({ density = 0.00006 }) {
  const canvasRef = useRef(null);
  const starsRef = useRef([]);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const width = window.innerWidth || document.documentElement.clientWidth || 1024;
      const height = window.innerHeight || document.documentElement.clientHeight || 768;
      sizeRef.current = { w: width, h: height, dpr };
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      const baseCount = Math.floor(width * height * density);
      const count = Math.max(20, Math.min(110, Math.floor(baseCount * 0.5)));
      starsRef.current = new Array(count).fill(0).map(() => {
        const layer = Math.random() < 0.6 ? 1 : (Math.random() < 0.85 ? 2 : 3);
        const speed = (0.02 + Math.random() * 0.06) * layer;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r: (Math.random() * 1.6 + 0.8) * (layer === 1 ? 1.0 : layer === 2 ? 1.8 : 2.6),
          a: Math.random() * 0.5 + 0.4,
          hue: RAFFLE_STAR_COLORS[(Math.random() * RAFFLE_STAR_COLORS.length) | 0],
          vx: speed * (Math.random() < 0.5 ? -1 : 1),
          vy: speed * 0.3 * (Math.random() < 0.5 ? -1 : 1),
          tw: Math.random() * Math.PI * 2
        };
      });
    }

    function renderStatic() {
      const { w, h, dpr } = sizeRef.current;
      if (!w || !h) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(3,6,15,0.96)';
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.7, h * 0.2, Math.min(w, h) * 0.05, w * 0.5, h * 0.5, Math.max(w, h) * 0.9);
      g.addColorStop(0, 'rgba(124,58,237,0.35)');
      g.addColorStop(1, 'rgba(3,6,15,0.0)');
      ctx.fillStyle = g;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillRect(0, 0, w, h);
      for (const s of starsRef.current) {
        ctx.beginPath(); ctx.fillStyle = s.hue; ctx.globalAlpha = s.a;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    resize(); renderStatic();
    window.addEventListener('resize', () => { resize(); renderStatic(); });
    return () => { window.removeEventListener('resize', resize); };
  }, [density]);

  return React.createElement('canvas', { ref: canvasRef, className: 'raffle-galaxy', 'aria-hidden': 'true' });
}

function CountdownTimer({ endsAt, onEnd }) {
  const [timeLeft, setTimeLeft] = useState('');
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const end = new Date(endsAt).getTime();
      const now = new Date().getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('Ended');
        clearInterval(timer);
        
        // Trigger auto-refresh once when it hits zero
        if (onEnd && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          onEnd();
        }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${mins}m`);
      } else {
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endsAt]);

  return React.createElement('span', { className: 'countdown-value' }, timeLeft);
}

function WinnerModal({ raffle, onClose }) {
  useEffect(() => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10001 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return React.createElement('div', { className: 'nft-selection-modal-backdrop winner-backdrop', onClick: onClose },
    React.createElement('div', { className: 'nft-selection-modal winner-modal', onClick: e => e.stopPropagation() },
      React.createElement('div', { className: 'winner-modal-content' },
        React.createElement('div', { className: 'winner-crown' }, '👑'),
        React.createElement('h1', null, 'CONGRATULATIONS!'),
        React.createElement('p', { className: 'winner-sub' }, 'You just won'),
        React.createElement('div', { className: 'winner-prize-card' },
          React.createElement('img', { src: raffle.image, alt: raffle.name }),
          React.createElement('h3', null, raffle.name)
        ),
        React.createElement('p', { className: 'winner-instructions', style: { fontSize: '14px', margin: '15px 0', lineHeight: '1.5', opacity: '0.9', color: '#fff' } }, 
          'To claim your prize, you must join the Micros discord and open a 🎟️ support ticket.'
        ),
        React.createElement('a', { 
          href: 'https://discord.gg/qZHKN8ws9H', 
          target: '_blank', 
          rel: 'noopener noreferrer',
          className: 'raffle-btn-buy large',
          style: { textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
          onClick: onClose
        }, 'Claim Your Prize')
      )
    )
  );
}

function LiveActivityFeed({ activities }) {
  const [displayActivities, setDisplayActivities] = React.useState([]);
  const lastProcessedRef = React.useRef(new Set());

  React.useEffect(() => {
    // Only process new activities that we haven't seen in this session
    const newItems = activities.filter(act => {
      const key = `${act.wallet}-${act.raffleName}-${act.quantity}`;
      if (!lastProcessedRef.current.has(key)) {
        lastProcessedRef.current.add(key);
        return true;
      }
      return false;
    });

    if (newItems.length > 0) {
      // Add new items to the display queue
      const now = Date.now();
      const itemsToAdd = newItems.map(item => ({ ...item, id: now + Math.random(), timestamp: now }));
      
      setDisplayActivities(prev => [...prev, ...itemsToAdd]);

      // Remove each item after 5 seconds
      itemsToAdd.forEach(item => {
        setTimeout(() => {
          setDisplayActivities(prev => prev.filter(a => a.id !== item.id));
        }, 5000);
      });
    }
  }, [activities]);

  if (displayActivities.length === 0) return null;

  return React.createElement('div', { className: 'live-activity-toast-container' },
    displayActivities.map((act) => (
      React.createElement('div', { key: act.id, className: 'activity-toast' },
        React.createElement('div', { className: 'activity-header' },
          React.createElement('span', { className: 'activity-dot' }),
          'Live Activity'
        ),
        React.createElement('div', { className: 'activity-item' },
          React.createElement('span', { className: 'activity-wallet' }, act.wallet.slice(0, 4) + '...' + act.wallet.slice(-4)),
          ' bought ',
          React.createElement('span', { className: 'activity-count' }, `${act.quantity} ticket${act.quantity > 1 ? 's' : ''}`),
          ' for ',
          React.createElement('span', { className: 'activity-raffle' }, act.raffleName)
        )
      )
    ))
  );
}

function RaffleAppInner() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [activeTab, setActiveTab] = useState('Active Raffles');
  const [scrolled, setScrolled] = useState(false);
  const [balance, setBalance] = useState(0);
  const [ntzBalance, setNtzBalance] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [walletNfts, setWalletNfts] = useState([]);
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);
  const [showNftModal, setShowNftModal] = useState(false);
  const [selectedNft, setSelectedNft] = useState(null);
  const [nftCollectionGroups, setNftCollectionGroups] = useState([]);
  const [selectedCollectionName, setSelectedCollectionName] = useState(null);
  const [tokenAmount, setTokenAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [walletTokens, setWalletTokens] = useState([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [ticketSupply, setTicketSupply] = useState('3');
  const [ticketPrice, setTicketPrice] = useState('');
  const [ticketLimit, setTicketLimit] = useState('1');
  const [verifiedFilter, setVerifiedFilter] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [collections, setCollections] = useState(['']);
  const [buyQuantities, setBuyQuantities] = useState({});
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [notification, setNotification] = useState(null);
  const [userPurchasedCounts, setUserPurchasedCounts] = useState({}); // Tracking tickets per wallet locally
  const [sortBy, setSortBy] = useState('Newest');
  const [selectedRaffleDetails, setSelectedRaffleDetails] = useState(null);
  const [winningRaffle, setWinningRaffle] = useState(null);
  const [modalTab, setModalTab] = useState('details'); // 'details' or 'participants'
  const [participants, setParticipants] = useState([]);
  const [liveActivity, setLiveActivity] = useState([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  const notify = (message, type = 'success', persistent = false) => {
    setNotification({ message, type, persistent });
    if (!persistent) {
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // MALLOW PROTOCOL CONSTANTS
  const MALLOW_PROGRAM_ID = useMemo(() => new PublicKey('ComputeBudget111111111111111111111111111111'), []); 
  const MICROS_TREASURY = useMemo(() => new PublicKey('2Vvv3raBsA2SKSU4GbURS9nDVWe46zZAqUt3rj4Hb8n2'), []);
  const NTZ_MINT = useMemo(() => new PublicKey('HgceAr5JaC4CbBMNqQJC4BMj7TS3d6uaQ3QDGYzvieA3'), []);
  const HOLDER_ONLY_FEE = 1.0; // 1 SOL fee for holder-only mode

  // Authorized wallets for creating raffles
  const AUTHORIZED_CREATORS = useMemo(() => [
    'BD8fhrvmgvkh1LbnXBSZcCWoZ2XGeJxUdgFxZ2X6YAdV',
    'D2oodgQe4umpJtapsoR3kzEo2KJM3ES33qoaMCwU4bu4',
    '8Q33xekaQFtuPLHcGw2QtiJRHBZX3CDg6dSymk6rKj7E',
    '8ofPwgXdLgjkgWn9zLGsckYkRrvm7ehKnRQWttKjJ1UX',
    'BJWGkhiBagxrt87Wiw4HLwNYGtB1rrJVkVC6AcVZR2U1',
    '266SHaNB6TeRH4cJuui3UKXGVQKaQskiFCG6pn5u2SHd',
    '8UbbCaR2eWf1hMV8Rq1TZYUup3L6EzPuzryN9EA2mLSy'
  ], []);

  const isAuthorizedCreator = useMemo(() => {
    if (!publicKey) return false;
    return AUTHORIZED_CREATORS.includes(publicKey.toBase58());
  }, [publicKey, AUTHORIZED_CREATORS]);

  const [paymentCurrency, setPaymentCurrency] = useState('SOL'); // 'SOL' or 'NTZ'

  const setQuickDate = (hours) => {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    setEndDate(`${year}-${month}-${day}T${hour}:${minute}`);
  };

  const rentAmount = useMemo(() => {
    // Basic calculation for visual feedback: ~0.00025 SOL per ticket
    return (ticketSupply * 0.0002533).toFixed(3);
  }, [ticketSupply]);

  // Persistent data from Supabase
  const [activeRaffles, setActiveRaffles] = useState([]);
  const [pastRaffles, setPastRaffles] = useState([]);
  const [isLoadingRaffles, setIsLoadingRaffles] = useState(true);

  const fetchRaffles = async () => {
    setIsLoadingRaffles(true);
    try {
      // 1. Trigger Auto-Draw for any expired raffles that haven't picked a winner yet
      const { data: expiredRaffles, error: expiredError } = await supabase
        .from('raffles')
        .select('id')
        .eq('status', 'active')
        .lt('ends_at', new Date().toISOString());

      if (!expiredError && expiredRaffles.length > 0) {
        console.log(`Found ${expiredRaffles.length} expired raffles. Drawing winners...`);
        for (const r of expiredRaffles) {
          // Call our SQL function to pick a winner
          await supabase.rpc('pick_raffle_winner', { target_raffle_id: r.id });
        }
      }

      // 2. Fetch all raffles (now including newly drawn winners)
      const { data, error } = await supabase
        .from('raffles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform Supabase data to match app structure
      const transformed = data.map(r => ({
        id: r.id,
        name: r.name,
        price: r.ticket_price,
        supply: r.ticket_supply,
        sold: r.ticket_sold,
        limitPerWallet: r.limit_per_wallet,
        image: r.image_url,
        createdAt: r.created_at,
        endsAt: r.ends_at,
        creator: r.creator_address,
        winner: r.winner_address,
        status: r.status,
        paymentMint: r.payment_mint,
        paymentSymbol: r.payment_symbol || 'SOL',
        tokenPrize: r.prize_token_mint ? {
          symbol: r.prize_token_symbol,
          amount: r.prize_token_amount,
          mint: r.prize_token_mint
        } : null
      }));

      setActiveRaffles(transformed.filter(r => r.status === 'active' && new Date(r.endsAt) > new Date()));
      setPastRaffles(transformed.filter(r => r.status === 'ended' || new Date(r.endsAt) <= new Date()));

      // --- TWO-LEVEL CELEBRATION LOGIC ---
      if (publicKey) {
        const userAddress = publicKey.toBase58();
        const seenWinners = JSON.parse(localStorage.getItem('micros_seen_winners') || '[]');
        
        // Find if user won any raffle they haven't seen the celebration for yet
        const newWin = transformed.find(r => 
          r.winner === userAddress && 
          !seenWinners.includes(r.id)
        );

        if (newWin) {
          setWinningRaffle(newWin);
          // Save to seen winners
          localStorage.setItem('micros_seen_winners', JSON.stringify([...seenWinners, newWin.id]));
        } else {
          // If not a winner, check for ANY newly drawn winner for the community celebration
          const recentlyEnded = transformed.find(r => 
            r.winner && 
            r.winner !== userAddress &&
            !seenWinners.includes(r.id)
          );

          if (recentlyEnded) {
            notify(`A winner has been drawn for ${recentlyEnded.name}! 🎊`, 'success');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            localStorage.setItem('micros_seen_winners', JSON.stringify([...seenWinners, recentlyEnded.id]));
          }
        }
      }
    } catch (e) {
      console.error('Error fetching raffles:', e);
      notify('Failed to load raffles from database.', 'error');
    } finally {
      setIsLoadingRaffles(false);
    }
  };

  const fetchParticipants = async (raffleId) => {
    setIsLoadingParticipants(true);
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('wallet_address, quantity')
        .eq('raffle_id', raffleId);

      if (error) throw error;

      // Group by wallet and sum quantities for a clean leaderboard
      const grouped = data.reduce((acc, curr) => {
        acc[curr.wallet_address] = (acc[curr.wallet_address] || 0) + curr.quantity;
        return acc;
      }, {});

      const sorted = Object.entries(grouped)
        .map(([wallet, tickets]) => ({ wallet, tickets }))
        .sort((a, b) => b.tickets - a.tickets);

      setParticipants(sorted);
    } catch (e) {
      console.error('Error fetching participants:', e);
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const fetchLiveActivity = async () => {
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('wallet_address, quantity, raffles(name)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLiveActivity(data.map(item => ({
        wallet: item.wallet_address,
        quantity: item.quantity,
        raffleName: item.raffles?.name || 'a raffle'
      })));
    } catch (e) {
      console.error('Error fetching activity:', e);
    }
  };

  useEffect(() => {
    fetchRaffles();
    fetchLiveActivity();
    const interval = setInterval(fetchLiveActivity, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [publicKey]);

  useEffect(() => {
    if (selectedRaffleDetails) {
      setModalTab('details');
      fetchParticipants(selectedRaffleDetails.id);
    }
  }, [selectedRaffleDetails]);

  useEffect(() => {
    if (publicKey) {
      connection.getBalance(publicKey).then(bal => {
        setBalance(bal / LAMPORTS_PER_SOL);
      });
      // Fetch NTZ Balance
      getAssociatedTokenAddress(NTZ_MINT, publicKey).then(ata => {
        connection.getTokenAccountBalance(ata).then(res => {
          setNtzBalance(res.value.uiAmount || 0);
        }).catch(() => setNtzBalance(0));
      });
    } else {
      setBalance(0);
      setNtzBalance(0);
      setWalletNfts([]);
      setSelectedNft(null);
    }
  }, [publicKey, connection]);

  const fetchWalletNfts = async (onlyVerified = false) => {
    console.log("fetchWalletNfts called, publicKey:", publicKey?.toBase58(), "onlyVerified:", onlyVerified);
    if (!publicKey) {
      notify("Please connect your wallet first!", 'error');
      return;
    }
    setVerifiedFilter(onlyVerified);
    setIsLoadingNfts(true);
    setShowNftModal(true);
    try {
      const rpcUrl = connection.rpcEndpoint;
      console.log("Using RPC URL:", rpcUrl);
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'my-id',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: publicKey.toBase58(),
            page: 1,
            limit: 100,
            displayOptions: { showCollectionMetadata: true },
          },
        }),
      });

      const data = await response.json();
      console.log("DAS Response:", data);
      
      if (data.error) throw new Error(data.error.message || "RPC Error");
      
      const result = data.result;
      if (!result || !result.items) throw new Error("Invalid DAS response structure");

      let items = result.items;
      
      const nfts = items.filter(asset => {
        const tokenInfo = asset.token_info || {};
        
        // SFT/NFT CHECK: If it has 0 decimals, it's a collectible (like the OPOS cube).
        // Standard NFTs and Semi-Fungible Tokens (SFTs) both use 0 decimals.
        const hasZeroDecimals = tokenInfo.decimals === 0;
        
        // Also include standard NFT interfaces
        const isNftInterface = ['V1_NFT', 'ProgrammableNFT', 'FungibleAsset'].includes(asset.interface);
        
        return hasZeroDecimals || (isNftInterface && tokenInfo.decimals === undefined);
      }).map(asset => {
        const content = asset.content || {};
        const image = content.links?.image || 
                      content.files?.[0]?.uri || 
                      content.files?.[0]?.url ||
                      './assets/micros.png';
        
        // Check if the asset has a collection and if it is verified
        const isVerified = asset.grouping?.some(g => g.group_key === 'collection') || false;

        // EXTREMELY ROBUST Collection Name Extraction
        const groupInfo = asset.grouping?.find(g => g.group_key === 'collection');
        const collectionName = asset.content?.metadata?.collection?.name || 
                               asset.content?.metadata?.name?.split('#')[0]?.trim() || // Fallback: extract from item name
                               groupInfo?.group_value?.slice(0, 8) + '...' ||
                               'Uncategorized';

        return {
          mint: asset.id,
          name: content.metadata?.name || asset.id.slice(0, 8),
          image: image,
          collection: collectionName,
          verified: isVerified,
          frozen: asset.ownership?.frozen || false
        };
      });

      const filteredNfts = nfts.filter(n => {
        // Hide non-transferable (frozen) NFTs
        if (n.frozen) return false;
        
        const nameLower = n.name.toLowerCase();
        // Hide specifically blacklisted collections and keywords (singular catches plural)
        if (nameLower.includes('lucky emmy')) return false;
        if (nameLower.includes('airdrop')) return false;
        if (nameLower.includes('reward')) return false;
        
        // Apply verified filter if requested
        if (onlyVerified && (!n.verified || n.collection === 'None')) return false;
        return true;
      });

      console.log("Processed NFTs:", filteredNfts.length);
      setWalletNfts(filteredNfts);

      // --- GROUP BY COLLECTION ---
      const groups = filteredNfts.reduce((acc, nft) => {
        const key = nft.collection || 'Uncategorized';
        if (!acc[key]) {
          acc[key] = {
            name: key,
            image: nft.image, // Use the first NFT image as the group cover
            count: 0,
            items: []
          };
        }
        acc[key].items.push(nft);
        acc[key].count += 1;
        return acc;
      }, {});

      setNftCollectionGroups(Object.values(groups).sort((a, b) => b.count - a.count));
      setSelectedCollectionName(null); // Reset view when fetching
    } catch (e) {
      console.error("Helius DAS Error:", e);
      try {
        console.log("Attempting fallback token account fetch...");
        const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        });
        const mapped = accounts.value
          .filter(a => {
            const info = a.account.data.parsed.info;
            // Only NFTs (amount 1, decimals 0) that are NOT frozen
            return info.tokenAmount.uiAmount === 1 && info.tokenAmount.decimals === 0 && info.state !== 'frozen';
          })
          .map(a => ({
            mint: a.account.data.parsed.info.mint,
            name: `NFT (${a.account.data.parsed.info.mint.slice(0, 4)}...)`,
            image: './assets/micros.png',
          }));
        console.log("Fallback results:", mapped.length);
        setWalletNfts(mapped);
      } catch (fallbackError) {
        console.error("All fetch methods failed:", fallbackError);
        notify("Unable to load NFTs: " + (fallbackError.message || "Unknown error"), 'error');
      }
    } finally {
      setIsLoadingNfts(false);
    }
  };

  const fetchWalletTokens = async () => {
    if (!publicKey) {
      notify("Please connect your wallet first!", 'error');
      return;
    }
    setIsLoadingTokens(true);
    setShowTokenModal(true);
    try {
      const rpcUrl = connection.rpcEndpoint;
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'token-fetch',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: publicKey.toBase58(),
            page: 1,
            limit: 100,
            displayOptions: { 
              showCollectionMetadata: true,
              showFungible: true // CRITICAL for fetching tokens
            },
          },
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const items = data.result?.items || [];
      console.log("DAS Token Items:", items.length);
      
      const tokens = items
        .filter(asset => {
          const tokenInfo = asset.token_info || {};
          
          // ULTIMATE TOKEN CHECK: If it has more than 0 decimals, it's a fungible token.
          const hasDecimals = tokenInfo.decimals > 0;
          
          // Also check Fungible interfaces for tokens that might have 0 decimals but are intended as tokens (rare)
          // but prioritize decimals check to avoid catching NFTs.
          const isFungibleInterface = asset.interface === 'FungibleToken' || asset.interface === 'FungibleAsset';
          
          // To be a token in our app, it MUST have decimals > 0 to separate from the 'Collectibles' tab.
          return hasDecimals && isFungibleInterface;
        })
        .map(asset => {
          const content = asset.content || {};
          const metadata = content.metadata || {};
          const links = content.links || {};
          const tokenInfo = asset.token_info || {};
          
          return {
            mint: asset.id,
            amount: tokenInfo.balance / Math.pow(10, tokenInfo.decimals || 0),
            decimals: tokenInfo.decimals || 0,
            symbol: metadata.symbol || tokenInfo.symbol || asset.id.slice(0, 4),
            name: metadata.name || tokenInfo.name || asset.id.slice(0, 8),
            image: links.image || content.files?.[0]?.uri || null
          };
        })
        .filter(t => t.amount > 0);
        
      if (tokens.length > 0) {
        setWalletTokens(tokens);
      } else {
        // If DAS returns nothing, try the robust fallback
        throw new Error("No tokens from DAS");
      }
    } catch (e) {
      console.error("Error fetching tokens with DAS, trying fallback:", e);
      // Fallback to standard RPC calls for both Legacy and Token-2022
      try {
        const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkThT9S7ii7z6MDN6KR7f7f2');

        const [legacyAccounts, token2022Accounts] = await Promise.all([
          connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID }),
          connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_2022_PROGRAM_ID })
        ]);

        const allAccounts = [...legacyAccounts.value, ...token2022Accounts.value];
        console.log("Fallback Token Accounts Total:", allAccounts.length);
        const mapped = allAccounts
          .filter(a => a.account.data.parsed.info.state !== 'frozen') // Filter out frozen tokens
          .map(a => {
            const info = a.account.data.parsed.info;
            const uiAmount = info.tokenAmount.uiAmount;
            return {
              mint: info.mint,
              amount: uiAmount,
              decimals: info.tokenAmount.decimals,
              symbol: info.mint.slice(0, 4),
              name: 'Token',
              image: null
            };
          })
          .filter(t => t.amount > 0);
        
        console.log("Fallback Tokens Mapped:", mapped.length);
        setWalletTokens(mapped);
      } catch (inner) {
        console.error("All token fetch methods failed:", inner);
      }
    } finally {
      setIsLoadingTokens(false);
    }
  };

  useEffect(() => {
    const onScroll = () => {
      try {
        const y = window.scrollY || window.pageYOffset || 0;
        setScrolled(y > 10);
      } catch (_) {}
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleCreateRaffle = async () => {
    if (!publicKey) {
      notify('Please connect your wallet first!', 'error');
      return;
    }

    const supplyNum = parseInt(ticketSupply);
    if (!ticketSupply || supplyNum < 3) {
      notify('Minimum ticket supply is 3.', 'error');
      return;
    }

    if (!ticketPrice || parseFloat(ticketPrice) <= 0) {
      notify('Please enter a valid ticket price.', 'error');
      return;
    }

    if (!selectedNft && !selectedToken) {
      notify('Please select at least one prize (NFT or Tokens).', 'error');
      return;
    }

    if (selectedToken && (!tokenAmount || parseFloat(tokenAmount) <= 0)) {
      notify('Please enter a valid token amount.', 'error');
      return;
    }

    if (!endDate) {
      notify('Please select an end date.', 'error');
      return;
    }

    if (!agreeToTerms) {
      notify('You must agree to the Terms & Conditions to create a raffle.', 'error');
      return;
    }
    
    notify('Please approve the creation transaction in your wallet...', 'info', true);
    setIsCreating(true);
    try {
      // --- MALLOW PROTOCOL INTEGRATION LOGIC ---
      // 1. Calculate Fees (Holder fee + Base fee)
      const isHolderOnly = collections.some(c => c.trim() !== '');
      const baseCreationFee = 0.05; // Example 0.05 SOL base
      const totalCreationFee = isHolderOnly ? (baseCreationFee + HOLDER_ONLY_FEE) : baseCreationFee;

      console.log(`Creating raffle on Mallow Protocol. Fee: ${totalCreationFee} SOL`);

      // 2. Prepare Transaction (Placeholder for smart contract call)
      // In a real implementation, we would call the 'createRaffle' instruction on the Mallow Program
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: MICROS_TREASURY,
          lamports: Math.round(totalCreationFee * LAMPORTS_PER_SOL),
        })
      );
      
      // 3. Escrow the Prize (NFT or Tokens)
      // If selectedNft -> Transfer NFT to Mallow Escrow Account
      // If selectedToken -> Transfer tokenAmount to Mallow Escrow Account
      
      const signature = await sendTransaction(transaction, connection);
      notify('Confirming on-chain... ⛓️', 'info', true);
      await connection.confirmTransaction(signature, 'processed');
      
      // 4. Save to Supabase
      const { data: newRaffleData, error: dbError } = await supabase
        .from('raffles')
        .insert([{
          creator_address: publicKey.toBase58(),
          name: selectedNft ? selectedNft.name : (selectedToken ? `${tokenAmount} ${selectedToken.symbol}` : 'New Raffle'),
          image_url: selectedNft ? selectedNft.image : (selectedToken?.image || './assets/micros.png'),
          ticket_price: parseFloat(ticketPrice),
          ticket_supply: supplyNum,
          limit_per_wallet: parseInt(ticketLimit) || 1,
          ends_at: new Date(endDate).toISOString(),
          prize_nft_mint: selectedNft?.mint || null,
          prize_token_mint: selectedToken?.mint || null,
          prize_token_amount: selectedToken ? parseFloat(tokenAmount) : null,
          prize_token_symbol: selectedToken?.symbol || null,
          payment_mint: paymentCurrency === 'NTZ' ? NTZ_MINT.toBase58() : null,
          payment_symbol: paymentCurrency,
          status: 'active'
        }])
        .select();

      if (dbError) throw dbError;

      // Update local state
      const dbRaffle = newRaffleData[0];
      const newRaffle = {
        id: dbRaffle.id,
        name: dbRaffle.name,
        image: dbRaffle.image_url,
        price: dbRaffle.ticket_price,
        supply: dbRaffle.ticket_supply,
        sold: 0,
        limitPerWallet: dbRaffle.limit_per_wallet,
        createdAt: dbRaffle.created_at,
        endsAt: dbRaffle.ends_at,
        creator: dbRaffle.creator_address,
        isTokenOnly: !selectedNft && !!selectedToken,
        tokenPrize: dbRaffle.prize_token_mint ? {
          symbol: dbRaffle.prize_token_symbol,
          amount: dbRaffle.prize_token_amount,
          mint: dbRaffle.prize_token_mint
        } : null
      };
      
      setActiveRaffles(prev => [newRaffle, ...prev]);
      setIsCreating(false);
      setActiveTab('Active Raffles');
      
      notify('Raffle created successfully!', 'success');
    } catch (e) {
      console.error(e);
      notify('Failed to create raffle: ' + e.message, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleBuyTicket = async (raffle) => {
    if (!publicKey) {
      notify('Please connect your wallet first!', 'error');
      return;
    }

    const quantity = buyQuantities[raffle.id] || 1;

    // 1. Check Total Ticket Supply
    const remainingSupply = raffle.supply - raffle.sold;
    if (quantity > remainingSupply) {
      notify(`Not enough tickets left! Only ${remainingSupply} remaining.`, 'error');
      return;
    }

    // 2. Check Wallet Limit
    const alreadyBought = userPurchasedCounts[raffle.id] || 0;
    const limit = raffle.limitPerWallet || 1;
    if (alreadyBought + quantity > limit) {
      if (alreadyBought >= limit) {
        notify(`You have already reached the limit of ${limit} ticket(s) for this raffle.`, 'error');
      } else {
        notify(`You can only buy ${limit - alreadyBought} more ticket(s). Your limit is ${limit}.`, 'error');
      }
      return;
    }

    const ticketPriceLamports = Math.round(raffle.price * (raffle.paymentSymbol === 'NTZ' ? 1000000 : LAMPORTS_PER_SOL));
    const totalCostLamports = ticketPriceLamports * quantity;

    // --- CALCULATE SPLIT (4.75% to Micros, 95.25% to Creator) ---
    const commissionLamports = Math.floor(totalCostLamports * 0.0475);
    const creatorLamports = totalCostLamports - commissionLamports;
    const creatorPubkey = new PublicKey(raffle.creator);

    notify(`Please approve the purchase of ${quantity} ticket(s) in your wallet...`, 'info', true);
    setIsBuying(true);
    try {
      const transaction = new Transaction();

      if (raffle.paymentSymbol === 'NTZ') {
        // --- SPL TOKEN TRANSFER ($NTZ) ---
        const userAta = await getAssociatedTokenAddress(NTZ_MINT, publicKey);
        const treasuryAta = await getAssociatedTokenAddress(NTZ_MINT, MICROS_TREASURY);
        const creatorAta = await getAssociatedTokenAddress(NTZ_MINT, creatorPubkey);

        // Check if user has the token account
        try {
          const accountInfo = await connection.getAccountInfo(userAta);
          if (!accountInfo) {
            throw new Error(`You don't have any $NTZ tokens in your wallet.`);
          }
        } catch (e) {
          throw new Error(`You don't have any $NTZ tokens in your wallet.`);
        }

        // 1. Send Commission to Micros Treasury
        if (commissionLamports > 0) {
          transaction.add(
            createTransferCheckedInstruction(
              userAta, NTZ_MINT, treasuryAta, publicKey, commissionLamports, 6
            )
          );
        }

        // 2. Send Remaining to Raffle Creator
        transaction.add(
          createTransferCheckedInstruction(
            userAta, NTZ_MINT, creatorAta, publicKey, creatorLamports, 6
          )
        );
      } else {
        // --- NATIVE SOL TRANSFER ---
        // 1. Send Commission to Micros Treasury
        if (commissionLamports > 0) {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: MICROS_TREASURY,
              lamports: commissionLamports,
            })
          );
        }

        // 2. Send Remaining to Raffle Creator
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: creatorPubkey,
            lamports: creatorLamports,
          })
        );
      }

      const signature = await sendTransaction(transaction, connection);
      notify('Confirming purchase on-chain... ⛓️', 'info', true);
      await connection.confirmTransaction(signature, 'processed');

      // Update Supabase
      const { error: dbError } = await supabase
        .from('raffles')
        .update({ ticket_sold: raffle.sold + quantity })
        .eq('id', raffle.id);

      if (dbError) throw dbError;

      // Record the Entry for the winner drawing logic
      const { error: entryError } = await supabase
        .from('entries')
        .insert([{
          raffle_id: raffle.id,
          wallet_address: publicKey.toBase58(),
          quantity: quantity
        }]);

      if (entryError) {
        console.error("Failed to record entry, but SOL was sent:", entryError);
        // We don't throw here because the user already paid
      }

      notify(`${quantity} ticket(s) purchased!`, 'success');
      
      setActiveRaffles(prev => prev.map(r => r.id === raffle.id ? { ...r, sold: r.sold + quantity } : r));
      setUserPurchasedCounts(prev => ({
        ...prev,
        [raffle.id]: (prev[raffle.id] || 0) + quantity
      }));
    } catch (e) {
      console.error(e);
      notify('Purchase failed: ' + e.message, 'error');
    } finally {
      setIsBuying(false);
    }
  };

  const handleCollectionChange = (idx, value) => {
    const next = [...collections];
    next[idx] = value;
    setCollections(next);
  };

  const handleRemoveCollection = (idx) => {
    if (collections.length <= 1) return;
    setCollections(collections.filter((_, i) => i !== idx));
  };

  const tabs = ['Active Raffles', 'Past Raffles', 'My Activity'];

  const myRaffles = useMemo(() => {
    if (!publicKey) return [];
    const pkStr = publicKey.toBase58();
    // In a real app, you'd also filter by raffles the user entered
    return [
      ...activeRaffles.filter(r => r.creator === pkStr),
      ...pastRaffles.filter(r => r.creator === pkStr || r.winner === pkStr)
    ];
  }, [publicKey, activeRaffles, pastRaffles]);

  const sortedActiveRaffles = useMemo(() => {
    let list = [...activeRaffles];
    if (sortBy === 'Ending Soon') {
      return list.sort((a, b) => new Date(a.endsAt) - new Date(b.endsAt));
    } else if (sortBy === 'Price: Low to High') {
      return list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'Price: High to Low') {
      return list.sort((a, b) => b.price - a.price);
    }
    // Default: Newest
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [activeRaffles, sortBy]);

  return React.createElement(React.Fragment, null,
    // NFT Selection Modal
    showNftModal && React.createElement('div', { className: 'nft-selection-modal-backdrop', onClick: () => setShowNftModal(false) },
      React.createElement('div', { className: 'nft-selection-modal', onClick: e => e.stopPropagation() },
        React.createElement('div', { className: 'modal-header' },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
            selectedCollectionName && React.createElement('button', { 
              className: 'modal-back-btn',
              onClick: () => setSelectedCollectionName(null)
            }, '←'),
            React.createElement('h2', null, selectedCollectionName || (verifiedFilter ? 'Verified Collections' : 'Select NFT prize'))
          ),
          React.createElement('button', { className: 'modal-close', onClick: () => setShowNftModal(false) }, '×')
        ),
        React.createElement('div', { className: 'modal-body' },
          isLoadingNfts ? (
            React.createElement('div', { className: 'modal-loading' }, 'Fetching your NFTs...')
          ) : nftCollectionGroups.length > 0 ? (
            !selectedCollectionName ? (
              // --- COLLECTION GROUPS VIEW ---
              React.createElement('div', { className: 'nft-list-grid' },
                nftCollectionGroups.map(group => (
                  React.createElement('div', { 
                    key: group.name, 
                    className: 'nft-item-select collection-group-card',
                    onClick: () => setSelectedCollectionName(group.name)
                  },
                    React.createElement('div', { className: 'collection-image-wrap' },
                      React.createElement('img', { src: group.image, alt: group.name }),
                      React.createElement('span', { className: 'collection-count-badge' }, group.count)
                    ),
                    React.createElement('span', { className: 'collection-group-name' }, group.name)
                  )
                ))
              )
            ) : (
              // --- INDIVIDUAL NFTS IN COLLECTION VIEW ---
              React.createElement('div', { className: 'nft-list-grid' },
                nftCollectionGroups.find(g => g.name === selectedCollectionName)?.items.map(nft => (
                  React.createElement('div', { 
                    key: nft.mint, 
                    className: 'nft-item-select',
                    onClick: () => { setSelectedNft(nft); setShowNftModal(false); }
                  },
                    React.createElement('img', { src: nft.image, alt: nft.name }),
                    React.createElement('span', null, nft.name)
                  )
                ))
              )
            )
          ) : (
            React.createElement('div', { className: 'modal-empty' }, 
              publicKey ? (verifiedFilter ? 'No verified collections found in your wallet.' : 'No NFTs found in your wallet.') : 'Please connect your wallet to view NFTs.'
            )
          )
        )
      )
    ),
    // Token Selection Modal
    showTokenModal && React.createElement('div', { className: 'nft-selection-modal-backdrop', onClick: () => setShowTokenModal(false) },
      React.createElement('div', { className: 'nft-selection-modal', onClick: e => e.stopPropagation() },
        React.createElement('div', { className: 'modal-header' },
          React.createElement('h2', null, 'Select Token'),
          React.createElement('button', { className: 'modal-close', onClick: () => setShowTokenModal(false) }, '×')
        ),
        React.createElement('div', { className: 'modal-body' },
          isLoadingTokens ? (
            React.createElement('div', { className: 'modal-loading' }, 'Fetching your tokens...')
          ) : walletTokens.length > 0 ? (
            React.createElement('div', { className: 'nft-list-grid' },
              walletTokens.map(token => (
                React.createElement('div', { 
                  key: token.mint, 
                  className: 'nft-item-select',
                  onClick: () => { setSelectedToken(token); setShowTokenModal(false); }
                },
                  token.image ? React.createElement('img', { 
                    src: token.image, 
                    alt: token.symbol, 
                    className: 'token-select-image' 
                  }) : React.createElement('div', { className: 'token-icon-placeholder' }, token.symbol[0]),
                  React.createElement('div', { className: 'token-select-info' },
                    React.createElement('span', { className: 'token-symbol-mini' }, token.symbol),
                    React.createElement('span', { className: 'token-balance' }, `Balance: ${token.amount.toLocaleString()}`)
                  )
                )
              ))
            )
          ) : (
            React.createElement('div', { className: 'modal-empty' }, 'No tokens found in your wallet.')
          )
        )
      )
    ),
    // Prize Detail Modal
    selectedRaffleDetails && React.createElement('div', { className: 'nft-selection-modal-backdrop', onClick: () => setSelectedRaffleDetails(null) },
      React.createElement('div', { className: 'nft-selection-modal detail-modal', onClick: e => e.stopPropagation() },
        React.createElement('div', { className: 'modal-header' },
          React.createElement('div', { className: 'modal-tabs' },
            React.createElement('button', { 
              className: `modal-tab ${modalTab === 'details' ? 'active' : ''}`,
              onClick: () => setModalTab('details')
            }, 'Prize Details'),
            React.createElement('button', { 
              className: `modal-tab ${modalTab === 'participants' ? 'active' : ''}`,
              onClick: () => setModalTab('participants')
            }, 'Participants')
          ),
          React.createElement('button', { className: 'modal-close', onClick: () => setSelectedRaffleDetails(null) }, '×')
        ),
        React.createElement('div', { className: 'modal-body' },
          modalTab === 'details' ? (
            React.createElement('div', { className: 'raffle-detail-content' },
              React.createElement('div', { className: 'raffle-detail-image-wrap' },
                React.createElement('img', { src: selectedRaffleDetails.image, alt: selectedRaffleDetails.name, className: 'raffle-detail-image' }),
                selectedRaffleDetails.tokenPrize && React.createElement('div', { className: 'raffle-prize-badge large' }, 
                  `+ ${selectedRaffleDetails.tokenPrize.amount.toLocaleString()} ${selectedRaffleDetails.tokenPrize.symbol}`
                )
              ),
              React.createElement('div', { className: 'raffle-detail-info' },
                React.createElement('div', { className: 'detail-stats-grid' },
                  React.createElement('div', { className: 'detail-stat-item' },
                    React.createElement('label', null, 'Ticket Price'),
                    React.createElement('span', null, selectedRaffleDetails.price, ' ', selectedRaffleDetails.paymentSymbol || 'SOL')
                  ),
                  React.createElement('div', { className: 'detail-stat-item' },
                    React.createElement('label', null, 'Tickets Sold'),
                    React.createElement('span', null, selectedRaffleDetails.sold, ' / ', selectedRaffleDetails.supply)
                  ),
                  React.createElement('div', { className: 'detail-stat-item' },
                    React.createElement('label', null, 'Time Left'),
                    React.createElement(CountdownTimer, { 
                      endsAt: selectedRaffleDetails.endsAt,
                      onEnd: () => {
                        setTimeout(() => {
                          setSelectedRaffleDetails(null);
                          fetchRaffles();
                        }, 2000);
                      }
                    })
                  ),
                  React.createElement('div', { className: 'detail-stat-item' },
                    React.createElement('label', null, 'Limit Per Wallet'),
                    React.createElement('span', null, selectedRaffleDetails.limitPerWallet || 'No limit')
                  )
                ),
                React.createElement('div', { className: 'detail-description' },
                  React.createElement('h4', null, 'Prize Details'),
                  React.createElement('div', { className: 'prize-bullet-list' },
                    React.createElement('div', { className: 'prize-bullet' }, `• ${selectedRaffleDetails.name}`),
                    selectedRaffleDetails.tokenPrize && React.createElement('div', { className: 'prize-bullet' }, `• ${selectedRaffleDetails.tokenPrize.amount.toLocaleString()} ${selectedRaffleDetails.tokenPrize.symbol}`)
                  ),
                  React.createElement('div', { className: 'detail-actions' },
                    React.createElement('div', { className: 'raffle-buy-row detail-buy-row' },
                      React.createElement('div', { className: 'raffle-quantity-selector' },
                        React.createElement('button', { 
                          onClick: () => setBuyQuantities(prev => ({ ...prev, [selectedRaffleDetails.id]: Math.max(1, (prev[selectedRaffleDetails.id] || 1) - 1) }))
                        }, '-'),
                        React.createElement('input', { 
                          type: 'number', 
                          value: buyQuantities[selectedRaffleDetails.id] || 1,
                          onChange: (e) => {
                            const val = parseInt(e.target.value) || 1;
                            setBuyQuantities(prev => ({ ...prev, [selectedRaffleDetails.id]: Math.max(1, val) }));
                          }
                        }),
                        React.createElement('button', { 
                          onClick: () => setBuyQuantities(prev => ({ ...prev, [selectedRaffleDetails.id]: (prev[selectedRaffleDetails.id] || 1) + 1 }))
                        }, '+')
                      ),
                      React.createElement('button', { 
                        className: 'raffle-btn-buy large',
                        onClick: () => { handleBuyTicket(selectedRaffleDetails); setSelectedRaffleDetails(null); },
                        disabled: isBuying
                      }, isBuying ? React.createElement('div', { className: 'raffle-spinner' }) : `Buy ${buyQuantities[selectedRaffleDetails.id] || 1} Ticket${(buyQuantities[selectedRaffleDetails.id] || 1) > 1 ? 's' : ''} Now`)
                    )
                  )
                )
              )
            )
          ) : (
            React.createElement('div', { className: 'raffle-participants-list' },
              isLoadingParticipants ? (
                React.createElement('div', { className: 'modal-loading' }, 'Loading participants...')
              ) : participants.length > 0 ? (
                React.createElement('div', { className: 'leaderboard-grid' },
                  participants.map((p, index) => (
                    React.createElement('div', { key: index, className: 'leaderboard-row' },
                      React.createElement('span', { className: 'leader-rank' }, `#${index + 1}`),
                      React.createElement('span', { className: 'leader-wallet' }, p.wallet.slice(0, 6) + '...' + p.wallet.slice(-4)),
                      React.createElement('span', { className: 'leader-tickets' }, `${p.tickets} tickets`)
                    ))
                  )
                )
              ) : (
                React.createElement('div', { className: 'modal-empty' }, 'No participants yet. Be the first to enter!')
              )
            )
          )
        )
      )
    ),
    // Custom Notification Toast
    notification && React.createElement('div', { className: `raffle-notification ${notification.type}` },
      React.createElement('span', { className: 'notification-icon' }, notification.type === 'success' ? '✅' : '❌'),
      React.createElement('span', { className: 'notification-message' }, notification.message),
      React.createElement('button', { className: 'notification-close', onClick: () => setNotification(null) }, '×')
    ),
    // Winner Celebration Modal
    winningRaffle && React.createElement(WinnerModal, { 
      raffle: winningRaffle, 
      onClose: () => setWinningRaffle(null) 
    }),
    React.createElement(StaggeredMenu, {
      className: scrolled ? 'is-scrolled' : '',
      position: 'right',
      colors: ['#FFC0F5', '#00E3FA', '#5CFCA9', '#FFD55F', '#FF9161'],
      items: [
        { label: 'Home', ariaLabel: 'Go to home', link: 'https://microsnft.xyz' },
        { label: 'Mint', ariaLabel: 'Go to mint page', link: 'https://www.launchmynft.io/collections/3M2xsZtaBTScbuWBxYQ7jjeV6SinvLLeaxFcQCrH1oK3/R1YohhQEJcsVlXBuOvwq' },
        { label: 'Gallery', ariaLabel: 'View gallery', link: 'https://microsnft.xyz/gallery.html' },
        { label: 'About Us', ariaLabel: 'Learn about us', link: 'https://microsnft.xyz/#about' }
      ],
      socialItems: [
        { label: 'X', link: 'https://x.com/microsnft' },
        { label: 'Discord', link: 'https://discord.gg/hbsx6QJUxS' }
      ],
      displaySocials: true,
      displayItemNumbering: true,
      menuButtonColor: '#fff',
      openMenuButtonColor: '#fff',
      changeMenuColorOnOpen: false,
      logoUrl: './assets/logo-opposite.svg',
      accentColor: '#ff6b6b',
      isFixed: true
    }),
    React.createElement('div', { className: 'raffle-fixed-header' },
      React.createElement('div', { className: 'raffle-header-actions' },
        React.createElement(WalletMultiButton, { className: 'raffle-wallet-button' })
      )
    ),
    React.createElement('main', { className: 'raffle-site' },
      React.createElement(GalaxyBackground, null),
      React.createElement('div', { className: 'raffle-container' },
        React.createElement(LiveActivityFeed, { activities: liveActivity }),
        React.createElement('header', { className: 'raffle-header' },
          React.createElement('nav', { className: 'raffle-nav' },
            activeTab === 'Create' ? (
              React.createElement('button', {
                className: 'raffle-nav-item active',
                onClick: () => setActiveTab('Active Raffles')
              }, '← Go Back')
            ) : (
              React.createElement(React.Fragment, null,
                tabs.map(tab => React.createElement('button', {
                  key: tab,
                  className: `raffle-nav-item ${activeTab === tab ? 'active' : ''}`,
                  onClick: () => setActiveTab(tab)
                }, tab)),
                isAuthorizedCreator && React.createElement('button', { 
                  className: 'raffle-btn-create-nav',
                  onClick: () => setActiveTab('Create')
                }, 'Create Raffle')
              )
            )
          )
        ),
        activeTab === 'Active Raffles' ? (
          React.createElement('div', { className: 'raffle-active-list' },
            React.createElement('div', { className: 'section-header' },
              React.createElement('h2', { className: 'section-title' }, 'Active Raffles'),
              React.createElement('div', { className: 'raffle-sort-wrapper' },
                React.createElement('span', { className: 'sort-label' }, 'Sort by:'),
                React.createElement('select', { 
                  className: 'raffle-sort-select',
                  value: sortBy,
                  onChange: (e) => setSortBy(e.target.value)
                }, 
                  ['Newest', 'Ending Soon', 'Price: Low to High', 'Price: High to Low'].map(opt => 
                    React.createElement('option', { key: opt, value: opt }, opt)
                  )
                )
              )
            ),
            isLoadingRaffles ? (
              React.createElement('div', { className: 'raffle-empty-state' },
                React.createElement('div', { className: 'raffle-spinner', style: { width: '40px', height: '40px', marginBottom: '20px' } }),
                React.createElement('h3', null, 'Loading Raffles...'),
                React.createElement('p', null, 'Fetching live data from the blockchain.')
              )
            ) : sortedActiveRaffles.length > 0 ? (
              React.createElement('div', { className: 'raffle-card-grid' },
                sortedActiveRaffles.map(raffle => (
                  React.createElement('div', { 
                    key: raffle.id, 
                    className: 'raffle-item-card',
                    onClick: () => setSelectedRaffleDetails(raffle)
                  },
                    React.createElement('div', { className: 'raffle-item-image' },
                      React.createElement('img', { src: raffle.image, alt: raffle.name }),
                      React.createElement('div', { 
                        className: `raffle-type-badge ${raffle.tokenPrize && !raffle.image.includes(raffle.name) ? 'dual' : (raffle.tokenPrize ? 'token' : 'nft')}` 
                      }, raffle.tokenPrize && !raffle.image.includes(raffle.name) ? 'NFT + TOKEN' : (raffle.tokenPrize ? 'TOKEN PRIZE' : 'NFT PRIZE')),
                      raffle.tokenPrize && React.createElement('div', { className: 'raffle-prize-badge' }, 
                        `+ ${raffle.tokenPrize.amount.toLocaleString()} ${raffle.tokenPrize.symbol}`
                      ),
                      React.createElement('div', { className: 'raffle-card-share' },
                        React.createElement('button', { 
                          title: 'Share on X',
                          onClick: (e) => {
                            e.stopPropagation();
                            const text = encodeURIComponent(`Check out this raffle for ${raffle.name} on Micros!`);
                            const url = encodeURIComponent(window.location.href);
                            window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
                          }
                        }, '𝕏'),
                        React.createElement('button', { 
                          title: 'Copy Link',
                          onClick: (e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(window.location.href);
                            notify('Link copied to clipboard!', 'success');
                          }
                        }, '🔗')
                      )
                    ),
                    React.createElement('div', { className: 'raffle-item-info' },
                      React.createElement('h3', null, raffle.name),
                      React.createElement('div', { className: 'raffle-item-stats' },
                        React.createElement('span', null, 'Price: ', raffle.price, ' ', raffle.paymentSymbol || 'SOL'),
                        React.createElement('span', null, 'Sold: ', raffle.sold, '/', raffle.supply)
                      ),
                      raffle.limitPerWallet && React.createElement('div', { className: 'raffle-item-limit-info' },
                        `Limit: ${raffle.limitPerWallet} per wallet`
                      ),
                      raffle.endsAt && React.createElement('div', { className: 'raffle-item-times' },
                        React.createElement('div', { className: 'raffle-time-row' },
                          React.createElement('span', { className: 'time-label' }, 'Time Left: '),
                          React.createElement(CountdownTimer, { 
                            endsAt: raffle.endsAt,
                            onEnd: () => setTimeout(fetchRaffles, 2000)
                          })
                        )
                      ),
                      React.createElement('div', { className: 'raffle-buy-row' },
                        React.createElement('div', { 
                          className: 'raffle-quantity-selector',
                          onClick: (e) => e.stopPropagation()
                        },
                          React.createElement('button', { 
                            onClick: (e) => {
                              e.stopPropagation();
                              setBuyQuantities(prev => ({ ...prev, [raffle.id]: Math.max(1, (prev[raffle.id] || 1) - 1) }));
                            }
                          }, '-'),
                          React.createElement('input', { 
                            type: 'number', 
                            value: buyQuantities[raffle.id] || 1,
                            onClick: (e) => e.stopPropagation(),
                            onChange: (e) => {
                              const val = parseInt(e.target.value) || 1;
                              setBuyQuantities(prev => ({ ...prev, [raffle.id]: Math.max(1, val) }));
                            }
                          }),
                          React.createElement('button', { 
                            onClick: (e) => {
                              e.stopPropagation();
                              setBuyQuantities(prev => ({ ...prev, [raffle.id]: (prev[raffle.id] || 1) + 1 }));
                            }
                          }, '+')
                        ),
                        React.createElement('button', { 
                        className: 'raffle-btn-buy', 
                        onClick: (e) => {
                          e.stopPropagation();
                          handleBuyTicket(raffle);
                        },
                        disabled: isBuying
                      }, isBuying ? React.createElement('div', { className: 'raffle-spinner' }) : `Buy ${buyQuantities[raffle.id] || 1} Ticket`)
                      )
                    )
                  )
                ))
              )
            ) : (
              React.createElement('div', { className: 'raffle-empty-state' },
                React.createElement('span', { className: 'empty-icon' }, '🎟️'),
                React.createElement('h3', null, 'No Active Raffles'),
                React.createElement('p', null, 'Be the first to create one!'),
                React.createElement('button', { 
                  className: 'raffle-btn-create-nav',
                  onClick: () => setActiveTab('Create'),
                  style: { marginTop: '20px' }
                }, 'Create Raffle')
              )
            )
          )
        ) : activeTab === 'Past Raffles' ? (
          React.createElement('div', { className: 'raffle-active-list' },
            React.createElement('h2', { className: 'section-title' }, 'Past Raffles'),
            pastRaffles.length > 0 ? (
              React.createElement('div', { className: 'raffle-card-grid' },
                pastRaffles.map(raffle => (
                  React.createElement('div', { key: raffle.id, className: 'raffle-item-card past' },
                    React.createElement('div', { className: 'raffle-item-image' },
                      React.createElement('img', { src: raffle.image, alt: raffle.name })
                    ),
                    React.createElement('div', { className: 'raffle-item-info' },
                      React.createElement('h3', null, raffle.name),
                      React.createElement('div', { className: 'raffle-item-stats past-winner' },
                        React.createElement('span', { className: 'winner-label' }, raffle.winner ? 'Winner' : 'Status'),
                        raffle.winner ? React.createElement('a', { 
                          href: `https://solscan.io/account/${raffle.winner}`,
                          target: '_blank',
                          rel: 'noopener noreferrer',
                          className: 'winner-link'
                        }, raffle.winner.slice(0, 4) + '...' + raffle.winner.slice(-4)) : React.createElement('span', { style: { color: '#B19EEF', fontWeight: '700', fontSize: '13px' } }, 'Picking Winner...')
                      ),
                      React.createElement('button', { 
                        className: 'raffle-btn-buy', 
                        disabled: true
                      }, 'Ended')
                    )
                  )
                ))
              )
            ) : (
              React.createElement('div', { className: 'raffle-empty-state' },
                React.createElement('span', { className: 'empty-icon' }, '⌛'),
                React.createElement('h3', null, 'No Past Raffles'),
                React.createElement('p', null, 'Historical raffles will appear here.')
              )
            )
          )
        ) : activeTab === 'My Activity' ? (
          React.createElement('div', { className: 'raffle-active-list' },
            React.createElement('h2', { className: 'section-title' }, 'My Activity'),
            !publicKey ? (
              React.createElement('div', { className: 'raffle-empty-state' },
                React.createElement('span', { className: 'empty-icon' }, '🔐'),
                React.createElement('h3', null, 'Wallet Not Connected'),
                React.createElement('p', null, 'Connect your wallet to see your created and entered raffles.'),
                React.createElement(WalletMultiButton, { className: 'raffle-wallet-button', style: { marginTop: '20px' } })
              )
            ) : myRaffles.length > 0 ? (
              React.createElement('div', { className: 'raffle-card-grid' },
                myRaffles.map(raffle => (
                  React.createElement('div', { key: raffle.id, className: `raffle-item-card ${raffle.winner ? 'past' : ''}` },
                    React.createElement('div', { className: 'raffle-item-image' },
                      React.createElement('img', { src: raffle.image, alt: raffle.name })
                    ),
                    React.createElement('div', { className: 'raffle-item-info' },
                      React.createElement('h3', null, raffle.name),
                      raffle.winner ? (
                        React.createElement(React.Fragment, null,
                          React.createElement('div', { className: 'raffle-item-stats past-winner' },
                            React.createElement('span', { className: 'winner-label' }, raffle.winner ? (raffle.winner === publicKey.toBase58() ? 'You Won!' : 'Winner') : 'Status'),
                            raffle.winner ? React.createElement('a', { 
                              href: `https://solscan.io/account/${raffle.winner}`,
                              target: '_blank',
                              rel: 'noopener noreferrer',
                              className: 'winner-link'
                            }, raffle.winner.slice(0, 4) + '...' + raffle.winner.slice(-4)) : React.createElement('span', { style: { color: '#B19EEF', fontWeight: '700', fontSize: '13px' } }, 'Picking Winner...')
                          ),
                          React.createElement('button', { className: 'raffle-btn-buy', disabled: true }, 'Ended')
                        )
                      ) : (
                        React.createElement(React.Fragment, null,
                          React.createElement('div', { className: 'raffle-item-stats' },
                            React.createElement('span', null, 'Price: ', raffle.price, ' SOL'),
                            React.createElement('span', null, 'Sold: ', raffle.sold, '/', raffle.supply)
                          ),
                          React.createElement('div', { className: 'raffle-item-times' },
                            React.createElement('div', { className: 'raffle-time-row' },
                              React.createElement('span', { className: 'time-label' }, 'Time Left: '),
                              React.createElement(CountdownTimer, { 
                            endsAt: raffle.endsAt,
                            onEnd: () => setTimeout(fetchRaffles, 2000)
                          })
                            )
                          ),
                          React.createElement('button', { className: 'raffle-btn-buy', disabled: true }, 'You are Creator')
                        )
                      )
                    )
                  )
                ))
              )
            ) : (
              React.createElement('div', { className: 'raffle-empty-state' },
                React.createElement('span', { className: 'empty-icon' }, '🔍'),
                React.createElement('h3', null, 'No Activity Found'),
                React.createElement('p', null, 'You haven\'t created or entered any raffles yet.')
              )
            )
          )
        ) : (
          React.createElement('div', { className: 'raffle-content' },
            React.createElement('div', { className: 'raffle-grid' },
              React.createElement('aside', { className: 'raffle-sidebar' },
                React.createElement('div', { 
                  className: `raffle-prize-card nft-prize ${selectedNft ? 'has-selected' : ''}`,
                  onClick: () => { if (!selectedNft) fetchWalletNfts(); }
                },
                  selectedNft ? (
                    React.createElement('div', { className: 'raffle-selected-nft' },
                      React.createElement('div', { className: 'prize-type-header' }, 'SELECTED NFT'),
                      React.createElement('img', { src: selectedNft.image, alt: selectedNft.name }),
                      React.createElement('div', { className: 'selected-nft-info' },
                        React.createElement('span', null, selectedNft.name),
                        React.createElement('div', { className: 'prize-action-buttons' },
                          React.createElement('button', { 
                            className: 'change-nft-btn',
                            onClick: (e) => { e.stopPropagation(); fetchWalletNfts(); }
                          }, 'Change'),
                          React.createElement('button', {
                            className: 'remove-prize-btn',
                            onClick: (e) => { e.stopPropagation(); setSelectedNft(null); }
                          }, '×')
                        )
                      )
                    )
                  ) : (
                    React.createElement('div', { className: 'raffle-prize-add' },
                      React.createElement('span', { className: 'raffle-plus-icon' }, '+'),
                      React.createElement('h3', null, 'Add an NFT prize')
                    )
                  )
                ),
                React.createElement('div', { 
                  className: `raffle-prize-card token-prize ${selectedToken ? 'has-selected' : ''}`,
                  style: { marginTop: '15px' },
                  onClick: () => { if (!selectedToken) fetchWalletTokens(); }
                },
                  selectedToken ? (
                    React.createElement('div', { className: 'raffle-selected-nft' },
                      React.createElement('div', { className: 'prize-type-header token' }, 'SELECTED TOKEN'),
                      React.createElement('div', { className: 'token-prize-display' },
                        selectedToken.image && React.createElement('img', { 
                          src: selectedToken.image, 
                          alt: selectedToken.symbol, 
                          className: 'sidebar-token-icon' 
                        }),
                        React.createElement('span', { className: 'token-prize-amount' }, tokenAmount ? Number(tokenAmount).toLocaleString() : '0'),
                        React.createElement('span', { className: 'token-prize-symbol' }, selectedToken.symbol)
                      ),
                      React.createElement('div', { className: 'selected-nft-info' },
                        React.createElement('input', {
                          type: 'number',
                          placeholder: 'Amount',
                          className: 'token-amount-input',
                          value: tokenAmount,
                          onClick: (e) => e.stopPropagation(),
                          onChange: (e) => setTokenAmount(e.target.value)
                        }),
                        React.createElement('div', { className: 'prize-action-buttons' },
                          React.createElement('button', { 
                            className: 'change-nft-btn',
                            onClick: (e) => { e.stopPropagation(); fetchWalletTokens(); }
                          }, 'Change'),
                          React.createElement('button', {
                            className: 'remove-prize-btn',
                            onClick: (e) => { e.stopPropagation(); setSelectedToken(null); setTokenAmount(''); }
                          }, '×')
                        )
                      )
                    )
                  ) : (
                    React.createElement('div', { className: 'raffle-prize-add' },
                      React.createElement('span', { className: 'raffle-plus-icon' }, '+'),
                      React.createElement('h3', null, 'Add a token prize')
                    )
                  )
                )
              ),
              React.createElement('section', { className: 'raffle-main-form' },
                React.createElement('h1', { className: 'raffle-form-title' }, 'New Raffle'),
                React.createElement('div', { className: 'raffle-form-fields' },
                  React.createElement('div', { className: 'raffle-field' },
                    React.createElement('div', { className: 'raffle-field-header' },
                      React.createElement('label', null, 'Raffle end date')
                    ),
                    React.createElement('div', { className: 'raffle-date-input' },
                      React.createElement('input', { 
                        type: 'datetime-local',
                        value: endDate,
                        onChange: (e) => setEndDate(e.target.value)
                      })
                    ),
                    React.createElement('div', { className: 'raffle-quick-dates' },
                      [24, 36, 48].map(hours => React.createElement('button', { 
                        key: hours, 
                        className: 'raffle-date-btn',
                        onClick: () => setQuickDate(hours)
                      }, `${hours}hr`))
                    )
                  ),
                  React.createElement('div', { className: 'raffle-field' },
                    React.createElement('div', { className: 'raffle-field-header' },
                      React.createElement('label', null, 'Ticket Supply'),
                      React.createElement('span', { className: 'raffle-field-limit' }, 'Min: 3 / Max: 10,000')
                    ),
                    React.createElement('input', { 
                      type: 'number', 
                      className: `raffle-input-dark ${ticketSupply !== '' && parseInt(ticketSupply) < 3 ? 'input-error' : ''}`,
                      value: ticketSupply,
                      onChange: (e) => setTicketSupply(e.target.value)
                    }),
                    React.createElement('div', { className: 'raffle-rent-indicator' }, `Rent: ${rentAmount} SOL`)
                  ),
                  React.createElement('div', { className: 'raffle-field' },
                    React.createElement('div', { className: 'raffle-field-header' },
                      React.createElement('label', null, 'Ticket Price')
                    ),
                    React.createElement('div', { className: 'raffle-price-input' },
                      React.createElement('input', { 
                        type: 'number', 
                        step: '0.01',
                        min: '0',
                        placeholder: '0.00',
                        value: ticketPrice,
                        onChange: (e) => setTicketPrice(e.target.value)
                      }),
                      React.createElement('select', { 
                        className: 'raffle-currency-select',
                        value: paymentCurrency,
                        onChange: (e) => setPaymentCurrency(e.target.value)
                      },
                        React.createElement('option', { value: 'SOL' }, 'SOL'),
                        React.createElement('option', { value: 'NTZ' }, 'NTZ')
                      )
                    )
                  )
                ),
                React.createElement('div', { className: 'raffle-additional-settings' },
                  React.createElement('div', { className: 'advanced-row' },
                    React.createElement('div', { className: 'advanced-label-group' },
                      React.createElement('label', null, 'Holder only mode (+1 SOL charge)')
                    ),
                    React.createElement('div', { className: 'collection-input-wrap' },
                      collections.map((col, idx) => (
                        React.createElement('div', { key: idx, className: 'collection-row' },
                          React.createElement('input', { 
                            type: 'text', 
                            className: 'advanced-input', 
                            placeholder: 'Enter collection key or first creator address',
                            value: col,
                            onChange: (e) => handleCollectionChange(idx, e.target.value)
                          }),
                          collections.length > 1 && React.createElement('button', {
                            className: 'remove-collection-btn',
                            onClick: () => handleRemoveCollection(idx)
                          }, '×')
                        )
                      )),
                      React.createElement('button', { 
                        className: 'add-collection-btn',
                        onClick: () => setCollections([...collections, ''])
                      }, '+ add another collection')
                    )
                  ),
                  React.createElement('div', { className: 'advanced-grid' },
                    React.createElement('div', { className: 'advanced-field' },
                      React.createElement('label', null, 'Ticket limit per wallet'),
                      React.createElement('input', { 
                        type: 'number', 
                        className: 'advanced-input no-spinners', 
                        value: ticketLimit,
                        placeholder: '1',
                        onChange: (e) => setTicketLimit(e.target.value)
                      }),
                      React.createElement('div', { className: 'raffle-quick-dates', style: { marginTop: '10px' } },
                        ['2', '5', '10', '15', '20'].map(val => React.createElement('button', { 
                          key: val, 
                          className: 'raffle-date-btn',
                          onClick: () => setTicketLimit(val)
                        }, val))
                      ),
                      React.createElement('p', { className: 'field-sub' }, 'Default is set to 1 ticket per wallet')
                    ),
                    React.createElement('div', { className: 'advanced-field' },
                      React.createElement('div', { className: 'label-with-limit' },
                        React.createElement('label', null, 'Number of winners')
                      ),
                      React.createElement('div', { className: 'advanced-input static-field' }, '1')
                    )
                  )
                ),
                React.createElement('div', { className: 'raffle-action-row' },
                  React.createElement('div', { className: 'raffle-balance-info' }, 
                    publicKey 
                      ? (paymentCurrency === 'SOL' ? `Your balance: ${balance.toFixed(2)} SOL` : `Your balance: ${ntzBalance.toLocaleString()} NTZ`)
                      : 'Connect wallet to see balance'
                  ),
                  React.createElement('div', { className: 'raffle-submit-group' },
                    React.createElement('label', { className: 'raffle-checkbox-label' },
                      React.createElement('input', { 
                        type: 'checkbox',
                        checked: agreeToTerms,
                        onChange: (e) => setAgreeToTerms(e.target.checked)
                      }),
                      React.createElement('span', { className: 'raffle-checkbox-custom' }),
                      React.createElement('span', null, 'I agree to the Terms & Conditions')
                    ),
                    React.createElement('button', { 
                      className: 'raffle-btn-create',
                      onClick: handleCreateRaffle,
                      disabled: isCreating
                    }, isCreating ? React.createElement('div', { className: 'raffle-spinner' }) : 'Create raffle')
                  )
                ),
                React.createElement('div', { className: 'raffle-terms' },
                  React.createElement('h4', null, 'Terms & Conditions'),
                  React.createElement('ol', null,
                    [
                      'When you create a raffle, the NFT prize you have chosen will be transferred from your wallet into an escrow wallet.',
                      'You will be charged an up-front rent fee, in SOL, which will be taken in proportion to the number of tickets you choose to raffle, with a maximum rent fee of 2.2 SOL. The rent fee will be automatically refunded after the raffle concludes.',
                      'You can specify the amount of time a raffle runs at the creation of the raffle. Raffles require a minimum 24 hour run time.',
                      'Raffle will take a 4.75% commission fee from the ticket sales.'
                    ].map((term, i) => React.createElement('li', { key: i }, term))
                  )
                )
              )
            )
          )
        )
      )
    )
  );
}

function RaffleApp() {
  return React.createElement(SolanaProvider, null, React.createElement(RaffleAppInner));
}

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(React.createElement(RaffleApp));
}
