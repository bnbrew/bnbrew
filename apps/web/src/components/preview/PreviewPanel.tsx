'use client';

import { useState } from 'react';

interface FileEntry {
  path: string;
  content: string;
  language: string;
}

interface PreviewPanelProps {
  files: FileEntry[];
  previewUrl?: string;
  isGenerating: boolean;
}

type TabMode = 'preview' | 'code';

export default function PreviewPanel({ files, previewUrl, isGenerating }: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('preview');
  const [selectedFile, setSelectedFile] = useState(0);

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
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' ? (
          <div className="h-full flex items-center justify-center">
            {isGenerating ? (
              <div className="text-center space-y-3">
                <div className="w-8 h-8 border-2 border-bnb-yellow border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-bnb-gray">Generating your app...</p>
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin"
                title="App Preview"
              />
            ) : (
              <div className="text-center space-y-2">
                <div className="text-4xl">&#x1F528;</div>
                <p className="text-bnb-gray">Your app preview will appear here</p>
                <p className="text-xs text-bnb-gray/60">Start by describing what you want to build</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full">
            {/* File sidebar */}
            {files.length > 0 && (
              <div className="w-48 border-r border-bnb-border overflow-y-auto">
                {files.map((file, idx) => (
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
              {files.length > 0 ? (
                <pre className="text-xs leading-relaxed">
                  <code>{files[selectedFile]?.content}</code>
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
