import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NewsService } from './news.service';

@Injectable()
export class NewsScheduler {
  private readonly logger = new Logger(NewsScheduler.name);

  constructor(private readonly newsService: NewsService) {}

  /**
   * Cron job that checks for scheduled news articles whose scheduledAt date has arrived,
   * and automatically transitions their status to 'published'.
   * Runs every minute.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledNewsPublication(): Promise<void> {
    try {
      const publishedCount = await this.newsService.publishDueScheduledNews();
      if (publishedCount > 0) {
        this.logger.log(`Published ${publishedCount} scheduled news article(s).`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing scheduled news publications: ${message}`);
    }
  }
}
