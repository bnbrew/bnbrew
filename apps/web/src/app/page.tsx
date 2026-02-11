'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    try {
      await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      router.push('/build');
    } catch {
      console.error('Wallet connection failed');
    }
  };

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
