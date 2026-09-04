import { Module } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import { AdminController } from './admin.controller.js';
import { AdminRepository } from './admin.repository.js';
import { AdminService } from './admin.service.js';

@Module({ controllers: [AdminController], providers: [AdminService, AdminRepository, DatabaseService] })
export class AdminModule {}
