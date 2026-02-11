'use client';

import { useState } from 'react';
import ChatPanel, { type ChatMessage } from '../../components/chat/ChatPanel';
import PreviewPanel from '../../components/preview/PreviewPanel';

interface GeneratedFile {
  path: string;
  content: string;
  language: string;
}

export default function BuildPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [isGenerating, setIsGenerating] = useState(false);

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

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error('Chat request failed');

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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'text') {
                assistantContent += parsed.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, content: assistantContent } : m,
                  ),
                );
              } else if (parsed.type === 'files') {
                setGeneratedFiles(parsed.files);
              } else if (parsed.type === 'preview') {
                setPreviewUrl(parsed.url);
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
          content: 'Something went wrong. Please try again.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsStreaming(false);
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-bnb-border flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-bnb-yellow font-bold text-xl">BNBrew</span>
          <span className="text-xs text-bnb-gray px-2 py-0.5 border border-bnb-border rounded">
            Builder
          </span>
        </div>
        <div className="flex items-center gap-4">
          {generatedFiles.length > 0 && (
            <button className="px-4 py-1.5 bg-bnb-yellow text-bnb-dark text-sm font-semibold rounded-lg hover:bg-bnb-yellow-hover transition-colors cursor-pointer">
              Deploy
            </button>
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
            files={generatedFiles}
            previewUrl={previewUrl}
            isGenerating={isGenerating}
          />
        </div>
      </div>
    </div>
  );
}
