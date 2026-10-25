import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as puppeteer from 'puppeteer';
import { Audit } from '../audit/entities/audit.entity';
import { marked } from 'marked';

@Injectable()
export class PdfService {
  constructor(
    @InjectRepository(Audit)
    private readonly auditRepo: Repository<Audit>,
  ) {}

  /**
   * Generate PDF report for an audit
   */
  async generateReport(jobId: string): Promise<Buffer> {
    // Fetch audit with all relations
    const audit = await this.auditRepo.findOne({
      where: { jobId },
      relations: [
        'pages',
        'pages.seoResult',
        'pages.performanceResult',
        'securityResult',
      ],
    });

    if (!audit) {
      throw new NotFoundException(`Audit with job ID ${jobId} not found`);
    }

    if (audit.status !== 'done') {
      throw new Error('Audit must be completed before generating PDF');
    }

    // Generate HTML content
    const html = this.generateHtmlTemplate(audit);

    // Convert HTML to PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      // Use system Chromium on Alpine Docker, fallback to Puppeteer's own binary locally
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      // Generate PDF buffer
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size:10px; width:100%; text-align:center; color:#666; padding:10px 0;">
            <span>PixiAudit - Rapport d'analyse</span>
          </div>
        `,
        footerTemplate: `
          <div style="font-size:10px; width:100%; text-align:center; color:#666; padding:10px 0;">
            <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>
        `,
      });

      // Convert Uint8Array to Buffer
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate HTML template for the PDF
   */
  private generateHtmlTemplate(audit: Audit): string {
    const {
      url,
      globalScore,
      priorities,
      recommendations,
      pagesCrawled,
      createdAt,
      completedAt,
      pages,
      securityResult,
    } = audit;

    // Collect all anomalies by category
    const seoAnomalies: any[] = [];
    const perfAnomalies: any[] = [];

    pages?.forEach((page) => {
      if (page.seoResult?.anomalies) {
        seoAnomalies.push(...page.seoResult.anomalies.map((a) => ({ ...a, url: page.url })));
      }
      if (page.performanceResult?.anomalies) {
        perfAnomalies.push(...page.performanceResult.anomalies.map((a) => ({ ...a, url: page.url })));
      }
    });

    const secAnomalies = securityResult?.anomalies || [];

    // Sort anomalies by priority
    const sortByPriority = (a: any, b: any) => {
      const priorityOrder: Record<string, number> = { 'Critique': 0, 'Important': 1, 'Amélioration': 2 };
      return (priorityOrder[a.level] || 3) - (priorityOrder[b.level] || 3);
    };

    seoAnomalies.sort(sortByPriority);
    perfAnomalies.sort(sortByPriority);
    secAnomalies.sort(sortByPriority);

    // Format recommendations
    const formattedRecommendations = Array.isArray(recommendations)
      ? recommendations
      : typeof recommendations === 'string'
      ? [recommendations]
      : [];

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport PixiAudit - ${url}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background: white;
    }

    .cover {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      page-break-after: always;
    }

    .cover h1 {
      font-size: 48px;
      margin-bottom: 20px;
      font-weight: 700;
    }

    .cover .url {
      font-size: 24px;
      margin-bottom: 40px;
      opacity: 0.9;
    }

    .cover .score-circle {
      width: 200px;
      height: 200px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 40px auto;
      border: 8px solid rgba(255, 255, 255, 0.5);
    }

    .cover .score-circle .score {
      font-size: 72px;
      font-weight: bold;
    }

    .cover .date {
      font-size: 16px;
      opacity: 0.8;
      margin-top: 40px;
    }

    .section {
      padding: 40px 0;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 30px;
      color: #667eea;
      border-bottom: 3px solid #667eea;
      padding-bottom: 10px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }

    .summary-card {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 25px;
      text-align: center;
      border: 2px solid #e9ecef;
    }

    .summary-card .category {
      font-size: 14px;
      text-transform: uppercase;
      color: #666;
      font-weight: 600;
      margin-bottom: 10px;
    }

    .summary-card .score {
      font-size: 48px;
      font-weight: bold;
      color: #667eea;
      margin: 15px 0;
    }

    .summary-card .level {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
    }

    .level.critique { background: #fee; color: #c33; }
    .level.important { background: #ffe; color: #c90; }
    .level.amelioration { background: #efe; color: #3a3; }

    .anomaly-section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }

    .anomaly-section h3 {
      font-size: 24px;
      margin-bottom: 20px;
      color: #495057;
    }

    .anomaly-list {
      list-style: none;
    }

    .anomaly-item {
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 15px 20px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .anomaly-item .badge {
      flex-shrink: 0;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .anomaly-item .badge.critique {
      background: #dc3545;
      color: white;
    }

    .anomaly-item .badge.important {
      background: #ffc107;
      color: #333;
    }

    .anomaly-item .badge.amelioration {
      background: #28a745;
      color: white;
    }

    .anomaly-item .content {
      flex: 1;
    }

    .anomaly-item .content .title {
      font-weight: 600;
      color: #212529;
      margin-bottom: 4px;
    }

    .anomaly-item .content .url-ref {
      font-size: 13px;
      color: #6c757d;
    }

    .recommendations-box {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      border-radius: 8px;
      padding: 25px;
      margin-bottom: 20px;
    }

    .recommendations-box h4 {
      font-size: 18px;
      margin-bottom: 15px;
      color: #495057;
    }

    .recommendations-box p {
      margin-bottom: 12px;
      line-height: 1.8;
    }

    /* Markdown content styling */
    .markdown-content h1,
    .markdown-content h2,
    .markdown-content h3,
    .markdown-content h4 {
      margin-top: 20px;
      margin-bottom: 12px;
      color: #1f2937;
      font-weight: 600;
    }

    .markdown-content h1 { font-size: 24px; }
    .markdown-content h2 { font-size: 20px; }
    .markdown-content h3 { font-size: 18px; }
    .markdown-content h4 { font-size: 16px; }

    .markdown-content p {
      margin-bottom: 12px;
      line-height: 1.8;
      color: #374151;
    }

    .markdown-content ul,
    .markdown-content ol {
      margin-left: 20px;
      margin-bottom: 12px;
    }

    .markdown-content li {
      margin-bottom: 6px;
      line-height: 1.6;
    }

    .markdown-content code {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #dc2626;
    }

    .markdown-content pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 12px 0;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.5;
    }

    .markdown-content pre code {
      background: transparent;
      padding: 0;
      color: #e2e8f0;
    }

    .markdown-content blockquote {
      border-left: 4px solid #cbd5e1;
      padding-left: 16px;
      margin: 12px 0;
      color: #64748b;
      font-style: italic;
    }

    .markdown-content hr {
      border: none;
      border-top: 2px solid #e5e7eb;
      margin: 24px 0;
    }

    .markdown-content strong {
      font-weight: 700;
      color: #111827;
    }

    .markdown-content a {
      color: #2563eb;
      text-decoration: underline;
    }

    .meta-info {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin-top: 30px;
    }

    .meta-info h4 {
      font-size: 18px;
      margin-bottom: 15px;
      color: #495057;
    }

    .meta-info p {
      margin-bottom: 8px;
      color: #6c757d;
    }

    .page-break {
      page-break-after: always;
    }
  </style>
</head>
<body>
  <!-- COVER PAGE -->
  <div class="cover">
    <h1>Rapport d'Analyse PixiAudit</h1>
    <div class="url">${url}</div>
    <div class="score-circle">
      <div class="score">${globalScore || 'N/A'}</div>
    </div>
    <div class="date">
      Analyse réalisée le ${new Date(createdAt).toLocaleDateString('fr-FR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}
    </div>
  </div>

  <!-- EXECUTIVE SUMMARY -->
  <div class="section">
    <h2 class="section-title">📊 Résumé Exécutif</h2>
    
    <div class="summary-grid">
      <div class="summary-card">
        <div class="category">SEO</div>
        <div class="score">${priorities?.seo?.score || 0}</div>
        <span class="level ${(priorities?.seo?.level || '').toLowerCase().replace('é', 'e')}">
          ${priorities?.seo?.level || 'N/A'}
        </span>
      </div>
      
      <div class="summary-card">
        <div class="category">Performance</div>
        <div class="score">${priorities?.performance?.score || 0}</div>
        <span class="level ${(priorities?.performance?.level || '').toLowerCase().replace('é', 'e')}">
          ${priorities?.performance?.level || 'N/A'}
        </span>
      </div>
      
      <div class="summary-card">
        <div class="category">Sécurité</div>
        <div class="score">${priorities?.security?.score || 0}</div>
        <span class="level ${(priorities?.security?.level || '').toLowerCase().replace('é', 'e')}">
          ${priorities?.security?.level || 'N/A'}
        </span>
      </div>
    </div>

    <div class="meta-info">
      <h4>Informations d'Analyse</h4>
      <p><strong>Pages crawlées:</strong> ${pagesCrawled}</p>
      <p><strong>Date de début:</strong> ${new Date(createdAt).toLocaleString('fr-FR')}</p>
      <p><strong>Date de fin:</strong> ${completedAt ? new Date(completedAt).toLocaleString('fr-FR') : 'N/A'}</p>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- RECOMMENDATIONS -->
  ${formattedRecommendations.length > 0 ? `
  <div class="section">
    <h2 class="section-title">💡 Recommandations</h2>
    ${formattedRecommendations.map((rec) => {
      // Convert markdown to HTML
      const htmlContent = typeof rec === 'string' 
        ? marked.parse(rec)
        : marked.parse(rec.text || JSON.stringify(rec));
      
      return `
        <div class="recommendations-box">
          <div class="markdown-content">${htmlContent}</div>
        </div>
      `;
    }).join('')}
  </div>
  ` : ''}
</body>
</html>
    `;
  }
}