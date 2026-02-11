'use client';

import { useState, useRef, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isStreaming: boolean;
}

export default function ChatPanel({ messages, onSend, isStreaming }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="text-3xl font-bold text-bnb-yellow">What do you want to build?</div>
            <p className="text-bnb-gray max-w-md">
              Describe your app and I&apos;ll generate smart contracts, a frontend, and deploy everything to BNB Chain.
            </p>
            <div className="flex flex-wrap gap-2 mt-4 max-w-lg justify-center">
              {[
                'A tipping page for my content',
                'Appointment booking with payments',
                'Contact form with encrypted submissions',
                'NFT mint page for my art',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-2 text-sm border border-bnb-border rounded-lg text-bnb-gray hover:text-bnb-light hover:border-bnb-yellow/50 transition-colors cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-bnb-yellow text-bnb-dark rounded-br-sm'
                  : 'bg-bnb-card border border-bnb-border rounded-bl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-bnb-card border border-bnb-border px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-bnb-yellow rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-bnb-yellow rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-2 h-2 bg-bnb-yellow rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-bnb-border p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your app..."
            rows={1}
            className="flex-1 bg-bnb-input border border-bnb-border rounded-lg px-4 py-3 text-sm text-bnb-light placeholder-bnb-gray focus:outline-none focus:border-bnb-yellow/50 resize-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="px-6 py-3 bg-bnb-yellow text-bnb-dark font-semibold rounded-lg hover:bg-bnb-yellow-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
