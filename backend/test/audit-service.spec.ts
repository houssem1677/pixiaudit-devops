
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { HttpService } from '@nestjs/axios';
import { AuditService } from '../src/audit/audit.service';
import { Audit } from '../src/audit/entities/audit.entity';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

describe('AuditService', () => {
  let service: AuditService;

  const auditRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const auditQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
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
    auditQueue.getJob.mockResolvedValue(null);
    auditRepo.remove.mockResolvedValue(undefined);
  });

  // ==========================================
  // CREATE AUDIT
  // ==========================================

  describe('createAudit', () => {
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

    it('does not enqueue an audit if saving to the database fails', async () => {
      const dto = {
        url: 'https://example.com',
        config: { checkSeo: true },
      };

      auditRepo.save.mockRejectedValueOnce(
        new Error('Database unavailable'),
      );

      await expect(service.createAudit(dto, 7)).rejects.toThrow(
        'Database unavailable',
      );

      expect(auditRepo.create).toHaveBeenCalled();
      expect(auditRepo.save).toHaveBeenCalled();
      expect(auditQueue.add).not.toHaveBeenCalled();
    });

    it('propagates the error if adding the audit to the queue fails', async () => {
      const dto = {
        url: 'https://example.com',
        config: { checkSeo: true },
      };

      auditQueue.add.mockRejectedValueOnce(
        new Error('Queue unavailable'),
      );

      await expect(service.createAudit(dto, 7)).rejects.toThrow(
        'Queue unavailable',
      );

      expect(auditRepo.save).toHaveBeenCalledWith({
        id: 42,
        jobId: 'audit_test-uuid-1234',
        userId: 7,
        url: 'https://example.com',
        status: 'pending',
        config: { checkSeo: true },
      });

      expect(auditQueue.add).toHaveBeenCalledWith('run', {
        auditId: 42,
        jobId: 'audit_test-uuid-1234',
        url: 'https://example.com',
        config: { checkSeo: true },
      });
    });
  });

  // ==========================================
  // CANCEL AUDIT
  // ==========================================

  describe('cancelAudit', () => {
    it('updates an existing audit status to failed', async () => {
      auditRepo.findOne.mockResolvedValue({
        id: 42,
        jobId: 'audit-123',
        status: 'in_progress',
      });

      auditRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.cancelAudit('audit-123');

      expect(auditRepo.findOne).toHaveBeenCalledWith({
        where: { jobId: 'audit-123' },
      });

      expect(auditRepo.update).toHaveBeenCalledWith(42, {
        status: 'failed',
      });

      expect(result).toEqual({
        job_id: 'audit-123',
        status: 'failed',
      });
    });

    it('throws an error when the audit does not exist', async () => {
      auditRepo.findOne.mockResolvedValue(null);

      await expect(
        service.cancelAudit('unknown-job'),
      ).rejects.toThrow('Audit not found');

      expect(auditRepo.update).not.toHaveBeenCalled();
    });

    it('propagates an error if updating the audit fails', async () => {
      auditRepo.findOne.mockResolvedValue({
        id: 42,
        jobId: 'audit-123',
      });

      auditRepo.update.mockRejectedValue(
        new Error('Database update failed'),
      );

      await expect(
        service.cancelAudit('audit-123'),
      ).rejects.toThrow('Database update failed');
    });
  });

  // ==========================================
  // FIND ALL AUDITS
  // ==========================================

  describe('findAll', () => {
    let queryBuilder: {
      orderBy: jest.Mock;
      where: jest.Mock;
      getMany: jest.Mock;
    };

    beforeEach(() => {
      queryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      };

      auditRepo.createQueryBuilder.mockReturnValue(queryBuilder);
    });

    it('returns all audits for an admin', async () => {
      const audits = [{ id: 1 }, { id: 2 }];

      queryBuilder.getMany.mockResolvedValue(audits);

      const result = await service.findAll('7', true);

      expect(auditRepo.createQueryBuilder).toHaveBeenCalledWith('audit');

      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'audit.createdAt',
        'DESC',
      );

      expect(queryBuilder.where).not.toHaveBeenCalled();
      expect(result).toEqual(audits);
    });

    it('filters audits by user ID for a regular user', async () => {
      const audits = [{ id: 1, userId: 7 }];

      queryBuilder.getMany.mockResolvedValue(audits);

      const result = await service.findAll('7', false);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'audit.userId = :userId',
        { userId: '7' },
      );

      expect(result).toEqual(audits);
    });

    it('rejects a regular user when no user ID is provided', async () => {
      await expect(
        service.findAll(undefined, false),
      ).rejects.toThrow(
        'User ID is required to access audits',
      );

      expect(queryBuilder.where).not.toHaveBeenCalled();
      expect(queryBuilder.getMany).not.toHaveBeenCalled();
    });

    it('propagates database errors', async () => {
      queryBuilder.getMany.mockRejectedValue(
        new Error('Database unavailable'),
      );

      await expect(
        service.findAll('7', false),
      ).rejects.toThrow('Database unavailable');
    });
  });

  // ==========================================
  // FIND ONE AUDIT
  // ==========================================

  describe('findOne', () => {
    it('returns an audit with its related entities', async () => {
      const audit = {
        id: 42,
        jobId: 'audit-123',
        pages: [],
        securityResult: null,
      };

      auditRepo.findOne.mockResolvedValue(audit);

      const result = await service.findOne('audit-123');

      expect(auditRepo.findOne).toHaveBeenCalledWith({
        where: { jobId: 'audit-123' },
        relations: [
          'pages',
          'pages.seoResult',
          'pages.performanceResult',
          'securityResult',
        ],
      });

      expect(result).toEqual(audit);
    });

    it('returns null when the audit does not exist', async () => {
      auditRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne('unknown-job');

      expect(result).toBeNull();
    });

    it('propagates database errors', async () => {
      auditRepo.findOne.mockRejectedValue(
        new Error('Database unavailable'),
      );

      await expect(
        service.findOne('audit-123'),
      ).rejects.toThrow('Database unavailable');
    });
  });

  // ==========================================
  // FIND AUDITS BY USER ID
  // ==========================================

  describe('findByUserId', () => {
    it('returns only the requested user audits with the expected fields and ordering', async () => {
      const audits = [
        { id: 2, jobId: 'audit-2', userId: 7 },
        { id: 1, jobId: 'audit-1', userId: 7 },
      ];

      auditRepo.find.mockResolvedValue(audits);

      const result = await service.findByUserId(7);

      expect(auditRepo.find).toHaveBeenCalledWith({
        where: { userId: 7 },
        order: { createdAt: 'DESC' },
        select: [
          'id',
          'jobId',
          'url',
          'globalScore',
          'createdAt',
          'status',
        ],
      });

      expect(result).toEqual(audits);
    });

    it('propagates database errors', async () => {
      auditRepo.find.mockRejectedValue(
        new Error('Database unavailable'),
      );

      await expect(
        service.findByUserId(7),
      ).rejects.toThrow('Database unavailable');
    });
  });

  // ==========================================
  // DELETE AUDIT
  // ==========================================

  describe('deleteAudit', () => {
    const audit = {
      id: 42,
      jobId: 'audit-123',
      userId: 7,
    };

    beforeEach(() => {
      auditRepo.findOne.mockResolvedValue({ ...audit });
      auditRepo.remove.mockResolvedValue(undefined);
      auditQueue.getJob.mockResolvedValue(null);
    });

    it('allows the owner to delete their audit', async () => {
      const result = await service.deleteAudit('audit-123', 7, false);

      expect(auditRepo.findOne).toHaveBeenCalledWith({
        where: { jobId: 'audit-123' },
      });

      expect(auditQueue.getJob).toHaveBeenCalledWith('audit-123');
      expect(auditRepo.remove).toHaveBeenCalledWith(audit);

      expect(result).toEqual({
        message: 'Audit supprimé avec succès',
      });
    });

    it('allows an admin to delete another user audit', async () => {
      const result = await service.deleteAudit('audit-123', 99, true);

      expect(auditRepo.remove).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Audit supprimé avec succès',
      });
    });

    it('rejects a user who does not own the audit', async () => {
      await expect(
        service.deleteAudit('audit-123', 99, false),
      ).rejects.toThrow(
        'Vous ne pouvez pas supprimer cet audit',
      );

      expect(auditQueue.getJob).not.toHaveBeenCalled();
      expect(auditRepo.remove).not.toHaveBeenCalled();
    });

    it('rejects deletion when the user ID is missing', async () => {
      await expect(
        service.deleteAudit('audit-123', undefined, false),
      ).rejects.toThrow(
        'Vous ne pouvez pas supprimer cet audit',
      );

      expect(auditRepo.remove).not.toHaveBeenCalled();
    });

    it('throws when the audit does not exist', async () => {
      auditRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteAudit('unknown-job', 7, false),
      ).rejects.toThrow('Audit non trouvé');

      expect(auditQueue.getJob).not.toHaveBeenCalled();
      expect(auditRepo.remove).not.toHaveBeenCalled();
    });

    it('removes the Bull job before removing the audit record', async () => {
      const job = {
        remove: jest.fn().mockResolvedValue(undefined),
      };

      auditQueue.getJob.mockResolvedValue(job);

      await service.deleteAudit('audit-123', 7, false);

      expect(auditQueue.getJob).toHaveBeenCalledWith('audit-123');
      expect(job.remove).toHaveBeenCalled();
      expect(auditRepo.remove).toHaveBeenCalledWith(audit);
    });

    it('propagates queue removal errors without deleting the database record', async () => {
      const job = {
        remove: jest.fn().mockRejectedValue(
          new Error('Queue removal failed'),
        ),
      };

      auditQueue.getJob.mockResolvedValue(job);

      await expect(
        service.deleteAudit('audit-123', 7, false),
      ).rejects.toThrow('Queue removal failed');

      expect(auditRepo.remove).not.toHaveBeenCalled();
    });

    it('propagates database removal errors', async () => {
      auditRepo.remove.mockRejectedValue(
        new Error('Database removal failed'),
      );

      await expect(
        service.deleteAudit('audit-123', 7, false),
      ).rejects.toThrow('Database removal failed');
    });
  });
});
