import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface RequestUser {
  role?: { name: string } | string;
}

/**
 * Guard that checks whether the authenticated user's role matches
 * any of the roles specified by the `@Roles()` decorator on the route.
 *
 * Must be used **after** `JwtAuthGuard` so that `request.user` is populated.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @Roles() decorator is applied, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const userRole: string | undefined =
      typeof user.role === 'object' && user.role !== null ? user.role.name : user.role;

    if (!userRole || !requiredRoles.includes(userRole)) {
      console.error('Access denied, only brands can create campaigns');
      throw new ForbiddenException(`Access denied`);
    }

    return true;
  }
}
