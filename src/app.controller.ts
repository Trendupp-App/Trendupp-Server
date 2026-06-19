import { Controller, Get, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/')
  @Version(VERSION_NEUTRAL)
  getHome() {
    return this.appService.getHomeInfo();
  }

  @Get('/health')
  getHealth(): string {
    return this.appService.getHealth();
  }
}
