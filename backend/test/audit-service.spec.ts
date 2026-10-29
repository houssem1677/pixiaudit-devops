import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { HttpService } from '@nestjs/axios';
import { AuditService } from '../src/audit/audit.service';
import { Audit } from '../src/audit/entities/audit.entity';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

describe('AuditService - createAudit', () => {
  let service: AuditService;

  const auditRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const auditQueue = {
    add: jest.fn(),
  };

  const httpService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getQueueToken('audit'),
          useValue: auditQueue,
        },
        {
          provide: HttpService,
          useValue: httpService,
        },
        {
          provide: getRepositoryToken(Audit),
          useValue: auditRepo,
        },
      ],
    }).compile();

    service = moduleRef.get(AuditService);

    auditRepo.create.mockImplementation((data) => ({
      id: 42,
      ...data,
    }));
    auditRepo.save.mockImplementation(async (audit) => audit);
    auditQueue.add.mockResolvedValue({ id: 'mock-queue-job' });
  });

  it('saves a pending audit, queues it, and returns the job details', async () => {
    const dto = {
      url: 'https://example.com',
      config: { checkSeo: true },
    };

    const result = await service.createAudit(dto, 7);

    expect(auditRepo.create).toHaveBeenCalledWith({
      jobId: 'audit_test-uuid-1234',
      userId: 7,
      url: 'https://example.com',
      status: 'pending',
      config: { checkSeo: true },
    });

    expect(auditRepo.save).toHaveBeenCalled();

    expect(auditQueue.add).toHaveBeenCalledWith('run', {
      auditId: 42,
      jobId: 'audit_test-uuid-1234',
      url: 'https://example.com',
      config: { checkSeo: true },
    });

    expect(result).toEqual({
      job_id: 'audit_test-uuid-1234',
      url: 'https://example.com',
      status: 'pending',
    });
  });
});
