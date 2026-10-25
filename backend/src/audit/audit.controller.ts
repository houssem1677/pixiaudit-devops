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
  Res,
  Req,
  Delete,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuditService } from './audit.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { Public } from '../auth/decorators/public.decorator';
import { PdfService } from '../pdf/pdf.service';

@Controller('audit')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly pdfService: PdfService,
  ) {}

  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'pixiaudit-backend-audit' };
  }

  @Public()
  @Get('detect-cms')
  detectCms(@Query('url') url: string) {
    return this.auditService.detectCms(url);
  }


@Post()
@HttpCode(HttpStatus.OK)
async createAudit(@Body() dto: CreateAuditDto, @Request() req) {
  console.log('\n========== AUDIT CREATION DEBUG ==========');
  console.log('🔍 Full request object keys:', Object.keys(req));
  console.log('🔍 Request user:', req.user);
  console.log('🔍 User ID:', req.user?.id);
  console.log('🔍 Authorization header:', req.headers.authorization?.substring(0, 50) + '...');
  console.log('🔍 Body URL:', dto.url);
  console.log('==========================================\n');
  
  const result = await this.auditService.createAudit(dto, req.user?.id);
  
  console.log('✅ Audit created with userId:', result);
  
  return result;
}

  @Public()
  @Patch(':jobId/cancel')
  cancelAudit(@Param('jobId') jobId: string) {
    return this.auditService.cancelAudit(jobId);
  }

  @Get()
findAll(@Request() req) {
  console.log('📋 [AUDIT LIST] User:', req.user);
  console.log('📋 [AUDIT LIST] Role:', req.user?.role);
  
  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'ADMIN';
  
  return this.auditService.findAll(userId, isAdmin);
}

  @Public()
  @Get(':jobId')
  findOne(@Param('jobId') jobId: string) {
    return this.auditService.findOne(jobId);
  }

  // ✅ NEW: PDF Generation endpoint
  @Public()
  @Get(':jobId/pdf')
  async generatePdf(
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.pdfService.generateReport(jobId);

    const filename = `pixiaudit-${jobId}-${Date.now()}.pdf`;
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  // In audit.controller.ts
  @Get('user/:userId')
  async getAuditsByUser(@Param('userId') userId: number) {
    return this.auditService.findByUserId(userId);
  }
  @Delete(':jobId')
  async remove(@Param('jobId') jobId: string, @Req() req) {
  const userId = req.user?.id;      // selon votre guard JWT
  const isAdmin = req.user?.role === 'ADMIN';
  return this.auditService.deleteAudit(jobId, userId, isAdmin);
  }
}