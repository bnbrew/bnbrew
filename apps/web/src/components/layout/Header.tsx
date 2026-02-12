'use client';

import Link from 'next/link';
import { Coffee } from 'lucide-react';

interface HeaderProps {
  onConnectWallet?: () => void;
  walletAddress?: string;
}

export default function Header({ onConnectWallet, walletAddress }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-bnb-border/50 bg-bnb-dark/80 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5">
            <Coffee className="w-6 h-6 text-bnb-yellow" />
            <span className="text-xl font-bold text-bnb-light tracking-tight">BNBrew</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-bnb-gray hover:text-bnb-light transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-bnb-gray hover:text-bnb-light transition-colors">
              How it Works
            </a>
            <a
              href="https://docs.bnbchain.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-bnb-gray hover:text-bnb-light transition-colors"
            >
              Docs
            </a>
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {walletAddress ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-bnb-card border border-bnb-border rounded-full">
              <div className="w-2 h-2 rounded-full bg-bnb-success" />
              <span className="text-sm text-bnb-gray font-mono">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            </div>
          ) : (
            <button
              onClick={onConnectWallet}
              className="px-5 py-2.5 bg-bnb-yellow text-bnb-dark text-sm font-semibold rounded-full hover:bg-bnb-yellow-hover transition-colors cursor-pointer"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
