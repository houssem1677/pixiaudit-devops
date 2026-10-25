import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { Audit } from '../audit/entities/audit.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Audit]),
  ],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}