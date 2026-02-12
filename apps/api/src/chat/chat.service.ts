import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import {
  PLANNER_SYSTEM_PROMPT,
  GENERATION_SYSTEM_PROMPT,
} from '../agent/prompts/planner';
import {
  PREVIEW_GENERATOR_SYSTEM_PROMPT,
  PREVIEW_GENERATOR_USER_TEMPLATE,
} from '../agent/prompts/preview-generator';
import {
  ITERATION_SYSTEM_PROMPT,
  ITERATION_USER_TEMPLATE,
} from '../agent/prompts/iteration';
import { CONTRACT_GENERATOR_SYSTEM_PROMPT } from '../agent/prompts/contract-generator';

export interface StreamCallbacks {
  onText: (text: string) => void;
  onPreviewFiles: (files: Record<string, string>) => void;
  onContractFiles: (files: Array<{ name: string; source: string }>) => void;
  onStatus: (status: string, message: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

// Words that indicate the user is confirming they want to build
const CONFIRM_PATTERNS = [
  /^y(es|eah?|ep|eap?|up|a)\b/i,
  /^sure/i, /^go\b/i, /^ok(ay)?\b/i,
  /^build/i, /^let'?s\s*(go|build|do)/i,
  /^do it/i, /^ship/i, /^ready/i,
  /^absolutely/i, /^definitely/i, /^of course/i,
  /^please/i, /^for sure/i, /^100/i, /^bet\b/i,
  /^lfg/i, /^lgtm/i, /^sounds? good/i,
  /^go (for it|ahead)/i, /^make it/i,
];

function assistantAskedToBuild(messages: Array<{ role: string; content: string }>): boolean {
  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  return assistantMessages.some((m) => {
    const text = m.content.toLowerCase();
    return (
      text.includes('ready to build') ||
      text.includes('shall i build') ||
      text.includes('want me to build') ||
      text.includes('start building') ||
      text.includes('does that work for you') ||
      text.includes('sound good') ||
      text.includes('look good') ||
      text.includes('want to proceed') ||
      text.includes('should i go ahead')
    );
  });
}

function userConfirmed(message: string): boolean {
  const trimmed = message.trim();
  return CONFIRM_PATTERNS.some((p) => p.test(trimmed));
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  async streamResponse(
    sessionId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    walletAddress: string | undefined,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    try {
      // Ensure session exists
      const session = await this.prisma.session.upsert({
        where: { id: sessionId },
        create: { id: sessionId, walletAddress },
        update: { walletAddress: walletAddress || undefined },
        include: { app: true },
      });

      // Save the user's message
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage && lastUserMessage.role === 'user') {
        await this.prisma.message.create({
          data: {
            sessionId,
            role: 'user',
            content: lastUserMessage.content,
          },
        });
      }

      // Check if this session already has a generated app → iteration mode
      if (session.app) {
        await this.handleIteration(sessionId, session.app, messages, callbacks);
        return;
      }

      // Check if conversation is at the "confirm to build" stage
      const previousMessages = messages.slice(0, -1);
      const shouldGenerate =
        assistantAskedToBuild(previousMessages) &&
        userConfirmed(lastUserMessage?.content || '');

      if (shouldGenerate) {
        await this.handleGeneration(sessionId, messages, callbacks);
      } else {
        await this.handleChat(sessionId, messages, callbacks);
      }
    } catch (error) {
      this.logger.error(`Stream error: ${error}`);
      callbacks.onError('Failed to generate response');
    }
  }

  /**
   * Chat mode — conversational requirements gathering
   */
  private async handleChat(
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    callbacks.onStatus('thinking', 'Understanding your request...');

    const stream = this.anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: PLANNER_SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    let fullText = '';
    stream.on('text', (text) => {
      fullText += text;
      callbacks.onText(text);
    });

    await stream.finalMessage();

    // Save assistant message
    await this.prisma.message.create({
      data: { sessionId, role: 'assistant', content: fullText },
    });

    callbacks.onDone();
  }

  /**
   * Generation mode — user confirmed, generate AppSpec → contracts → preview
   */
  private async handleGeneration(
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    // Step 1: Generate AppSpec JSON
    callbacks.onStatus('generating', 'Designing your app...');
    callbacks.onText("I'm building your app now! Here's what's happening:\n\n");

    const appSpec = await this.generateAppSpec(messages);
    if (!appSpec) {
      callbacks.onText("Sorry, I couldn't generate the app spec. Let's try describing the app again.");
      callbacks.onDone();
      return;
    }

    callbacks.onText(`**${appSpec.name}** — ${appSpec.description}\n\n`);

    // Step 2: Generate contracts
    callbacks.onStatus('generating', 'Generating smart contracts...');
    callbacks.onText('Generating smart contracts...\n');

    const contractFiles: Array<{ name: string; source: string }> = [];
    for (const contractSpec of appSpec.contracts || []) {
      try {
        const contract = await this.generateContract(contractSpec);
        contractFiles.push(contract);
        callbacks.onText(`- ${contract.name}.sol\n`);
      } catch (err) {
        this.logger.error(`Contract generation failed for ${contractSpec.name}: ${err}`);
        callbacks.onText(`- ${contractSpec.name}.sol (failed)\n`);
      }
    }

    if (contractFiles.length > 0) {
      callbacks.onContractFiles(contractFiles);
    }

    // Step 3: Generate preview files
    callbacks.onStatus('generating', 'Building your preview...');
    callbacks.onText('\nBuilding your preview...\n');

    const previewFiles = await this.generatePreview(appSpec);
    if (previewFiles) {
      callbacks.onPreviewFiles(previewFiles);
      callbacks.onText('\nYour app is ready! Check the preview on the right.\n');
      callbacks.onText('You can ask me to make changes — just describe what you want different.\n');
    } else {
      callbacks.onText('\nPreview generation failed. You can still see your contracts in the Code tab.\n');
    }

    // Step 4: Save to database
    await this.prisma.generatedApp.create({
      data: {
        sessionId,
        name: appSpec.name,
        appSpec: appSpec as any,
        contractFiles: contractFiles as any,
        frontendFiles: (previewFiles || {}) as any,
        status: 'draft',
      },
    });

    // Save assistant message
    await this.prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: `Generated ${appSpec.name} with ${contractFiles.length} contracts and a live preview.`,
      },
    });

    callbacks.onDone();
  }

  /**
   * Iteration mode — session has a generated app, user wants changes
   */
  private async handleIteration(
    sessionId: string,
    app: { id: string; appSpec: any; contractFiles: any; frontendFiles: any },
    messages: Array<{ role: string; content: string }>,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    callbacks.onStatus('thinking', 'Updating your app...');

    const lastMessage = messages[messages.length - 1]?.content || '';

    // Format current files for the prompt
    const currentFiles = this.formatFilesForPrompt(
      app.frontendFiles as Record<string, string>,
      app.contractFiles as Array<{ name: string; source: string }>,
    );

    const userPrompt = ITERATION_USER_TEMPLATE
      .replace('{{currentFiles}}', currentFiles)
      .replace('{{appSpec}}', JSON.stringify(app.appSpec, null, 2))
      .replace('{{userMessage}}', lastMessage);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16384,
      system: ITERATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      callbacks.onText("Sorry, I couldn't process that change. Could you try rephrasing?");
      callbacks.onDone();
      return;
    }

    let text = content.text.trim();
    // Strip markdown fences if present
    if (text.startsWith('```')) {
      text = text.replace(/^```\w*\n/, '').replace(/\n```$/, '');
    }

    try {
      const result = JSON.parse(text) as {
        updatedFiles: Record<string, string>;
        message: string;
      };

      // Merge updated files
      const updatedFrontendFiles = {
        ...(app.frontendFiles as Record<string, string>),
      };
      const updatedContractFiles = [...(app.contractFiles as Array<{ name: string; source: string }>)];

      for (const [filePath, fileContent] of Object.entries(result.updatedFiles)) {
        if (filePath.endsWith('.sol')) {
          // Contract file
          const name = filePath.replace(/^.*\//, '').replace('.sol', '');
          const idx = updatedContractFiles.findIndex((c) => c.name === name);
          if (idx >= 0) {
            updatedContractFiles[idx] = { name, source: fileContent };
          } else {
            updatedContractFiles.push({ name, source: fileContent });
          }
        } else {
          // Frontend file
          updatedFrontendFiles[filePath] = fileContent;
        }
      }

      // Update database
      await this.prisma.generatedApp.update({
        where: { id: app.id },
        data: {
          frontendFiles: updatedFrontendFiles as any,
          contractFiles: updatedContractFiles as any,
        },
      });

      // Send updated files to frontend
      callbacks.onPreviewFiles(updatedFrontendFiles);
      if (updatedContractFiles.length > 0) {
        callbacks.onContractFiles(updatedContractFiles);
      }

      callbacks.onText(result.message);

      // Save assistant message
      await this.prisma.message.create({
        data: { sessionId, role: 'assistant', content: result.message },
      });
    } catch (err) {
      this.logger.error(`Iteration parse error: ${err}`);
      callbacks.onText("I made some changes but couldn't parse the result properly. Could you try again?");
    }

    callbacks.onDone();
  }

  /**
   * Generate AppSpec JSON from conversation
   */
  private async generateAppSpec(
    messages: Array<{ role: string; content: string }>,
  ): Promise<any | null> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      system: GENERATION_SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    let text = content.text.trim();
    // Extract JSON from markdown fences if present
    const jsonMatch = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      text = jsonMatch[1];
    }

    try {
      return JSON.parse(text);
    } catch {
      this.logger.error('Failed to parse AppSpec JSON');
      return null;
    }
  }

  /**
   * Generate a single Solidity contract from spec
   */
  private async generateContract(
    spec: any,
  ): Promise<{ name: string; source: string }> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      system: CONTRACT_GENERATOR_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Generate a Solidity contract from this ContractSpec:\n\n${JSON.stringify(spec, null, 2)}\n\nOutput ONLY the Solidity source code for ${spec.name}.sol`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let source = content.text.trim();
    if (source.startsWith('```')) {
      source = source.replace(/^```\w*\n/, '').replace(/\n```$/, '');
    }

    return { name: spec.name, source };
  }

  /**
   * Generate Sandpack-compatible preview files from AppSpec
   */
  private async generatePreview(
    appSpec: any,
  ): Promise<Record<string, string> | null> {
    const userPrompt = PREVIEW_GENERATOR_USER_TEMPLATE.replace(
      '{{appSpec}}',
      JSON.stringify(appSpec, null, 2),
    );

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16384,
      system: PREVIEW_GENERATOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    let text = content.text.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```\w*\n/, '').replace(/\n```$/, '');
    }

    try {
      return JSON.parse(text) as Record<string, string>;
    } catch {
      this.logger.error('Failed to parse preview files JSON');
      return null;
    }
  }

  /**
   * Format files into a string for the iteration prompt
   */
  private formatFilesForPrompt(
    frontendFiles: Record<string, string>,
    contractFiles: Array<{ name: string; source: string }>,
  ): string {
    const parts: string[] = [];

    for (const [path, content] of Object.entries(frontendFiles || {})) {
      parts.push(`### ${path}\n\`\`\`\n${content}\n\`\`\``);
    }

    for (const contract of contractFiles || []) {
      parts.push(`### ${contract.name}.sol\n\`\`\`solidity\n${contract.source}\n\`\`\``);
    }

    return parts.join('\n\n');
  }
}
