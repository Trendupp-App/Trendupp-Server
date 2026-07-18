import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Role } from '../../users/entities/role.entity';

export const SYSTEM_ROLES = [
  { name: 'creator', displayName: 'Creator' },
  { name: 'brand', displayName: 'Brand' },
  { name: 'owner', displayName: 'Owner' },
  { name: 'super_admin', displayName: 'Super Admin' },
  { name: 'finance_admin', displayName: 'Finance Admin' },
  { name: 'moderator', displayName: 'Moderator' },
  { name: 'support_agent', displayName: 'Support Agent' },
];

@Injectable()
export class RolesSeederService implements OnModuleInit {
  private readonly logger = new Logger(RolesSeederService.name);

  constructor(
    @InjectModel(Role)
    private readonly roleModel: typeof Role,
  ) {}

  async onModuleInit() {
    await this.seedRoles();
  }

  async seedRoles(): Promise<void> {
    for (const roleDef of SYSTEM_ROLES) {
      const existing = await this.roleModel.findOne({ where: { name: roleDef.name } });
      if (!existing) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await this.roleModel.create({
          name: roleDef.name,
          displayName: roleDef.displayName,
        } as any);
        this.logger.log(`Seeded role: ${roleDef.name} (${roleDef.displayName})`);
      }
    }
  }
}
