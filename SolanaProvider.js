import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from 'https://esm.sh/@solana/wallet-adapter-react?deps=react@18';
import { WalletAdapterNetwork } from 'https://esm.sh/@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from 'https://esm.sh/@solana/wallet-adapter-wallets';
import { WalletModalProvider } from 'https://esm.sh/@solana/wallet-adapter-react-ui?deps=react@18';
import { clusterApiUrl } from 'https://esm.sh/@solana/web3.js';

// Replace this with your actual Helius API key
const HELIUS_API_KEY = "ac2b3c74-327a-4090-b0f7-317731507008";

export const SolanaProvider = ({ children }) => {
    const network = WalletAdapterNetwork.Mainnet;
    
    // Use Helius RPC for production, but fallback to public RPC for localhost testing
    const endpoint = useMemo(() => {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isLocal) {
            console.log("Local development detected: Using public Solana RPC");
            return "https://api.mainnet-beta.solana.com";
        }

        // Use environment variable if available (e.g. on Vercel), otherwise fallback to hardcoded key
        const apiKey = (typeof process !== 'undefined' && process.env?.VITE_HELIUS_API_KEY) || HELIUS_API_KEY;

        return apiKey && apiKey !== "YOUR_HELIUS_API_KEY_HERE" 
            ? `https://mainnet.helius-rpc.com/?api-key=${apiKey}`
            : "https://api.mainnet-beta.solana.com";
    }, []);

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        []
    );

    return React.createElement(ConnectionProvider, { endpoint },
        React.createElement(WalletProvider, { wallets, autoConnect: true },
            React.createElement(WalletModalProvider, null, children)
        )
    );
};
