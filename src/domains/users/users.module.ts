import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from './entities/user.entity';
import { Niche } from './entities/niche.entity';
import { Nationality } from './entities/nationality.entity';
import { State } from './entities/state.entity';
import { UserNiche } from './entities/user-niche.entity';
import { UserRepository } from './repository/user.repository';
import { NicheRepository } from './repository/niche.repository';
import { NationalityRepository } from './repository/nationality.repository';
import { StateRepository } from './repository/state.repository';
import { UsersService } from './services/users.service';
import { OnboardingService } from './services/onboarding.service';
import { UsersController } from './controllers/users.controller';
import { OnboardingController } from './controllers/onboarding.controller';

import { Role } from './entities/role.entity';
import { RoleRepository } from './repository/role.repository';

@Module({
  imports: [SequelizeModule.forFeature([User, Niche, Nationality, State, UserNiche, Role])],
  providers: [
    UserRepository,
    NicheRepository,
    NationalityRepository,
    StateRepository,
    RoleRepository,
    UsersService,
    OnboardingService,
  ],
  controllers: [UsersController, OnboardingController],
  exports: [UsersService, OnboardingService, UserRepository, RoleRepository],
})
export class UsersModule {}
