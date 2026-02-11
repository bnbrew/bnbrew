'use client';

import { useState } from 'react';

interface DecryptionFlowProps {
  encryptedData: string;
  onDecrypted: (plaintext: string) => void;
}

/**
 * Wallet-based decryption flow.
 * Guides the app owner through signing a message to derive
 * the decryption key, then decrypts the data client-side.
 */
export default function DecryptionFlow({ encryptedData, onDecrypted }: DecryptionFlowProps) {
  const [step, setStep] = useState<'idle' | 'signing' | 'decrypting' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string>();

  const handleDecrypt = async () => {
    if (typeof window.ethereum === 'undefined') {
      setError('No wallet detected');
      setStep('error');
      return;
    }

    try {
      setStep('signing');

      // Request signature from wallet
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length === 0) {
        setError('Please connect your wallet first');
        setStep('error');
        return;
      }

      // Sign the decryption authorization message
      const message = 'BNBrew: Authorize data decryption';
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, accounts[0]],
      });

      setStep('decrypting');

      // In production, this calls the browser ECIES module
      // For now, send to API for server-side decryption verification
      const response = await fetch('/api/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedData,
          signature: signature[0],
          address: accounts[0],
        }),
      });

      if (!response.ok) {
        throw new Error('Decryption failed');
      }

      const { plaintext } = await response.json();
      onDecrypted(plaintext);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decryption failed');
      setStep('error');
    }
  };

  return (
    <div className="space-y-3">
      {step === 'idle' && (
        <button
          onClick={handleDecrypt}
          className="px-4 py-2 bg-bnb-yellow text-bnb-dark text-sm font-semibold rounded-lg hover:bg-bnb-yellow-hover transition-colors cursor-pointer"
        >
          Decrypt with Wallet
        </button>
      )}

      {step === 'signing' && (
        <div className="flex items-center gap-2 text-sm text-bnb-gray">
          <div className="w-4 h-4 border-2 border-bnb-yellow border-t-transparent rounded-full animate-spin" />
          <span>Please sign the message in your wallet...</span>
        </div>
      )}

      {step === 'decrypting' && (
        <div className="flex items-center gap-2 text-sm text-bnb-gray">
          <div className="w-4 h-4 border-2 border-bnb-yellow border-t-transparent rounded-full animate-spin" />
          <span>Decrypting data...</span>
        </div>
      )}

      {step === 'done' && (
        <div className="flex items-center gap-2 text-sm text-bnb-success">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Data decrypted successfully</span>
        </div>
      )}

      {step === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-bnb-error">{error}</p>
          <button
            onClick={() => { setStep('idle'); setError(undefined); }}
            className="text-sm text-bnb-gray hover:text-bnb-light cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
