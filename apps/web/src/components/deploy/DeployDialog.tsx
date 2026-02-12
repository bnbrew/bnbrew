'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface DeployDialogProps {
  open: boolean;
  onClose: () => void;
  appSpec: any;
  contractFiles: Array<{ name: string; source: string }>;
  previewFiles: Record<string, string>;
  walletAddress: string | undefined;
}

type DeployStage = 'confirm' | 'deploying' | 'success' | 'error';

interface PipelineEvent {
  status: string;
  message: string;
  elapsed: number;
}

interface DeployedContract {
  name: string;
  proxyAddress: string;
  implAddress: string;
}

const EXPLORER_URL = 'https://opbnb-testnet.bscscan.com/address';

const PIPELINE_STEPS = [
  { status: 'COMPILING', label: 'Compiling contracts' },
  { status: 'DEPLOYING_CONTRACTS', label: 'Deploying to opBNB' },
  { status: 'GENERATING_FRONTEND', label: 'Building frontend' },
  { status: 'UPLOADING_FRONTEND', label: 'Uploading to Greenfield' },
  { status: 'CONFIGURING_ACL', label: 'Configuring storage' },
  { status: 'REGISTERING', label: 'Registering app' },
  { status: 'VERIFYING', label: 'Verifying deployment' },
];

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function DeployDialog({
  open,
  onClose,
  appSpec,
  contractFiles,
  previewFiles,
  walletAddress,
}: DeployDialogProps) {
  const [stage, setStage] = useState<DeployStage>('confirm');
  const [currentStatus, setCurrentStatus] = useState<string>('PENDING');
  const [statusMessage, setStatusMessage] = useState('');
  const [deployedApp, setDeployedApp] = useState<any>(null);
  const [deployedContracts, setDeployedContracts] = useState<DeployedContract[]>([]);
  const [error, setError] = useState<string>('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const stageRef = useRef<DeployStage>('confirm');

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStage('confirm');
      setCurrentStatus('PENDING');
      setStatusMessage('');
      setDeployedApp(null);
      setDeployedContracts([]);
      setError('');
    }
    return () => {
      eventSourceRef.current?.close();
    };
  }, [open]);

  const handleDeploy = useCallback(async () => {
    if (!walletAddress) return;

    setStage('deploying');
    setCurrentStatus('PENDING');

    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appSpec,
          ownerAddress: walletAddress,
          contractSources: contractFiles,
          previewFiles,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Deploy request failed' }));
        throw new Error(data.error || 'Deploy request failed');
      }

      const { appId, streamUrl } = await res.json();

      // Connect to SSE for status updates (via Next.js proxy to avoid CORS)
      const es = new EventSource(`/api/deploy/status/${appId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data: PipelineEvent = JSON.parse(event.data);

          if (data.status === 'CONTRACTS_DEPLOYED') {
            try {
              const contracts: DeployedContract[] = JSON.parse(data.message);
              setDeployedContracts(contracts);
            } catch {}
            return;
          }

          setCurrentStatus(data.status);
          setStatusMessage(data.message);

          if (data.status === 'LIVE') {
            try {
              const app = JSON.parse(data.message);
              setDeployedApp(app);
            } catch {
              setDeployedApp({ frontendUrl: '' });
            }
            setStage('success');
            es.close();
          } else if (data.status === 'FAILED') {
            setError(data.message);
            setStage('error');
            es.close();
          }
        } catch {
          // skip malformed events
        }
      };

      es.onerror = () => {
        if (stageRef.current === 'deploying') {
          setError('Lost connection to deployment server');
          setStage('error');
        }
        es.close();
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deploy failed');
      setStage('error');
    }
  }, [appSpec, walletAddress, contractFiles, previewFiles]);

  if (!open) return null;

  const completedIndex = PIPELINE_STEPS.findIndex((s) => s.status === currentStatus);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bnb-card border border-bnb-border rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-bnb-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-bnb-light">
            {stage === 'confirm' && 'Deploy to BNB Chain'}
            {stage === 'deploying' && 'Deploying...'}
            {stage === 'success' && 'Deployed!'}
            {stage === 'error' && 'Deployment Failed'}
          </h2>
          {stage !== 'deploying' && (
            <button
              onClick={onClose}
              className="text-bnb-gray hover:text-bnb-light text-xl cursor-pointer leading-none"
            >
              &times;
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* CONFIRM */}
          {stage === 'confirm' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-bnb-gray">This will deploy:</p>
                <ul className="text-sm text-bnb-light space-y-1 ml-4">
                  {contractFiles.map((c) => (
                    <li key={c.name}>
                      Contract: <span className="font-mono text-bnb-yellow">{c.name}</span>
                    </li>
                  ))}
                  <li>
                    Frontend: <span className="text-bnb-gray">{Object.keys(previewFiles).length} files</span> to Greenfield
                  </li>
                </ul>
              </div>

              <div className="bg-bnb-dark rounded-lg p-3 text-xs text-bnb-gray space-y-1">
                <p>Network: <span className="text-bnb-light">opBNB Testnet</span></p>
                <p>
                  Owner:{' '}
                  <span className="font-mono text-bnb-light">
                    {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
                  </span>
                </p>
                <p>Gas paid by: <span className="text-bnb-light">BNBrew platform</span></p>
              </div>

              {!walletAddress && (
                <p className="text-sm text-red-400">Connect your wallet first to set contract ownership.</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-bnb-border rounded-xl text-sm text-bnb-gray hover:text-bnb-light transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={!walletAddress}
                  className="flex-1 px-4 py-2.5 bg-bnb-yellow text-bnb-dark text-sm font-semibold rounded-xl hover:bg-bnb-yellow-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Deploy Now
                </button>
              </div>
            </div>
          )}

          {/* DEPLOYING */}
          {stage === 'deploying' && (
            <div className="space-y-3">
              {PIPELINE_STEPS.map((step, idx) => {
                const isActive = step.status === currentStatus;
                const isComplete = completedIndex > idx;
                const isPending = completedIndex < idx;
                const showContracts = step.status === 'DEPLOYING_CONTRACTS' && deployedContracts.length > 0 && (isComplete || isActive);
                return (
                  <div key={step.status}>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 flex items-center justify-center">
                        {isComplete && (
                          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {isActive && (
                          <div className="w-5 h-5 border-2 border-bnb-yellow border-t-transparent rounded-full animate-spin" />
                        )}
                        {isPending && (
                          <div className="w-3 h-3 rounded-full border border-bnb-border" />
                        )}
                      </div>
                      <span
                        className={`text-sm ${
                          isActive
                            ? 'text-bnb-yellow font-medium'
                            : isComplete
                              ? 'text-green-500'
                              : 'text-bnb-gray'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {/* Contract address sub-items */}
                    {showContracts && (
                      <div className="ml-9 mt-1.5 space-y-1.5">
                        {deployedContracts.map((c) => (
                          <div key={c.name} className="text-xs space-y-0.5">
                            <span className="text-bnb-gray">{c.name}</span>
                            <div className="flex items-center gap-3 ml-2">
                              <a
                                href={`${EXPLORER_URL}/${c.proxyAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-bnb-yellow hover:underline"
                              >
                                Proxy: {shortenAddr(c.proxyAddress)}
                              </a>
                              <a
                                href={`${EXPLORER_URL}/${c.implAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-bnb-gray hover:text-bnb-light hover:underline"
                              >
                                Impl: {shortenAddr(c.implAddress)}
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {statusMessage && currentStatus !== 'CONTRACTS_DEPLOYED' && (
                <p className="text-xs text-bnb-gray mt-3 italic">{statusMessage}</p>
              )}
            </div>
          )}

          {/* SUCCESS */}
          {stage === 'success' && deployedApp && (
            <div className="space-y-4 text-center">
              <div>
                <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-semibold text-bnb-light">Your app is live!</p>
              </div>

              {deployedApp.frontendUrl && (
                <a
                  href={deployedApp.frontendUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-bnb-yellow text-bnb-dark text-sm font-semibold rounded-xl hover:bg-bnb-yellow-hover transition-colors"
                >
                  Open App &rarr;
                </a>
              )}

              {deployedContracts.length > 0 && (
                <div className="bg-bnb-dark rounded-lg p-3 text-left text-xs space-y-2">
                  <p className="text-bnb-gray font-medium">Deployed Contracts:</p>
                  {deployedContracts.map((c) => (
                    <div key={c.name} className="space-y-0.5">
                      <span className="text-bnb-light">{c.name}</span>
                      <div className="flex items-center gap-3 ml-2">
                        <a
                          href={`${EXPLORER_URL}/${c.proxyAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-bnb-yellow hover:underline"
                        >
                          Proxy: {shortenAddr(c.proxyAddress)}
                        </a>
                        <a
                          href={`${EXPLORER_URL}/${c.implAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-bnb-gray hover:text-bnb-light hover:underline"
                        >
                          Impl: {shortenAddr(c.implAddress)}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={onClose}
                className="px-6 py-2 border border-bnb-border rounded-xl text-sm text-bnb-gray hover:text-bnb-light transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          )}

          {/* ERROR */}
          {stage === 'error' && (
            <div className="space-y-4 text-center">
              <svg className="w-12 h-12 text-red-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-400">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-bnb-border rounded-xl text-sm text-bnb-gray cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleDeploy}
                  className="flex-1 px-4 py-2.5 bg-bnb-yellow text-bnb-dark text-sm font-semibold rounded-xl cursor-pointer"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
