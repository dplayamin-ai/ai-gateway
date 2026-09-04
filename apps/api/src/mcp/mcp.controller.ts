import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { McpService } from './mcp.service.js';

@Controller('mcp')
export class McpController {
  constructor(private readonly service: McpService) {}
  @Post(':mcp_code') relay(@Param('mcp_code') code: string, @Headers('authorization') authorization: string | undefined, @Body() body: Record<string, unknown>) {
    return this.service.relay(code, authorization, body);
  }
}
