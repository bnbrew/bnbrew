/**
 * Admin Dashboard Template
 *
 * Injected into generated apps at /admin route.
 * Requires wallet connection — only the app owner can access.
 * Provides decryption of private data stored on Greenfield.
 */

export const ADMIN_DASHBOARD_TEMPLATE = `
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { decryptAsOwner } from './helpers/ecies';
import config from './config.json';

interface Submission {
  id: string;
  objectName: string;
  timestamp: number;
  decrypted?: string;
  isDecrypting?: boolean;
}

export default function AdminDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [address, setAddress] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  async function checkWalletConnection() {
    if (!window.ethereum) {
      setIsLoading(false);
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
        setIsOwner(accounts[0].toLowerCase() === config.ownerAddress.toLowerCase());
        if (accounts[0].toLowerCase() === config.ownerAddress.toLowerCase()) {
          await loadSubmissions();
        }
      }
    } catch (err) {
      console.error('Connection check failed:', err);
    }
    setIsLoading(false);
  }

  async function connectWallet() {
    if (!window.ethereum) {
      alert('Please install MetaMask');
      return;
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setAddress(accounts[0]);
    setIsConnected(true);
    setIsOwner(accounts[0].toLowerCase() === config.ownerAddress.toLowerCase());
  }

  async function loadSubmissions() {
    try {
      const response = await fetch(
        config.relayEndpoint + '/api/v1/submissions/' + config.appId,
        {
          headers: { 'X-BNBrew-App': config.appId },
        },
      );
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error('Failed to load submissions:', err);
    }
  }

  async function decryptSubmission(submission: Submission) {
    setSubmissions(prev =>
      prev.map(s => s.id === submission.id ? { ...s, isDecrypting: true } : s),
    );

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Download encrypted data
      const response = await fetch(
        config.relayEndpoint + '/api/v1/data/' + config.appId + '/' + submission.objectName,
        {
          headers: { 'X-BNBrew-App': config.appId },
        },
      );
      const encryptedHex = await response.text();

      // Decrypt using wallet signature
      const decrypted = await decryptAsOwner(encryptedHex, signer);

      setSubmissions(prev =>
        prev.map(s => s.id === submission.id ? { ...s, decrypted, isDecrypting: false } : s),
      );
    } catch (err) {
      console.error('Decryption failed:', err);
      setSubmissions(prev =>
        prev.map(s => s.id === submission.id ? { ...s, isDecrypting: false } : s),
      );
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-400">Connect your wallet to access the dashboard</p>
        <button
          onClick={connectWallet}
          className="px-6 py-3 bg-yellow-400 text-gray-900 font-semibold rounded-lg hover:bg-yellow-300"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-red-400">Access Denied</h1>
        <p className="text-gray-400">Only the app owner can access this dashboard</p>
        <p className="text-sm text-gray-500 font-mono">{address}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">{submissions.length} submissions</p>
          </div>
          <button
            onClick={loadSubmissions}
            className="px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800"
          >
            Refresh
          </button>
        </div>

        <div className="space-y-4">
          {submissions.map((submission) => (
            <div key={submission.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-mono">{submission.objectName}</span>
                <span className="text-xs text-gray-500">
                  {new Date(submission.timestamp).toLocaleString()}
                </span>
              </div>

              {submission.decrypted ? (
                <div className="mt-3 p-3 bg-gray-800 rounded-lg">
                  <pre className="text-sm text-gray-200 whitespace-pre-wrap">
                    {submission.decrypted}
                  </pre>
                </div>
              ) : (
                <button
                  onClick={() => decryptSubmission(submission)}
                  disabled={submission.isDecrypting}
                  className="mt-2 px-4 py-2 bg-yellow-400 text-gray-900 text-sm font-medium rounded-lg hover:bg-yellow-300 disabled:opacity-50"
                >
                  {submission.isDecrypting ? 'Decrypting...' : 'Decrypt & View'}
                </button>
              )}
            </div>
          ))}

          {submissions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No submissions yet. Share your app to start receiving data.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;
