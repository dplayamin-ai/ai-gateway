import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module.js';
import { ChatModule } from './chat/chat.module.js';
import { McpModule } from './mcp/mcp.module.js';

@Module({ imports: [AdminModule, ChatModule, McpModule] })
export class AppModule {}
