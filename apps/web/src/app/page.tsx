'use client';

import { useState } from 'react';

export default function Home() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [address, setAddress] = useState('');

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      setAddress(accounts[0]);
      setWalletConnected(true);
    } catch {
      console.error('Wallet connection failed');
    }
  };

  if (walletConnected) {
    return (
      <div className="h-screen flex flex-col">
        <header className="h-14 border-b border-bnb-border flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="text-bnb-yellow font-bold text-xl">BNBrew</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-bnb-gray font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
            <div className="w-2 h-2 rounded-full bg-bnb-success" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center text-bnb-gray">
          <p>Chat interface loading...</p>
        </main>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold">
          <span className="text-bnb-yellow">BNBrew</span>
        </h1>
        <p className="text-xl text-bnb-gray max-w-lg">
          Build and deploy onchain apps on BNB Chain with AI.
          Just describe what you want.
        </p>
      </div>

      <button
        onClick={connectWallet}
        className="px-8 py-3 bg-bnb-yellow text-bnb-dark font-semibold rounded-lg hover:bg-bnb-yellow-hover transition-colors cursor-pointer"
      >
        Connect Wallet to Start
      </button>

      <p className="text-sm text-bnb-gray">
        Connect your wallet to start building. You&apos;ll be the owner of everything you create.
      </p>
    </main>
  );
}
