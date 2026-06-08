import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly expectedApiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.expectedApiKey =
      this.configService.get<string>('onboardingApiKey') ||
      'trendupp-default-onboarding-api-key-for-development-and-testing';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || apiKey !== this.expectedApiKey) {
      throw new UnauthorizedException('Missing or invalid API key');
    }

    return true;
  }
}
