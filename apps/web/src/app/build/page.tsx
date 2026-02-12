'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Coffee } from 'lucide-react';
import ChatPanel, { type ChatMessage } from '../../components/chat/ChatPanel';
import PreviewPanel from '../../components/preview/PreviewPanel';
import DeployDialog from '../../components/deploy/DeployDialog';

interface ContractFile {
  name: string;
  source: string;
}

function generateSessionId(): string {
  return 'sess-' + crypto.randomUUID();
}

export default function BuildPage() {
  return (
    <Suspense>
      <BuildPageInner />
    </Suspense>
  );
}

function BuildPageInner() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Record<string, string>>({});
  const [contractFiles, setContractFiles] = useState<ContractFile[]>([]);
  const [streamingFiles, setStreamingFiles] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>();
  const [appSpec, setAppSpec] = useState<any>(null);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    // Generate a stable session ID
    sessionIdRef.current = generateSessionId();

    (async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) setWalletAddress(accounts[0]);
        } catch {}
      }

      const initialPrompt = searchParams.get('prompt');
      if (initialPrompt) {
        handleSend(initialPrompt);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async (content: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setIsGenerating(true);
    setStreamingFiles({});

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          walletAddress,
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      let assistantContent = '';
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const decoder = new TextDecoder();
      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        sseBuffer += chunk;

        // Process complete SSE lines
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || ''; // Keep incomplete last line

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              switch (parsed.type) {
                case 'text':
                  assistantContent += parsed.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id ? { ...m, content: assistantContent } : m,
                    ),
                  );
                  break;

                case 'file_start':
                  setStreamingFiles((prev) => ({
                    ...prev,
                    [parsed.path]: '',
                  }));
                  break;

                case 'file_delta':
                  setStreamingFiles((prev) => ({
                    ...prev,
                    [parsed.path]: (prev[parsed.path] || '') + parsed.content,
                  }));
                  break;

                case 'file_complete':
                  // File is done streaming — no action needed, content is already accumulated
                  break;

                case 'preview_ready':
                  setPreviewFiles(parsed.files);
                  setStreamingFiles({});
                  break;

                case 'contract_files':
                  setContractFiles(parsed.files);
                  break;

                case 'app_spec':
                  setAppSpec(parsed.appSpec);
                  break;
              }
            } catch {
              // Skip malformed SSE chunks
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-error-${Date.now()}`,
          role: 'assistant',
          content:
            'The BNBrew API is not running yet. Start it with `pnpm dev` in apps/api to enable AI generation.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsStreaming(false);
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-bnb-dark">
      {/* Header */}
      <header className="h-14 border-b border-bnb-border flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Coffee className="w-5 h-5 text-bnb-yellow" />
            <span className="text-bnb-yellow font-bold text-lg">BNBrew</span>
          </Link>
          <span className="text-xs text-bnb-gray px-2 py-0.5 border border-bnb-border rounded">
            Builder
          </span>
        </div>
        <div className="flex items-center gap-4">
          {(Object.keys(previewFiles).length > 0 || contractFiles.length > 0) && (
            <button
              onClick={() => setShowDeployDialog(true)}
              className="px-5 py-2 bg-bnb-yellow text-bnb-dark text-sm font-semibold rounded-full hover:bg-bnb-yellow-hover transition-colors cursor-pointer"
            >
              Deploy
            </button>
          )}
          {walletAddress && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-bnb-card border border-bnb-border rounded-full">
              <div className="w-2 h-2 rounded-full bg-bnb-success" />
              <span className="text-xs text-bnb-gray font-mono">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Split pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat */}
        <div className="w-1/2 border-r border-bnb-border">
          <ChatPanel messages={messages} onSend={handleSend} isStreaming={isStreaming} />
        </div>

        {/* Right: Preview / Code */}
        <div className="w-1/2">
          <PreviewPanel
            previewFiles={previewFiles}
            contractFiles={contractFiles}
            streamingFiles={streamingFiles}
            isGenerating={isGenerating}
            onPreviewFixed={(fixed) => setPreviewFiles(fixed)}
          />
        </div>
      </div>

      <DeployDialog
        open={showDeployDialog}
        onClose={() => setShowDeployDialog(false)}
        appSpec={appSpec}
        contractFiles={contractFiles}
        previewFiles={previewFiles}
        walletAddress={walletAddress}
      />
    </div>
  );
}
