import { Controller, Patch, Get, Param, Body, Request } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { UpdateRecommendationsDto } from './dto/update-recommendations.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('audit')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  /**
   * PATCH /audit/:jobId/recommendations - Update recommendations manually
   */
  @Patch(':jobId/recommendations')
  async update(
    @Param('jobId') jobId: string,
    @Body() body: UpdateRecommendationsDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id; // Get authenticated user ID
    return this.recommendationsService.update(
      jobId,
      body.recommendations,
      userId,
    );
  }

  /**
   * ✅ NEW: GET /audit/:jobId/recommendations/history - Get recommendation history
   */
  @Public()
  @Get(':jobId/recommendations/history')
  async getHistory(@Param('jobId') jobId: string) {
    return this.recommendationsService.getHistory(jobId);
  }
}
