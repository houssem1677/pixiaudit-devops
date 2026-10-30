import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import type { Queue } from 'bull';
import { firstValueFrom } from 'rxjs';
import { CreateAuditDto } from './dto/create-audit.dto';
import { Audit } from './entities/audit.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuditService {
  constructor(
    @InjectQueue('audit')
    private readonly auditQueue: Queue,
    private readonly httpService: HttpService,
    @InjectRepository(Audit)
    private readonly auditRepo: Repository<Audit>,
  ) {}

  // ── Create audit — enqueue and return immediately ─────────────────────────
  async createAudit(dto: CreateAuditDto, userId?: number) {
    const jobId = `audit_${uuidv4()}`;
    console.log(`[AuditService] Enqueuing — job_id=${jobId} url=${dto.url}`);

    const audit = this.auditRepo.create({
      jobId,
      userId,
      url:    dto.url,
      status: 'pending',
      config: dto.config ?? {},
    });
    await this.auditRepo.save(audit);

    await this.auditQueue.add('run', {
      auditId: audit.id,
      jobId,
      url:     dto.url,
      config:  dto.config ?? {},
    });

    console.log(`[AuditService] ✅ Enqueued — job_id=${jobId}`);

    return {
      job_id: jobId,
      url:    dto.url,
      status: 'pending',
    };
  }

  // ── Cancel audit ──────────────────────────────────────────────────────────
  async cancelAudit(jobId: string) {
    const audit = await this.auditRepo.findOne({ where: { jobId } });
    if (!audit) throw new Error('Audit not found');
    await this.auditRepo.update(audit.id, { status: 'failed' });
    return { job_id: jobId, status: 'failed' };
  }

  async detectCms(url: string): Promise<{ cms: string | null }> {
  try {
    const response = await firstValueFrom(
      this.httpService.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        maxRedirects: 5,
      }),
    );

    const html = response.data.toLowerCase();
    const headers = Object.fromEntries(
      Object.entries(response.headers).map(([k, v]) => [k.toLowerCase(), String(v).toLowerCase()]),
    );

    // WordPress
    if (html.includes('/wp-content/') || html.includes('/wp-includes/') || html.includes('wp-json') || html.includes('wordpress')) {
      return { cms: 'WordPress' };
    }
    // Joomla
    if (html.includes('/components/com_') || html.includes('joomla') || html.includes('/media/jui/')) {
      return { cms: 'Joomla' };
    }
    // Drupal
    if (html.includes('drupal') || html.includes('/sites/default/files/') || html.includes('drupal.settings')) {
      return { cms: 'Drupal' };
    }
    // Shopify
    if (html.includes('shopify') || html.includes('myshopify.com') || html.includes('cdn.shopify')) {
      return { cms: 'Shopify' };
    }
    // Magento
    if (html.includes('magento') || html.includes('mage/cookies') || html.includes('varien')) {
      return { cms: 'Magento' };
    }
    // PrestaShop
    if (html.includes('prestashop') || html.includes('/modules/prestashop') || html.includes('id_product') || html.includes('addtocart')) {
      return { cms: 'PrestaShop' };
    }
    // Wix
    if (html.includes('wix.com') || html.includes('_wix_') || html.includes('wixsite.com') || html.includes('wixstatic')) {
      return { cms: 'Wix' };
    }
    // Squarespace
    if (html.includes('squarespace') || html.includes('static.squarespace') || html.includes('squarespace-cdn')) {
      return { cms: 'Squarespace' };
    }
    // Webflow
    if (html.includes('webflow') || html.includes('wf-form') || html.includes('webflow.com')) {
      return { cms: 'Webflow' };
    }
    // Ghost
    if (html.includes('ghost.io') || html.includes('content/themes/ghost') || html.includes('ghost-url')) {
      return { cms: 'Ghost' };
    }
    // TYPO3
    if (html.includes('typo3') || html.includes('typo3temp') || html.includes('typo3conf')) {
      return { cms: 'TYPO3' };
    }
    // OpenCart
    if (html.includes('opencart') || html.includes('catalog/view/theme') || html.includes('route=common')) {
      return { cms: 'OpenCart' };
    }
    // WooCommerce
    if (html.includes('woocommerce') || html.includes('wc-cart') || html.includes('wc_add_to_cart')) {
      return { cms: 'WooCommerce' };
    }
    // Blogger
    if (html.includes('blogger.com') || html.includes('blogspot.com') || html.includes('www.blogger.com/static')) {
      return { cms: 'Blogger' };
    }
    // HubSpot
    if (html.includes('hubspot') || html.includes('hs-sites.com') || html.includes('hsforms')) {
      return { cms: 'HubSpot' };
    }
    // Notion
    if (html.includes('notion.so') || html.includes('notion.site')) {
      return { cms: 'Notion' };
    }
    // Contentful
    if (html.includes('contentful') || html.includes('ctfassets.net')) {
      return { cms: 'Contentful' };
    }
    // Adobe AEM
    if (html.includes('aem') || html.includes('/content/dam/') || html.includes('/etc/clientlibs/')) {
      return { cms: 'Adobe AEM' };
    }
    // Sitecore
    if (html.includes('sitecore') || html.includes('/sitecore/') || html.includes('sitecore.net')) {
      return { cms: 'Sitecore' };
    }
    // October CMS
    if (html.includes('/storage/app/uploads/') || html.includes('october') || html.includes('octobercms')) {
      return { cms: 'October CMS' };
    }

    // Check headers
    if (headers['x-powered-by']) {
      const powered = headers['x-powered-by'];
      if (powered.includes('wordpress')) return { cms: 'WordPress' };
      if (powered.includes('joomla')) return { cms: 'Joomla' };
      if (powered.includes('drupal')) return { cms: 'Drupal' };
    }
    if (headers['x-generator']) {
      const gen = headers['x-generator'];
      if (gen.includes('wordpress')) return { cms: 'WordPress' };
      if (gen.includes('drupal')) return { cms: 'Drupal' };
      if (gen.includes('joomla')) return { cms: 'Joomla' };
    }

    return { cms: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[AuditService] CMS detection failed for ${url}: ${errorMessage}`);
    return { cms: null };
  }
}

  // ── Find all audits ───────────────────────────────────────────────────────
async findAll(userId?: string, isAdmin: boolean = false) {
  console.log('💾 [AUDIT SERVICE] Fetching audits');
  console.log('💾 [AUDIT SERVICE] User ID:', userId);
  console.log('💾 [AUDIT SERVICE] Is Admin:', isAdmin);
  
  const queryBuilder = this.auditRepo
    .createQueryBuilder('audit')
    .orderBy('audit.createdAt', 'DESC');
  
  // ✅ Filter by userId if not admin
  if (isAdmin) {
  console.log('👑 [AUDIT SERVICE] Admin - showing all audits');
  } else {
  if (!userId) {
    throw new ForbiddenException(
      'User ID is required to access audits',
    );
  }

  console.log('🔒 [AUDIT SERVICE] Filtering by userId:', userId);

  queryBuilder.where('audit.userId = :userId', { userId });
  }
  
  const audits = await queryBuilder.getMany();
  
  console.log('✅ [AUDIT SERVICE] Returning', audits.length, 'audits');
  
  return audits;
}
  // ── Find one audit by jobId ───────────────────────────────────────────────
  async findOne(jobId: string) {
    return this.auditRepo.findOne({
      where: { jobId },
      relations: [
        'pages',
        'pages.seoResult',
        'pages.performanceResult',
        'securityResult', // ← FIXED: Changed from securityResults to securityResult
      ],
    });
  }

  async findByUserId(userId: number) {
  return this.auditRepo.find({
    where: { userId },
    order: { createdAt: 'DESC' },
    select: ['id', 'jobId', 'url', 'globalScore', 'createdAt', 'status'],
    });
  }

  async deleteAudit(jobId: string, userId?: number, isAdmin?: boolean) {
  const audit = await this.auditRepo.findOne({ where: { jobId } });
  if (!audit) throw new NotFoundException('Audit non trouvé');

  // Convertir les deux en string pour une comparaison fiable
  if (!isAdmin && String(audit.userId) !== String(userId)) {
    throw new ForbiddenException('Vous ne pouvez pas supprimer cet audit');
  }

  const job = await this.auditQueue.getJob(jobId);
  if (job) await job.remove();
  await this.auditRepo.remove(audit);
  return { message: 'Audit supprimé avec succès' };
}
}