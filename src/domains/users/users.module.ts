import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from './entities/user.entity';
import { Niche } from './entities/niche.entity';
import { Nationality } from './entities/nationality.entity';
import { State } from './entities/state.entity';
import { UserNiche } from './entities/user-niche.entity';
import { Bank } from './entities/bank.entity';
import { UserRepository } from './repository/user.repository';
import { NicheRepository } from './repository/niche.repository';
import { NationalityRepository } from './repository/nationality.repository';
import { StateRepository } from './repository/state.repository';
import { BankRepository } from './repository/bank.repository';
import { UsersService } from './services/users.service';

import { Role } from './entities/role.entity';
import { RoleRepository } from './repository/role.repository';
import { UsersController } from './controllers/users.controller';

@Module({
  imports: [SequelizeModule.forFeature([User, Niche, Nationality, State, UserNiche, Role, Bank])],
  providers: [
    UserRepository,
    NicheRepository,
    NationalityRepository,
    StateRepository,
    RoleRepository,
    BankRepository,
    UsersService,
  ],
  controllers: [UsersController],
  exports: [
    UsersService,
    UserRepository,
    RoleRepository,
    NicheRepository,
    NationalityRepository,
    StateRepository,
    BankRepository,
  ],
})
export class UsersModule {}
