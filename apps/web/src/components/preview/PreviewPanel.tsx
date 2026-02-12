'use client';

import { useState, useMemo } from 'react';
import { SandpackProvider, SandpackPreview } from '@codesandbox/sandpack-react';

interface ContractFile {
  name: string;
  source: string;
}

interface PreviewPanelProps {
  previewFiles: Record<string, string>;
  contractFiles: ContractFile[];
  isGenerating: boolean;
}

type TabMode = 'preview' | 'code';

export default function PreviewPanel({
  previewFiles,
  contractFiles,
  isGenerating,
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('preview');
  const [selectedFile, setSelectedFile] = useState(0);

  const hasPreview = Object.keys(previewFiles).length > 0;
  const hasCode = contractFiles.length > 0 || hasPreview;

  // Build flat file list for code tab (contracts + frontend)
  const allFiles = useMemo(() => {
    const files: Array<{ path: string; content: string; language: string }> = [];

    for (const contract of contractFiles) {
      files.push({
        path: `contracts/${contract.name}.sol`,
        content: contract.source,
        language: 'solidity',
      });
    }

    for (const [path, content] of Object.entries(previewFiles)) {
      const ext = path.split('.').pop() || '';
      const langMap: Record<string, string> = {
        tsx: 'typescript',
        ts: 'typescript',
        jsx: 'javascript',
        js: 'javascript',
        css: 'css',
        json: 'json',
        html: 'html',
      };
      files.push({
        path,
        content,
        language: langMap[ext] || 'text',
      });
    }

    return files;
  }, [contractFiles, previewFiles]);

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
          {hasCode && (
            <span className="ml-2 text-xs text-bnb-gray">({allFiles.length})</span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' ? (
          <div className="h-full">
            {isGenerating ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-bnb-yellow border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-bnb-gray">Generating your app...</p>
                </div>
              </div>
            ) : hasPreview ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <SandpackProvider
                  template="react-ts"
                  files={previewFiles}
                  theme="dark"
                  customSetup={{
                    dependencies: {
                      'lucide-react': 'latest',
                    },
                  }}
                >
                  <SandpackPreview
                    showOpenInCodeSandbox={false}
                    showRefreshButton={false}
                    style={{ height: '100%', flex: 1 }}
                  />
                </SandpackProvider>
              </div>
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
            {allFiles.length > 0 && (
              <div className="w-48 border-r border-bnb-border overflow-y-auto">
                {allFiles.map((file, idx) => (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFile(idx)}
                    className={`w-full text-left px-3 py-2 text-xs font-mono truncate transition-colors cursor-pointer ${
                      idx === selectedFile
                        ? 'bg-bnb-card text-bnb-yellow'
                        : 'text-bnb-gray hover:text-bnb-light hover:bg-bnb-card/50'
                    }`}
                  >
                    {file.path}
                  </button>
                ))}
              </div>
            )}

            {/* Code viewer */}
            <div className="flex-1 overflow-auto p-4">
              {allFiles.length > 0 ? (
                <pre className="text-xs leading-relaxed">
                  <code>{allFiles[selectedFile]?.content}</code>
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
