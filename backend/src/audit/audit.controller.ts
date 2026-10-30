
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  Req,
  Delete,
} from '@nestjs/common';

import { AuditService } from './audit.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('audit')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
  ) {}

  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'pixiaudit-backend-audit',
    };
  }

  @Public()
  @Get('detect-cms')
  detectCms(@Query('url') url: string) {
    return this.auditService.detectCms(url);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async createAudit(@Body() dto: CreateAuditDto, @Request() req) {
    return this.auditService.createAudit(dto, req.user?.id);
  }

  @Public()
  @Patch(':jobId/cancel')
  cancelAudit(@Param('jobId') jobId: string) {
    return this.auditService.cancelAudit(jobId);
  }

  @Get()
  findAll(@Request() req) {
    console.log('[AUDIT LIST] User:', req.user);
    console.log('[AUDIT LIST] Role:', req.user?.role);

    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN';

    return this.auditService.findAll(userId, isAdmin);
  }

  @Public()
  @Get(':jobId')
  findOne(@Param('jobId') jobId: string) {
    return this.auditService.findOne(jobId);
  }

  @Get('user/:userId')
  async getAuditsByUser(@Param('userId') userId: number) {
    return this.auditService.findByUserId(userId);
  }

  @Delete(':jobId')
  async remove(@Param('jobId') jobId: string, @Req() req) {
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN';

    return this.auditService.deleteAudit(jobId, userId, isAdmin);
  }
}
