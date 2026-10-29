
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';

import { User } from '../src/users/user.entity';
import { Audit } from '../src/audit/entities/audit.entity';
import { CrawledPage } from '../src/audit/entities/crawled-page.entity';
import { SeoResult } from '../src/audit/entities/seo-result.entity';
import { PerformanceResult } from '../src/audit/entities/performance-result.entity';
import { SecurityResult } from '../src/audit/entities/security-result.entity';

describe('PostgreSQL / TypeORM integration', () => {
  let dataSource: DataSource;
  let auditRepository: Repository<Audit>;

  const jobId = `integration-test-${randomUUID()}`;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.TEST_DATABASE_HOST ?? '127.0.0.1',
      port: Number(process.env.TEST_DATABASE_PORT ?? 5432),
      username: process.env.TEST_DATABASE_USER,
      password: process.env.TEST_DATABASE_PASSWORD,
      database: process.env.TEST_DATABASE_NAME,
      entities: [
        User,
        Audit,
        CrawledPage,
        SeoResult,
        PerformanceResult,
        SecurityResult,
      ],
      synchronize: true,
      connectTimeoutMS: 5000,
    });

    await dataSource.initialize();
    auditRepository = dataSource.getRepository(Audit);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('persists and retrieves an audit with its JSONB config', async () => {
    const config = {
      maxPages: 10,
      includeSubdomains: false,
      checks: ['seo', 'security'],
    };

    const audit = auditRepository.create({
      jobId,
      url: 'https://example.com',
      status: 'pending',
      config,
    });

    const saved = await auditRepository.save(audit);

    expect(saved.id).toBeDefined();
    expect(saved.createdAt).toBeInstanceOf(Date);

    const retrieved = await auditRepository.findOneByOrFail({ jobId });

    expect(retrieved.id).toBe(saved.id);
    expect(retrieved.url).toBe('https://example.com');
    expect(retrieved.status).toBe('pending');
    expect(retrieved.userId).toBeNull();
    expect(retrieved.config).toEqual(config);
  });
});
