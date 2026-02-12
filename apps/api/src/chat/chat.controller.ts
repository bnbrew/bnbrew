import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';

interface ChatRequest {
  sessionId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  walletAddress?: string;
}

@Controller('api/v1/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('fix-preview')
  async fixPreview(
    @Body() body: { files: Record<string, string>; error: string; errorPath?: string },
  ) {
    const fixed = await this.chatService.fixPreviewError(
      body.files,
      body.error,
      body.errorPath,
    );

    if (!fixed) {
      return { success: false, error: 'Could not fix the preview' };
    }

    return { success: true, files: fixed };
  }

  @Post()
  async chat(@Body() body: ChatRequest, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      await this.chatService.streamResponse(
        body.sessionId,
        body.messages,
        body.walletAddress,
        {
          onText: (text: string) => {
            res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
          },
          onFileStart: (path: string, fileType: 'contract' | 'frontend') => {
            res.write(`data: ${JSON.stringify({ type: 'file_start', path, fileType })}\n\n`);
          },
          onFileDelta: (path: string, content: string) => {
            res.write(`data: ${JSON.stringify({ type: 'file_delta', path, content })}\n\n`);
          },
          onFileComplete: (path: string) => {
            res.write(`data: ${JSON.stringify({ type: 'file_complete', path })}\n\n`);
          },
          onPreviewReady: (files: Record<string, string>) => {
            res.write(`data: ${JSON.stringify({ type: 'preview_ready', files })}\n\n`);
          },
          onContractFiles: (files: Array<{ name: string; source: string }>) => {
            res.write(`data: ${JSON.stringify({ type: 'contract_files', files })}\n\n`);
          },
          onAppSpec: (appSpec: any) => {
            res.write(`data: ${JSON.stringify({ type: 'app_spec', appSpec })}\n\n`);
          },
          onStatus: (status: string, message: string) => {
            res.write(`data: ${JSON.stringify({ type: 'status', status, message })}\n\n`);
          },
          onDone: () => {
            res.write('data: [DONE]\n\n');
            res.end();
          },
          onError: (error: string) => {
            res.write(`data: ${JSON.stringify({ type: 'error', error })}\n\n`);
            res.end();
          },
        },
      );
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal error' })}\n\n`);
      res.end();
    }
  }
}
