import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PLANNER_SYSTEM_PROMPT } from '../agent/prompts/planner';

interface StreamCallbacks {
  onText: (text: string) => void;
  onFiles: (files: Array<{ path: string; content: string; language: string }>) => void;
  onPreview: (url: string) => void;
  onStatus: (status: string, message: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly anthropic: Anthropic;

  // Store conversation context per session for iteration support
  private sessions = new Map<string, {
    appSpec: unknown;
    generatedFiles: Array<{ path: string; content: string; language: string }>;
    iterationCount: number;
  }>();

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async streamResponse(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    walletAddress: string | undefined,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    try {
      callbacks.onStatus('thinking', 'Understanding your request...');

      const stream = this.anthropic.messages.stream({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        system: PLANNER_SYSTEM_PROMPT,
        messages: messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      stream.on('text', (text) => {
        callbacks.onText(text);
      });

      const finalMessage = await stream.finalMessage();

      // Extract AppSpec from response if present
      const fullText = finalMessage.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const appSpecMatch = fullText.match(/```json\n([\s\S]*?)\n```/);
      if (appSpecMatch) {
        try {
          const appSpec = JSON.parse(appSpecMatch[1]);
          callbacks.onStatus('generating', 'Generating your app...');

          // Notify that we have files ready for preview
          const files = this.extractGeneratedFiles(appSpec);
          if (files.length > 0) {
            callbacks.onFiles(files);
          }
        } catch {
          this.logger.warn('Failed to parse AppSpec from response');
        }
      }

      callbacks.onDone();
    } catch (error) {
      this.logger.error(`Stream error: ${error}`);
      callbacks.onError('Failed to generate response');
    }
  }

  private extractGeneratedFiles(appSpec: Record<string, unknown>): Array<{ path: string; content: string; language: string }> {
    const files: Array<{ path: string; content: string; language: string }> = [];

    // Build a preview of the contract files from the spec
    const contracts = appSpec.contracts as Array<{ name: string }> | undefined;
    if (contracts) {
      for (const contract of contracts) {
        files.push({
          path: `contracts/${contract.name}.sol`,
          content: `// ${contract.name}.sol — will be generated from spec`,
          language: 'solidity',
        });
      }
    }

    return files;
  }
}
