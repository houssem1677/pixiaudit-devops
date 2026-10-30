import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ScraperService {
  private readonly scraperUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.scraperUrl = this.config.get<string>(
      'SCRAPER_URL',
      'http://localhost:8002',
    );
  }

  async scrape(payload: {
    job_id: string;
    url: string;
    config_override: Record<string, any>;
  }) {
    try {
      console.log(`[ScraperService] Calling scraper — ${payload.url}`);
      const response = await firstValueFrom(
        this.httpService.post(`${this.scraperUrl}/scrape`, payload, {
          timeout: 30 * 60 * 1000, // 30 minutes max
        }),
      );
      return response.data;
    } catch (error) {
      console.error('[ScraperService] Error:', error.message);
      throw new HttpException(
        `Scraper error: ${error.message}`,
        error.response?.status ?? 500,
      );
    }
  }

  async health(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.scraperUrl}/health`),
      );
      return response.data?.status === 'ok';
    } catch {
      return false;
    }
  }
}
