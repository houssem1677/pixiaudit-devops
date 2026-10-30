import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';

import { Audit } from '../src/audit/entities/audit.entity';
import { CrawledPage } from '../src/audit/entities/crawled-page.entity';
import { SeoResult } from '../src/audit/entities/seo-result.entity';
import { PerformanceResult } from '../src/audit/entities/performance-result.entity';
import { SecurityResult } from '../src/audit/entities/security-result.entity';
import { RecommendationHistory } from '../src/recommendations/entities/recommendation-history.entity';
import { User, Role } from '../src/users/user.entity';

describe('End-to-end audit flow (real backend, PostgreSQL and Bull/Redis)', () => {
  let app: INestApplication | undefined;
  let dataSource: DataSource | undefined;
  let secretDir: string | undefined;
  let scraperServer: Server | undefined;
  let aiServer: Server | undefined;

  const originalEnv = { ...process.env };
  const testUrl = `https://audit-${randomUUID()}.example.test`;

  beforeAll(async () => {
    const required = [
      'TEST_DATABASE_USER',
      'TEST_DATABASE_PASSWORD',
      'TEST_DATABASE_NAME',
    ] as const;

    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(
          `${key} is required; refusing to use the application's default database.`,
        );
      }
    }

    if (process.env.TEST_DATABASE_NAME !== 'pixiaudit_test') {
      throw new Error(
        'This integration test is restricted to the pixiaudit_test database.',
      );
    }

    secretDir = await mkdtemp(join(tmpdir(), 'pixiaudit-audit-test-'));

    const databasePasswordFile = join(secretDir, 'postgres_password.txt');
    const jwtSecretFile = join(secretDir, 'jwt_secret.txt');
    const smtpPasswordFile = join(secretDir, 'smtp_password.txt');

    await Promise.all([
      writeFile(databasePasswordFile, process.env.TEST_DATABASE_PASSWORD!, {
        mode: 0o600,
      }),
      writeFile(jwtSecretFile, `integration-${randomUUID()}-${randomUUID()}`, {
        mode: 0o600,
      }),
      writeFile(smtpPasswordFile, 'test-only-unused-smtp-password', {
        mode: 0o600,
      }),
    ]);

    Object.assign(process.env, {
      DATABASE_HOST: process.env.TEST_DATABASE_HOST ?? '127.0.0.1',
      DATABASE_PORT: process.env.TEST_DATABASE_PORT ?? '5432',
      DATABASE_USER: process.env.TEST_DATABASE_USER,
      DATABASE_NAME: process.env.TEST_DATABASE_NAME,
      DATABASE_PASSWORD_FILE: databasePasswordFile,
      JWT_SECRET_FILE: jwtSecretFile,
      SMTP_PASSWORD_FILE: smtpPasswordFile,
      SMTP_USER: 'integration-test',
      SMTP_FROM: 'integration-test@example.test',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: '2525',
      REDIS_HOST: process.env.REDIS_HOST ?? '127.0.0.1',
      REDIS_PORT: process.env.REDIS_PORT ?? '6380',
    });

    const scraperRequests: Array<{ path: string; method: string; body: any }> =
      [];
    const aiRequests: Array<{ path: string; method: string; body: any }> = [];

    const scraperFixture = await startJsonFixture((path, method, body) => {
      scraperRequests.push({ path, method, body });

      if (path !== '/scrape' || method !== 'POST') return undefined;

      return {
        job_id: body.job_id,
        status: 'done',
        pages_crawled: 1,
        seo_score: 80,
        performance_score: 75,
        security_score: 90,
        pages: {
          [body.url]: {
            seo: {
              h1_count: 1,
              has_canonical: true,
              anomalies: [
                { type: 'META_MISSING', message: 'Missing meta description' },
              ],
            },
            performance: {
              metrics: { ttfb: 120, lcp: 900 },
              causes: {},
              anomalies: [{ type: 'HIGH_TTFB' }],
            },
          },
        },
        security: {
          ssl: {
            ssl_valid: true,
            ssl_issuer: 'Integration Test CA',
            ssl_expiry: '2030-01-01',
            ssl_days_remaining: 1200,
            anomalies: [],
          },
          headers: {
            present: ['strict-transport-security'],
            missing: ['content-security-policy'],
            anomalies: [{ type: 'MISSING_HEADER' }],
          },
        },
      };
    });

    scraperServer = scraperFixture.server;
    process.env.SCRAPER_URL = scraperFixture.url;

    const aiFixture = await startJsonFixture((path, method, body) => {
      aiRequests.push({ path, method, body });

      if (path !== '/recommendations' || method !== 'POST') return undefined;

      return {
        recommendations: [
          {
            title: 'Integration test recommendation',
            priority: 'Important',
          },
        ],
      };
    });

    aiServer = aiFixture.server;
    process.env.AI_SERVICE_URL = aiFixture.url;

    // Keep references for the assertions added in the next step.
    (globalThis as any).__auditFlowFixtureRequests = {
      scraperRequests,
      aiRequests,
    };

    // Import AppModule only after the test environment has been configured.
    const { AppModule } = require('../src/app.module');
    app = await (await import('@nestjs/core')).NestFactory.create(AppModule);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.listen(0, '127.0.0.1');

    dataSource = app.get(DataSource);
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    for (const server of [scraperServer, aiServer]) {
      if (server?.listening) {
        server.close();
        await once(server, 'close');
      }
    }

    if (secretDir) {
      await rm(secretDir, { recursive: true, force: true });
    }

    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }

    Object.assign(process.env, originalEnv);

    // Referenced in the next step when we add the real HTTP assertions.
    void dataSource;
  });

  async function startJsonFixture(
    handler: (path: string, method: string, body: any) => unknown,
  ): Promise<{ server: Server; url: string }> {
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];

      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const rawBody = Buffer.concat(chunks).toString('utf8');
      let body: any = {};

      if (rawBody) {
        try {
          body = JSON.parse(rawBody);
        } catch {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }
      }

      const result = handler(req.url ?? '/', req.method ?? 'GET', body);

      if (result === undefined) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unexpected fixture request' }));
        return;
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
    });

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address() as AddressInfo;
    return { server, url: `http://127.0.0.1:${address.port}` };
  }

  async function waitForAudit(
    repo: DataSource['manager'],
    jobId: string,
    timeoutMs = 20000,
  ): Promise<Audit> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const audit = await repo.getRepository(Audit).findOne({
        where: { jobId },
      });

      if (audit?.status === 'done' || audit?.status === 'failed') {
        if (audit.status === 'failed') {
          throw new Error(`Audit ${jobId} failed in the background processor.`);
        }
        return audit;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error(`Timed out waiting for audit ${jobId} to finish.`);
  }

  it('submits an audit and verifies persisted scraper results and AI recommendations', async () => {
    if (!app || !dataSource) throw new Error('Application was not initialized');

    const fixtureRequests = (globalThis as any).__auditFlowFixtureRequests;
    const httpServer = app.getHttpServer();
    const integrationUser = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: `integration-${randomUUID()}@example.test`,
        password: randomUUID(),
        role: Role.USER,
      }),
    );
    const token = app.get(JwtService).sign({
      sub: integrationUser.id,
      email: integrationUser.email,
      role: integrationUser.role,
    });

    const submit = await request(httpServer)
      .post('/audit')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: testUrl, config: {} })
      .expect(200);

    expect(submit.body).toMatchObject({
      url: testUrl,
      status: 'pending',
    });
    expect(submit.body.job_id).toEqual(expect.any(String));

    const jobId = submit.body.job_id as string;
    const audit = await waitForAudit(dataSource.manager, jobId);
    const historyRepo = dataSource.getRepository(RecommendationHistory);
    const deadline = Date.now() + 20000;
    let history = await historyRepo.findOne({ where: { auditId: audit.id } });
    while (!history && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      history = await historyRepo.findOne({ where: { auditId: audit.id } });
    }
    if (!history)
      throw new Error('Timed out waiting for AI recommendation history.');
    const refreshedAudit = await dataSource.getRepository(Audit).findOneOrFail({
      where: { id: audit.id },
    });

    expect(audit.status).toBe('done');
    expect(audit.url).toBe(testUrl);
    expect(audit.pagesCrawled).toBe(1);
    const settingsService = app.get(
      require('../src/settings/settings.service').SettingsService,
    );
    const expectedPriorities = await settingsService.calculatePriorities({
      seo: 80,
      performance: 75,
      security: 90,
    });
    expect(audit.globalScore).toBe(expectedPriorities.global.score);
    expect(refreshedAudit.recommendations).toEqual([
      {
        title: 'Integration test recommendation',
        priority: 'Important',
      },
    ]);

    const page = await dataSource.getRepository(CrawledPage).findOne({
      where: { auditId: audit.id },
    });
    expect(page).toBeTruthy();
    expect(page?.url).toBe(testUrl);

    const seo = await dataSource.getRepository(SeoResult).findOne({
      where: { pageId: page!.id },
    });
    expect(seo).toMatchObject({
      h1Count: 1,
      hasCanonical: true,
    });
    expect(seo?.anomalies).toEqual([
      { type: 'META_MISSING', message: 'Missing meta description' },
    ]);

    const performance = await dataSource
      .getRepository(PerformanceResult)
      .findOne({ where: { pageId: page!.id } });
    expect(performance?.metrics).toEqual({ ttfb: 120, lcp: 900 });
    expect(performance?.anomalies).toEqual([{ type: 'HIGH_TTFB' }]);

    const security = await dataSource
      .getRepository(SecurityResult)
      .findOne({ where: { auditId: audit.id } });
    expect(security).toMatchObject({
      sslValid: true,
      sslIssuer: 'Integration Test CA',
      presentHeaders: ['strict-transport-security'],
      missingHeaders: ['content-security-policy'],
    });
    expect(security?.anomalies).toEqual([{ type: 'MISSING_HEADER' }]);

    expect(history.changeType).toBe('ai_generated');
    expect(history?.version).toBe(1);
    expect(JSON.parse(history.recommendations)).toEqual(
      refreshedAudit.recommendations,
    );

    expect(fixtureRequests.scraperRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/scrape',
          method: 'POST',
          body: expect.objectContaining({ job_id: jobId, url: testUrl }),
        }),
      ]),
    );

    expect(fixtureRequests.aiRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/recommendations',
          method: 'POST',
          body: expect.objectContaining({
            job_id: jobId,
            url: testUrl,
            global_score: expectedPriorities.global.score,
            seo_anomalies: ['Meta description manquante'],
            perf_anomalies: ['Temps de réponse serveur élevé (TTFB)'],
            sec_anomalies: ['Header de sécurité manquant'],
          }),
        }),
      ]),
    );
  });
});
