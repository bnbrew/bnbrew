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
  onFileStart: (path: string, fileType: 'contract' | 'frontend') => void;
  onFileDelta: (path: string, content: string) => void;
  onFileComplete: (path: string) => void;
  onPreviewReady: (files: Record<string, string>) => void;
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
   * Generation mode — user confirmed, generate AppSpec → contracts + preview in parallel
   */
  private async handleGeneration(
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    // Step 1: Generate AppSpec JSON (not streaming — it's internal)
    callbacks.onStatus('generating', 'Designing your app...');
    callbacks.onText("I'm building your app now!\n\n");

    const appSpec = await this.generateAppSpec(messages);
    if (!appSpec) {
      callbacks.onText("Sorry, I couldn't generate the app spec. Let's try describing the app again.");
      callbacks.onDone();
      return;
    }

    callbacks.onText(`**${appSpec.name}** — ${appSpec.description}\n\n`);
    callbacks.onStatus('generating', 'Generating code...');
    callbacks.onText('Generating smart contracts and building your preview in parallel...\n\n');

    // Step 2: Generate contracts + preview IN PARALLEL with streaming
    const contractPromise = this.generateContractsStreaming(
      appSpec.contracts || [],
      callbacks,
    );
    const previewPromise = this.generatePreviewStreaming(appSpec, callbacks);

    const [contractFiles, previewFiles] = await Promise.all([
      contractPromise,
      previewPromise,
    ]);

    // Step 3: Send final assembled files
    if (contractFiles.length > 0) {
      callbacks.onContractFiles(contractFiles);
    }

    if (previewFiles && Object.keys(previewFiles).length > 0) {
      const sanitized = this.sanitizePreviewFiles(previewFiles);
      callbacks.onPreviewReady(sanitized);
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
   * Stream-generate all contracts in parallel.
   * Each contract emits file_start → file_delta → file_complete events.
   */
  private async generateContractsStreaming(
    contracts: any[],
    callbacks: StreamCallbacks,
  ): Promise<Array<{ name: string; source: string }>> {
    if (contracts.length === 0) return [];

    const promises = contracts.map(async (contractSpec) => {
      const filePath = `contracts/${contractSpec.name}.sol`;
      callbacks.onFileStart(filePath, 'contract');

      try {
        const stream = this.anthropic.messages.stream({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8192,
          system: CONTRACT_GENERATOR_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Generate a Solidity contract from this ContractSpec:\n\n${JSON.stringify(contractSpec, null, 2)}\n\nOutput ONLY the Solidity source code for ${contractSpec.name}.sol`,
            },
          ],
        });

        let fullSource = '';
        let lineBuffer = '';
        let inFence = false;

        stream.on('text', (text) => {
          fullSource += text;
          lineBuffer += text;

          // Process complete lines, stripping markdown fences
          let nlIndex: number;
          while ((nlIndex = lineBuffer.indexOf('\n')) !== -1) {
            const line = lineBuffer.substring(0, nlIndex);
            lineBuffer = lineBuffer.substring(nlIndex + 1);

            // Skip markdown fence markers
            if (line.trim().startsWith('```')) {
              inFence = !inFence;
              continue;
            }

            callbacks.onFileDelta(filePath, line + '\n');
          }
        });

        await stream.finalMessage();

        // Emit remaining buffer
        if (lineBuffer.trim() && !lineBuffer.trim().startsWith('```')) {
          callbacks.onFileDelta(filePath, lineBuffer);
        }

        callbacks.onFileComplete(filePath);

        // Clean source for database
        let source = fullSource.trim();
        if (source.startsWith('```')) {
          source = source.replace(/^```\w*\n/, '').replace(/\n```$/, '');
        }

        return { name: contractSpec.name, source };
      } catch (err) {
        this.logger.error(`Contract generation failed for ${contractSpec.name}: ${err}`);
        callbacks.onFileComplete(filePath);
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter((r): r is { name: string; source: string } => r !== null);
  }

  /**
   * Stream-generate preview files using ===FILE: /path=== delimited format.
   * Parses the stream incrementally, emitting file_start → file_delta → file_complete events.
   */
  private async generatePreviewStreaming(
    appSpec: any,
    callbacks: StreamCallbacks,
  ): Promise<Record<string, string> | null> {
    const userPrompt = PREVIEW_GENERATOR_USER_TEMPLATE.replace(
      '{{appSpec}}',
      JSON.stringify(appSpec, null, 2),
    );

    try {
      const stream = this.anthropic.messages.stream({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 16384,
        system: PREVIEW_GENERATOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      let lineBuffer = '';
      let currentPath = '';
      const collectedFiles: Record<string, string> = {};

      stream.on('text', (text) => {
        lineBuffer += text;

        // Process all complete lines
        let nlIndex: number;
        while ((nlIndex = lineBuffer.indexOf('\n')) !== -1) {
          const line = lineBuffer.substring(0, nlIndex);
          lineBuffer = lineBuffer.substring(nlIndex + 1);

          // Check for file marker
          const markerMatch = line.match(/^===FILE:\s*(.+?)\s*===$/);
          if (markerMatch) {
            // Complete previous file
            if (currentPath) {
              callbacks.onFileComplete(currentPath);
            }
            // Start new file
            currentPath = markerMatch[1];
            collectedFiles[currentPath] = '';
            callbacks.onFileStart(currentPath, 'frontend');
          } else if (currentPath) {
            const lineWithNewline = line + '\n';
            collectedFiles[currentPath] += lineWithNewline;
            callbacks.onFileDelta(currentPath, lineWithNewline);
          }
        }
      });

      await stream.finalMessage();

      // Handle remaining buffer
      if (lineBuffer && currentPath) {
        collectedFiles[currentPath] += lineBuffer;
        callbacks.onFileDelta(currentPath, lineBuffer);
      }
      if (currentPath) {
        callbacks.onFileComplete(currentPath);
      }

      if (Object.keys(collectedFiles).length === 0) {
        this.logger.error('Preview streaming produced no files');
        return null;
      }

      return collectedFiles;
    } catch (err) {
      this.logger.error(`Preview streaming failed: ${err}`);
      return null;
    }
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
      const sanitized = this.sanitizePreviewFiles(updatedFrontendFiles);
      callbacks.onPreviewReady(sanitized);
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
   * Sanitize generated preview files to prevent Sandpack crashes.
   */
  private sanitizePreviewFiles(
    files: Record<string, string>,
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [path, content] of Object.entries(files)) {
      if (typeof content !== 'string') continue;

      let code = content;

      // Remove full lines that import from react-dom/client
      code = code.replace(
        /^.*import\s+.*from\s+['"]react-dom(?:\/client)?['"].*$/gm,
        '',
      );

      // Remove full lines containing ReactDOM.createRoot / ReactDOM.render
      code = code.replace(
        /^.*(?:ReactDOM\.)?(?:createRoot|render)\s*\(.*document.*\).*$/gm,
        '',
      );

      // Replace document.getElementById/querySelector calls with null
      code = code.replace(
        /document\.(getElementById|querySelector|querySelectorAll)\s*\([^)]*\)/g,
        'null',
      );

      // Replace document.createElement calls with null
      code = code.replace(
        /document\.createElement\s*\([^)]*\)/g,
        'null',
      );

      // Replace document.body / document.head references with null
      code = code.replace(
        /document\.(body|head|documentElement)/g,
        'null',
      );

      // Replace window.location / window.history with safe values
      code = code.replace(/window\.location\.href/g, '"/"');
      code = code.replace(/window\.location/g, '{ href: "/", pathname: "/" }');
      code = code.replace(
        /window\.history\.\w+\s*\([^)]*\)/g,
        'void 0',
      );

      // Replace localStorage / sessionStorage calls with safe values
      code = code.replace(
        /(localStorage|sessionStorage)\.getItem\s*\([^)]*\)/g,
        'null',
      );
      code = code.replace(
        /(localStorage|sessionStorage)\.setItem\s*\([^)]*\)/g,
        'void 0',
      );
      code = code.replace(
        /(localStorage|sessionStorage)\.removeItem\s*\([^)]*\)/g,
        'void 0',
      );

      sanitized[path] = code;
    }

    // Ensure /App.tsx exists and has a default export
    if (sanitized['/App.tsx'] && !sanitized['/App.tsx'].includes('export default')) {
      if (sanitized['/App.tsx'].includes('function App')) {
        sanitized['/App.tsx'] += '\nexport default App;\n';
      }
    }

    return sanitized;
  }

  /**
   * Fix a Sandpack preview error by sending the error + files to Claude
   */
  async fixPreviewError(
    files: Record<string, string>,
    error: string,
    errorPath?: string,
  ): Promise<Record<string, string> | null> {
    const fileList = Object.entries(files)
      .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
      .join('\n\n');

    const prompt = `Fix this Sandpack preview that crashed with a runtime error.

## Error
${error}
${errorPath ? `File: ${errorPath}` : ''}

## Current Files
${fileList}

## Output
Output ONLY a JSON object where keys are file paths and values are the COMPLETE corrected file contents. Include ALL files, not just changed ones.

Example: { "/App.tsx": "corrected content...", "/styles.css": "..." }

## CRITICAL RULES — these caused the crash, you MUST fix them:
- NEVER use \`document\`, \`document.getElementById\`, \`document.querySelector\`, \`document.createElement\`, or any DOM API
- NEVER use \`ReactDOM.createRoot\` or \`ReactDOM.render\` — Sandpack handles mounting
- NEVER import from \`react-dom\` or \`react-dom/client\`
- NEVER use \`window.location\`, \`window.history\`, \`localStorage\`, \`sessionStorage\`
- For scrolling to elements: use \`React.useRef()\` + \`ref.current?.scrollIntoView()\`
- For DOM measurement: use \`React.useRef()\` + \`useEffect\`
- For toasts/modals: use React state, NOT portals to document.body
- Every file path must start with "/"
- /App.tsx must have \`export default function App()\``;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 16384,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') return null;

      let text = content.text.trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```\w*\n/, '').replace(/\n```$/, '');
      }

      const fixed = JSON.parse(text) as Record<string, string>;
      return this.sanitizePreviewFiles(fixed);
    } catch (err) {
      this.logger.error(`Fix preview error failed: ${err}`);
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
