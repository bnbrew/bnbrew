'use client';

import { useState, useMemo, useEffect, useRef, useCallback, Component, type ReactNode } from 'react';
import { SandpackProvider, SandpackPreview, useSandpack } from '@codesandbox/sandpack-react';
import { SANDPACK_UI_FILES, SANDPACK_DEPENDENCIES } from '../../lib/sandpack-ui';

interface ContractFile {
  name: string;
  source: string;
}

interface PreviewPanelProps {
  previewFiles: Record<string, string>;
  contractFiles: ContractFile[];
  streamingFiles: Record<string, string>;
  isGenerating: boolean;
  onPreviewFixed?: (files: Record<string, string>) => void;
}

type TabMode = 'preview' | 'code';

const MAX_AUTO_FIX_ATTEMPTS = 2;

/**
 * Listens for Sandpack runtime errors and auto-fixes them via the API.
 */
function SandpackErrorAutoFixer({
  files,
  onFixed,
  attempt,
  onAttempt,
}: {
  files: Record<string, string>;
  onFixed: (files: Record<string, string>) => void;
  attempt: number;
  onAttempt: () => void;
}) {
  const { listen } = useSandpack();
  const fixingRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // Reset fixing state when files change
    fixingRef.current = false;
  }, [files]);

  useEffect(() => {
    const unsub = listen((msg) => {
      // Catch runtime errors from the Sandpack iframe
      if (
        msg.type === 'action' &&
        (msg as any).action === 'show-error' &&
        !fixingRef.current &&
        attempt < MAX_AUTO_FIX_ATTEMPTS
      ) {
        const errorMsg = (msg as any).message || (msg as any).title || 'Unknown error';
        const errorPath = (msg as any).path;

        // Debounce — wait 500ms to let errors settle
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => {
          fixingRef.current = true;
          onAttempt();
          autoFix(files, errorMsg, errorPath, onFixed);
        }, 500);
      }
    });

    return () => {
      unsub();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [listen, files, onFixed, attempt, onAttempt]);

  return null;
}

async function autoFix(
  files: Record<string, string>,
  error: string,
  errorPath: string | undefined,
  onFixed: (files: Record<string, string>) => void,
) {
  try {
    const res = await fetch('/api/fix-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, error, errorPath }),
    });

    if (!res.ok) return;

    const data = await res.json();
    if (data.success && data.files) {
      onFixed(data.files);
    }
  } catch (err) {
    console.error('Auto-fix failed:', err);
  }
}

// Error boundary to catch React-level Sandpack crashes
class SandpackErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('Sandpack error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>&#x26A0;&#xFE0F;</div>
            <p style={{ color: '#EAECEF', fontSize: '14px', marginBottom: '8px' }}>
              Preview encountered an error
            </p>
            <p style={{ color: '#848E9C', fontSize: '12px', marginBottom: '16px' }}>
              {this.state.error}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              style={{
                padding: '8px 24px',
                background: '#F0B90B',
                color: '#0B0E11',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function PreviewPanel({
  previewFiles,
  contractFiles,
  streamingFiles,
  isGenerating,
  onPreviewFixed,
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('preview');
  const [selectedFile, setSelectedFile] = useState(0);
  const [fixAttempt, setFixAttempt] = useState(0);
  const [isFixing, setIsFixing] = useState(false);
  const codeEndRef = useRef<HTMLDivElement>(null);
  const prevStreamingCountRef = useRef(0);
  const prevPreviewRef = useRef(false);

  const hasPreview = Object.keys(previewFiles).length > 0;
  const hasStreaming = Object.keys(streamingFiles).length > 0;
  const hasCode = contractFiles.length > 0 || hasPreview;

  // Reset fix attempts when preview files change from parent
  useEffect(() => {
    setFixAttempt(0);
    setIsFixing(false);
  }, [previewFiles]);

  // Auto-switch to Code tab when streaming starts
  useEffect(() => {
    const streamingCount = Object.keys(streamingFiles).length;
    if (streamingCount > 0 && prevStreamingCountRef.current === 0) {
      setActiveTab('code');
      setSelectedFile(0);
    }
    prevStreamingCountRef.current = streamingCount;
  }, [streamingFiles]);

  // Auto-switch to Preview tab when preview becomes ready
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (hasPreview && !prevPreviewRef.current) {
      timer = setTimeout(() => setActiveTab('preview'), 600);
    }
    prevPreviewRef.current = hasPreview;
    return () => { if (timer) clearTimeout(timer); };
  }, [hasPreview]);

  // Auto-scroll code view to bottom during streaming
  useEffect(() => {
    if (hasStreaming && activeTab === 'code') {
      codeEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingFiles, hasStreaming, activeTab]);

  const handlePreviewFixed = useCallback((fixedFiles: Record<string, string>) => {
    setIsFixing(false);
    onPreviewFixed?.(fixedFiles);
  }, [onPreviewFixed]);

  const handleFixAttempt = useCallback(() => {
    setFixAttempt((prev) => prev + 1);
    setIsFixing(true);
  }, []);

  // Build streaming file list for code tab during generation
  const streamingFileList = useMemo(() => {
    const files: Array<{ path: string; content: string; language: string; isStreaming: boolean }> = [];

    for (const [path, content] of Object.entries(streamingFiles)) {
      const ext = path.split('.').pop() || '';
      const langMap: Record<string, string> = {
        tsx: 'typescript', ts: 'typescript', jsx: 'javascript',
        js: 'javascript', css: 'css', json: 'json', html: 'html', sol: 'solidity',
      };
      files.push({
        path,
        content,
        language: langMap[ext] || 'text',
        isStreaming: true,
      });
    }

    return files;
  }, [streamingFiles]);

  // Build final file list for code tab (contracts + frontend)
  const finalFileList = useMemo(() => {
    const files: Array<{ path: string; content: string; language: string; isStreaming: boolean }> = [];

    for (const contract of contractFiles) {
      files.push({
        path: `contracts/${contract.name}.sol`,
        content: contract.source,
        language: 'solidity',
        isStreaming: false,
      });
    }

    for (const [path, content] of Object.entries(previewFiles)) {
      const ext = path.split('.').pop() || '';
      const langMap: Record<string, string> = {
        tsx: 'typescript', ts: 'typescript', jsx: 'javascript',
        js: 'javascript', css: 'css', json: 'json', html: 'html',
      };
      files.push({
        path,
        content,
        language: langMap[ext] || 'text',
        isStreaming: false,
      });
    }

    return files;
  }, [contractFiles, previewFiles]);

  // Use streaming files during generation, final files after
  const displayFiles = hasStreaming ? streamingFileList : finalFileList;

  // Clamp selected file index
  const safeSelectedFile = Math.min(selectedFile, Math.max(0, displayFiles.length - 1));

  return (
    <div className="flex flex-col h-full bg-bnb-dark">
      {/* Tab bar */}
      <div className="flex items-center border-b border-bnb-border">
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'preview'
              ? 'text-bnb-yellow border-b-2 border-bnb-yellow'
              : 'text-bnb-gray hover:text-bnb-light'
          }`}
        >
          Preview
          {isFixing && (
            <span className="ml-2 inline-block w-3 h-3 border border-bnb-yellow border-t-transparent rounded-full animate-spin" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'code'
              ? 'text-bnb-yellow border-b-2 border-bnb-yellow'
              : 'text-bnb-gray hover:text-bnb-light'
          }`}
        >
          Code
          {(hasCode || hasStreaming) && (
            <span className="ml-2 text-xs text-bnb-gray">({displayFiles.length})</span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' ? (
          <div className="h-full">
            {isGenerating && !hasPreview ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-bnb-yellow border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-bnb-gray">Generating your app...</p>
                  {hasStreaming && (
                    <button
                      onClick={() => setActiveTab('code')}
                      className="text-xs text-bnb-yellow hover:underline cursor-pointer"
                    >
                      Watch code being written &rarr;
                    </button>
                  )}
                </div>
              </div>
            ) : hasPreview ? (
              <SandpackErrorBoundary>
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Ensure Sandpack overlays don't block iframe interaction */}
                  <style>{`
                    .sp-preview-actions { pointer-events: none !important; }
                    .sp-preview-container > iframe { pointer-events: auto !important; }
                  `}</style>
                  <SandpackProvider
                    template="react-ts"
                    files={{
                      ...SANDPACK_UI_FILES,
                      ...previewFiles,
                    }}
                    theme="dark"
                    customSetup={{
                      dependencies: SANDPACK_DEPENDENCIES,
                    }}
                  >
                    <SandpackErrorAutoFixer
                      files={previewFiles}
                      onFixed={handlePreviewFixed}
                      attempt={fixAttempt}
                      onAttempt={handleFixAttempt}
                    />
                    <SandpackPreview
                      showOpenInCodeSandbox={false}
                      showRefreshButton={false}
                      style={{ height: '100%', flex: 1 }}
                    />
                  </SandpackProvider>
                </div>
              </SandpackErrorBoundary>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="text-4xl">&#x1F528;</div>
                  <p className="text-bnb-gray">Your app preview will appear here</p>
                  <p className="text-xs text-bnb-gray/60">
                    Start by describing what you want to build
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full">
            {/* File sidebar */}
            {displayFiles.length > 0 && (
              <div className="w-48 border-r border-bnb-border overflow-y-auto">
                {displayFiles.map((file, idx) => (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFile(idx)}
                    className={`w-full text-left px-3 py-2 text-xs font-mono truncate transition-colors cursor-pointer flex items-center gap-2 ${
                      idx === safeSelectedFile
                        ? 'bg-bnb-card text-bnb-yellow'
                        : 'text-bnb-gray hover:text-bnb-light hover:bg-bnb-card/50'
                    }`}
                  >
                    {file.isStreaming && (
                      <span className="w-1.5 h-1.5 rounded-full bg-bnb-yellow animate-pulse shrink-0" />
                    )}
                    <span className="truncate">{file.path}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Code viewer */}
            <div className="flex-1 overflow-auto p-4">
              {displayFiles.length > 0 ? (
                <pre className="text-xs leading-relaxed">
                  <code>{displayFiles[safeSelectedFile]?.content}</code>
                  {displayFiles[safeSelectedFile]?.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-bnb-yellow animate-pulse ml-0.5" />
                  )}
                  <div ref={codeEndRef} />
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-bnb-gray text-sm">
                  No code generated yet
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
