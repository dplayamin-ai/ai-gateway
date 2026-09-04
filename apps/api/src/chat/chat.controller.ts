import { Body, Controller, Headers, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service.js';

@Controller('chat/v1')
export class ChatController {
  constructor(private readonly service: ChatService) {}
  @Get('models') models(@Headers('authorization') authorization?: string) { return this.service.models(authorization); }
  @Post('completions') completions(@Headers('authorization') authorization: string | undefined, @Body() body: { model?: string; messages?: Array<{ role: string; content: string }>; temperature?: number; max_tokens?: number; stream?: boolean }, @Res({ passthrough: true }) res: Response) { return this.service.completions(authorization, body, res); }
}
