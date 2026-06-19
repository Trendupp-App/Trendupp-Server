import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHomeInfo() {
    return {
      name: 'Trendupp API',
      description: 'The Trendupp Social Commerce Backend API description',
      version: '1.0',
      docs: '/docs',
      status: 'healthy',
    };
  }

  getHealth(): string {
    return 'Health check passed for Trendupp v1';
  }
}
