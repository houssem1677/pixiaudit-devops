
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

jest.mock('../src/audit/audit.service', () => ({
  AuditService: class AuditService {},
}));

import { AuditController } from '../src/audit/audit.controller';
import { AuditService } from '../src/audit/audit.service';

describe('Audit health endpoint (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: {},
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /audit/health returns the audit service status', async () => {
    await request(app.getHttpServer())
      .get('/audit/health')
      .expect(200)
      .expect({
        status: 'ok',
        service: 'pixiaudit-backend-audit',
      });
  });
});
