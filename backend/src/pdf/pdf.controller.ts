import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PdfService } from './pdf.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('audit')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  /**
   * GET /audit/:jobId/pdf - Generate and download PDF report
   */
  @Public()
  @Get(':jobId/pdf')
  async generatePdf(
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.pdfService.generateReport(jobId);

    // Set response headers for PDF download
    const filename = `pixiaudit-${jobId}-${Date.now()}.pdf`;
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }
}