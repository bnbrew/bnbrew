'use client';

import { useWallet } from '../../hooks/useWallet';

export default function WalletButton() {
  const { isConnected, address, isCorrectChain, connect, disconnect, switchToOpBNB } = useWallet();

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        className="px-4 py-2 bg-bnb-yellow text-bnb-dark text-sm font-semibold rounded-lg hover:bg-bnb-yellow-hover transition-colors cursor-pointer"
      >
        Connect Wallet
      </button>
    );
  }

  if (!isCorrectChain) {
    return (
      <button
        onClick={switchToOpBNB}
        className="px-4 py-2 bg-bnb-error/20 border border-bnb-error text-bnb-error text-sm font-medium rounded-lg hover:bg-bnb-error/30 transition-colors cursor-pointer"
      >
        Switch to opBNB
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-2 bg-bnb-card border border-bnb-border rounded-lg">
        <div className="w-2 h-2 rounded-full bg-bnb-success" />
        <span className="text-sm text-bnb-gray font-mono">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
      </div>
      <button
        onClick={disconnect}
        className="p-2 text-bnb-gray hover:text-bnb-light transition-colors cursor-pointer"
        title="Disconnect"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
}
