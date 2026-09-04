import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service.js';

@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}
  @Get('health') health() { return this.service.health(); }
  @Get('dashboard') dashboard(@Query('informationSystemId') informationSystemId?: string, @Query('tenantId') tenantId?: string) { return this.service.dashboard(informationSystemId, tenantId); }
  @Get('api-key-requests') apiKeyRequests() { return this.service.apiKeyRequests(); }
  @Put('api-key-requests/:id/review') review(@Param('id') id: string, @Body() body: { decision?: string; rejectionReason?: string }) { return this.service.reviewApiKeyRequest(id, body); }
  @Delete('api-key-requests/:id') deleteApiKeyRequest(@Param('id') id: string) { return this.service.deleteApiKeyRequest(id); }
  @Get('information-systems') informationSystems() { return this.service.informationSystems(); }
  @Post('api-key-requests') createApiKeyRequest(@Body() body: { applicantName?: string; applicantEmail?: string; informationSystemId?: string; tenantId?: string; reason?: string; modelIds?: string[]; mcpIds?: string[] }) { return this.service.createApiKeyRequest(body); }
  @Get('models') models() { return this.service.models(); }
  @Get('providers') providers() { return this.service.providers(); }
  @Get('tenants/:tenantId/providers') tenantProviders(@Param('tenantId') tenantId: string) { return this.service.tenantProviders(tenantId); }
  @Get('tenants/:tenantId/models') tenantModels(@Param('tenantId') tenantId: string) { return this.service.tenantModels(tenantId); }
  @Post('models') createModel(@Body() body: { alias?: string; providerId?: string; providerModel?: string }) { return this.service.createModel(body); }
  @Delete('models/:id') deleteModel(@Param('id') id: string) { return this.service.deleteModel(id); }
  @Put('models/:id') updateModel(@Param('id') id: string, @Body() body: { alias?: string; providerId?: string; providerModel?: string }) { return this.service.updateModel(id, body); }
  @Get('mcps') mcps() { return this.service.mcps(); }
  @Post('mcps') createMcp(@Body() body: { code?: string; name?: string; endpoint?: string; networkType?: string; bearerToken?: string }) { return this.service.createMcp(body); }
  @Put('mcps/:id') updateMcp(@Param('id') id: string, @Body() body: { code?: string; name?: string; endpoint?: string; networkType?: string; bearerToken?: string }) { return this.service.updateMcp(id, body); }
  @Post('mcps/:id/connection-check') connectionCheck(@Param('id') id: string) { return this.service.connectionCheck(id); }
  @Delete('mcps/:id') deleteMcp(@Param('id') id: string) { return this.service.deleteMcp(id); }
  @Get('usage-logs') usageLogs(@Query('from') from?: string, @Query('to') to?: string) { return this.service.usageLogs(from, to); }
  @Get('activities') activities() { return this.service.activities(); }
  @Get('settings') settings() { return this.service.settings(); }
  @Put('settings') updateSettings(@Body() values: Record<string, string>) { return this.service.updateSettings(values); }
}
