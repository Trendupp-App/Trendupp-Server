import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator that attaches allowed role names to a route handler.
 * Used in conjunction with `RolesGuard` to restrict access by role.
 *
 * @example
 * ```ts
 * @Roles('brand', 'admin', 'super_admin')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
