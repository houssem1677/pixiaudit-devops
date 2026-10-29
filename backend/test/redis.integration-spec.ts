import { randomUUID } from 'node:crypto';
import Queue from 'bull';

describe('Redis / Bull integration', () => {
  let queue: Queue;
  let createdJobId: string | undefined;

  beforeAll(async () => {
    queue = new Queue(`redis-integration-${randomUUID()}`, {
      redis: {
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6380),
      },
    });

    await queue.isReady();
  });

  afterAll(async () => {
    try {
      if (createdJobId && queue) {
        const job = await queue.getJob(createdJobId);
        if (job) {
          await job.remove();
        }
      }
    } finally {
      if (queue) {
        await queue.close();
      }
    }
  });

  it('enqueues a job and retrieves its name and payload from Redis', async () => {
    const payload = {
      auditId: 123,
      jobId: `integration-${randomUUID()}`,
      url: 'https://example.com',
      config: {
        checks: ['seo', 'security'],
      },
    };

    const job = await queue.add('integration-check', payload);
    createdJobId = job.id?.toString();

    expect(createdJobId).toBeDefined();

    const retrievedJob = await queue.getJob(createdJobId!);

    expect(retrievedJob).toBeDefined();
    expect(retrievedJob!.name).toBe('integration-check');
    expect(retrievedJob!.data).toEqual(payload);
    expect(await retrievedJob!.getState()).toBe('waiting');
  });
});
