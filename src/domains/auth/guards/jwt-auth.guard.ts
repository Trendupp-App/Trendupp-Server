import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { UsersService } from '../../users/services/users.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('jwt.secret') ||
      'trendupp-default-secret-key-for-development-and-testing';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string }; user?: any }>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { id: string; email: string };

      // Load user with niches
      const user = await this.usersService.findOneWithNiches(decoded.id);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User is inactive or no longer exists');
      }

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
