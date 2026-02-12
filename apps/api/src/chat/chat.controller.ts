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
          onPreviewFiles: (files: Record<string, string>) => {
            res.write(`data: ${JSON.stringify({ type: 'preview_files', files })}\n\n`);
          },
          onContractFiles: (files: Array<{ name: string; source: string }>) => {
            res.write(`data: ${JSON.stringify({ type: 'contract_files', files })}\n\n`);
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
