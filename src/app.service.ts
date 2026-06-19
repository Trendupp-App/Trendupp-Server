import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHomeInfo() {
    return {
      name: 'Trendupp API',
      description: 'The Trendupp Social Commerce Backend API v1.0',
      docs: '/docs',
      status: 'healthy',
      author: 'The prodCycle Engineering Team',
    };
  }

  getHealth(): string {
    return 'Health check passed for Trendupp v1';
  }
}
