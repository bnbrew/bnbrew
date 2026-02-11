import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';

interface ChatRequest {
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
      await this.chatService.streamResponse(body.messages, body.walletAddress, {
        onText: (text: string) => {
          res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
        },
        onFiles: (files: Array<{ path: string; content: string; language: string }>) => {
          res.write(`data: ${JSON.stringify({ type: 'files', files })}\n\n`);
        },
        onPreview: (url: string) => {
          res.write(`data: ${JSON.stringify({ type: 'preview', url })}\n\n`);
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
      });
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal error' })}\n\n`);
      res.end();
    }
  }
}
