'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Lock, Shield, Rocket, RefreshCw, Globe } from 'lucide-react';
import Header from '../components/layout/Header';

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');

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

  const handleStartBuilding = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (prompt.trim()) {
        router.push(`/build?prompt=${encodeURIComponent(prompt.trim())}`);
      } else {
        router.push('/build');
      }
    } catch {
      console.error('Wallet connection failed');
    }
  };

  return (
    <>
      <Header onConnectWallet={connectWallet} />

      <main className="min-h-screen pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Large geometric shapes like BNB site */}
            <div className="absolute -left-32 top-1/4 w-96 h-96 bg-bnb-card/40 rounded-3xl rotate-12 blur-sm" />
            <div className="absolute -right-24 top-1/3 w-80 h-80 bg-bnb-card/30 rounded-3xl -rotate-12 blur-sm" />
            <div className="absolute right-48 top-20 w-48 h-48 bg-bnb-card/20 rounded-2xl rotate-45" />
            {/* Dot grid */}
            <div className="absolute left-16 bottom-48 grid grid-cols-5 gap-2 opacity-20">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-bnb-gray" />
              ))}
            </div>
            <div className="absolute right-32 top-32 grid grid-cols-5 gap-2 opacity-20">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-bnb-gray" />
              ))}
            </div>
          </div>

          <div className="relative max-w-[1400px] mx-auto px-6 pt-32 pb-20">
            <div className="text-center max-w-3xl mx-auto">
              {/* Headline */}
              <h1 className="text-6xl md:text-7xl font-bold leading-tight tracking-tight">
                <span className="text-bnb-yellow">Build Onchain.</span>
                <br />
                <span className="text-bnb-light">Ship with AI.</span>
              </h1>

              {/* Prompt Bar */}
              <div className="mt-10 max-w-2xl mx-auto">
                <div className="flex items-center gap-2 bg-bnb-card/80 border border-bnb-border rounded-full pl-6 pr-2 py-2 backdrop-blur-sm">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStartBuilding()}
                    placeholder="A tipping page for my podcast with BNB payments..."
                    className="flex-1 bg-transparent text-sm text-bnb-light placeholder-bnb-gray/60 focus:outline-none"
                  />
                  <button
                    onClick={handleStartBuilding}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-bnb-yellow/10 border border-bnb-yellow/30 text-bnb-yellow text-sm font-medium rounded-full hover:bg-bnb-yellow/20 transition-colors cursor-pointer"
                  >
                    Build
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                  </button>
                </div>
              </div>

              <p className="mt-6 text-lg text-bnb-gray max-w-xl mx-auto leading-relaxed">
                Describe your app in plain English. BNBrew generates smart contracts,
                builds the frontend, and deploys everything to <span className="text-bnb-yellow">BNB Chain</span>.
              </p>
            </div>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="border-t border-b border-bnb-border/50">
          <div className="max-w-[1400px] mx-auto px-6 py-10">
            <div className="grid grid-cols-3 gap-8">
              {[
                { value: 'opBNB', label: 'L2 Deployment' },
                { value: 'Greenfield', label: 'Decentralized Hosting' },
                { value: 'ECIES', label: 'End-to-End Encryption' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold text-bnb-light">{stat.value}</div>
                  <div className="text-sm text-bnb-gray mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-24">
          <div className="max-w-[1400px] mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-16">
              <span className="text-bnb-yellow">Three Steps.</span>{' '}
              <span className="text-bnb-light">That&apos;s It.</span>
            </h2>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                {
                  step: '01',
                  title: 'Describe',
                  description: 'Tell the AI what you want to build. A booking system, a tipping page, a contact form — anything.',
                },
                {
                  step: '02',
                  title: 'Iterate',
                  description: 'Preview your app in real-time. Chat with the AI to refine it. Change colors, add features, tweak logic.',
                },
                {
                  step: '03',
                  title: 'Deploy',
                  description: 'One click. Smart contracts go to opBNB, frontend goes to Greenfield. Your app is live and onchain.',
                },
              ].map((item) => (
                <div key={item.step} className="relative p-6 rounded-2xl bg-bnb-card/50 border border-bnb-border/50">
                  <div className="text-5xl font-bold text-bnb-yellow/10 absolute top-4 right-6">
                    {item.step}
                  </div>
                  <div className="relative">
                    <h3 className="text-xl font-semibold text-bnb-light mb-3">{item.title}</h3>
                    <p className="text-sm text-bnb-gray leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 border-t border-bnb-border/50">
          <div className="max-w-[1400px] mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-16">
              <span className="text-bnb-light">Everything You Need.</span>{' '}
              <span className="text-bnb-yellow">Nothing You Don&apos;t.</span>
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                {
                  icon: <Zap className="w-6 h-6" />,
                  title: 'AI-Powered Generation',
                  description: 'Smart contracts and frontends generated from natural language using Claude.',
                },
                {
                  icon: <Lock className="w-6 h-6" />,
                  title: 'Encrypted Data Storage',
                  description: 'End-user data is encrypted client-side. Only the app owner can decrypt.',
                },
                {
                  icon: <Shield className="w-6 h-6" />,
                  title: 'Walletless End Users',
                  description: 'Your users never need a wallet or gas. The relay handles everything.',
                },
                {
                  icon: <Rocket className="w-6 h-6" />,
                  title: 'One-Click Deploy',
                  description: 'Contracts to opBNB, frontend to Greenfield. Fully onchain in seconds.',
                },
                {
                  icon: <RefreshCw className="w-6 h-6" />,
                  title: 'Upgradeable Contracts',
                  description: 'UUPS proxy pattern. Ship now, upgrade later without losing state.',
                },
                {
                  icon: <Globe className="w-6 h-6" />,
                  title: '.bnb Domain',
                  description: 'Get a human-readable SPACE ID subdomain for your app.',
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="p-6 rounded-2xl bg-bnb-card/30 border border-bnb-border/30 hover:border-bnb-yellow/20 transition-colors"
                >
                  <div className="text-bnb-yellow mb-3">{feature.icon}</div>
                  <h3 className="text-base font-semibold text-bnb-light mb-2">{feature.title}</h3>
                  <p className="text-sm text-bnb-gray leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="py-24 border-t border-bnb-border/50">
          <div className="max-w-[1400px] mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-bnb-light mb-4">Ready to Build?</h2>
            <p className="text-bnb-gray mb-8 max-w-md mx-auto">
              Connect your wallet and start creating onchain apps in minutes.
            </p>
            <button
              onClick={connectWallet}
              className="inline-flex items-center gap-2 px-8 py-4 bg-bnb-yellow text-bnb-dark font-semibold rounded-xl hover:bg-bnb-yellow-hover transition-all cursor-pointer text-lg"
            >
              Connect Wallet
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-bnb-border/50 py-8">
          <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between">
            <span className="text-sm text-bnb-gray">Built on BNB Chain</span>
            <div className="flex items-center gap-6">
              <a href="https://github.com/bnbrew" target="_blank" rel="noopener noreferrer" className="text-sm text-bnb-gray hover:text-bnb-light transition-colors">
                GitHub
              </a>
              <a href="https://docs.bnbchain.org" target="_blank" rel="noopener noreferrer" className="text-sm text-bnb-gray hover:text-bnb-light transition-colors">
                BNB Docs
              </a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
