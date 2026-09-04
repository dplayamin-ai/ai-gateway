import { Module } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import { McpController } from './mcp.controller.js';
import { McpRepository } from './mcp.repository.js';
import { McpService } from './mcp.service.js';

@Module({ controllers: [McpController], providers: [McpService, McpRepository, DatabaseService] })
export class McpModule {}
