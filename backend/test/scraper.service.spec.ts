import { HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { ScraperService } from '../src/audit/scraper.service';

describe('ScraperService HTTP contract', () => {
  let service: ScraperService;
  let httpService: { post: jest.Mock; get: jest.Mock };
  let configService: { get: jest.Mock };

  const scraperUrl = 'http://scraper.test:8002';

  beforeEach(() => {
    httpService = {
      post: jest.fn(),
      get: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue(scraperUrl),
    };

    service = new ScraperService(
      httpService as unknown as HttpService,
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('scrape()', () => {
    const payload = {
      job_id: 'contract-test-123',
      url: 'https://example.com',
      config_override: {
        seo: true,
        security: true,
      },
    };

    it('sends the expected POST request and forwards the scraper response', async () => {
      const scraperResponse = {
        status: 'ok',
        pages_crawled: 3,
        pages: [{ url: 'https://example.com' }],
      };

      httpService.post.mockReturnValue(of({ data: scraperResponse }));

      await expect(service.scrape(payload)).resolves.toEqual(scraperResponse);

      expect(httpService.post).toHaveBeenCalledWith(
        `${scraperUrl}/scrape`,
        payload,
        { timeout: 30 * 60 * 1000 },
      );
    });

    it('converts an HTTP error into a NestJS HttpException preserving its status', async () => {
      const error = Object.assign(new Error('Service unavailable'), {
        response: { status: 503 },
      });

      httpService.post.mockReturnValue(throwError(() => error));

      try {
        await service.scrape(payload);
        fail('Expected scrape() to throw');
      } catch (caught) {
        expect(caught).toBeInstanceOf(HttpException);
        expect((caught as HttpException).getStatus()).toBe(503);
        expect((caught as Error).message).toContain('Scraper error: Service unavailable');
      }
    });

    it('uses status 500 when the HTTP error has no response status', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Connection refused')),
      );

      await expect(service.scrape(payload)).rejects.toMatchObject({
        status: 500,
        message: 'Scraper error: Connection refused',
      });
    });
  });

  describe('health()', () => {
    it('returns true when the scraper health status is ok', async () => {
      httpService.get.mockReturnValue(of({ data: { status: 'ok' } }));

      await expect(service.health()).resolves.toBe(true);
      expect(httpService.get).toHaveBeenCalledWith(`${scraperUrl}/health`);
    });

    it('returns false when the scraper reports a non-ok status', async () => {
      httpService.get.mockReturnValue(of({ data: { status: 'starting' } }));

      await expect(service.health()).resolves.toBe(false);
    });

    it('returns false when the health request fails', async () => {
      httpService.get.mockReturnValue(
        throwError(() => new Error('Connection refused')),
      );

      await expect(service.health()).resolves.toBe(false);
    });
  });
});
