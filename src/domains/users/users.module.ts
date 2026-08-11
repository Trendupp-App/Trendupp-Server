import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from './entities/user.entity';
import { Niche } from './entities/niche.entity';
import { Nationality } from './entities/nationality.entity';
import { State } from './entities/state.entity';
import { UserNiche } from './entities/user-niche.entity';
import { Bank } from './entities/bank.entity';
import { Industry } from './entities/industry.entity';
import { UserIndustry } from './entities/user-industry.entity';
import { PortfolioItem } from './entities/portfolio-item.entity';
import { UserRepository } from './repository/user.repository';
import { NicheRepository } from './repository/niche.repository';
import { NationalityRepository } from './repository/nationality.repository';
import { StateRepository } from './repository/state.repository';
import { BankRepository } from './repository/bank.repository';
import { IndustryRepository } from './repository/industry.repository';
import { PortfolioItemRepository } from './repository/portfolio-item.repository';
import { UsersService } from './services/users.service';
import { AccountLifecycleScheduler } from './services/account-lifecycle.scheduler';
import { PortfolioService } from './services/portfolio.service';
import { TokenExpirationScheduler } from './services/token-expiration.scheduler';
import { UserTokenLedger } from './entities/user-token-ledger.entity';
import { EmailModule } from '../../integration/email/email.module';
import { S3Service } from '../../integration/s3/s3.service';
import { Role } from './entities/role.entity';
import { RoleRepository } from './repository/role.repository';
import { UsersController } from './controllers/users.controller';
import { PortfolioController } from './controllers/portfolio.controller';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { MarketingBudget } from './entities/marketing-budget.entity';
import { MarketingBudgetRepository } from './repository/marketing-budget.repository';

@Module({
  imports: [
    SequelizeModule.forFeature([
      User,
      Niche,
      Nationality,
      State,
      UserNiche,
      Role,
      Bank,
      Industry,
      UserIndustry,
      Campaign,
      PortfolioItem,
      UserTokenLedger,
      MarketingBudget,
    ]),
    EmailModule,
  ],
  providers: [
    UserRepository,
    NicheRepository,
    NationalityRepository,
    StateRepository,
    RoleRepository,
    BankRepository,
    IndustryRepository,
    PortfolioItemRepository,
    UsersService,
    AccountLifecycleScheduler,
    TokenExpirationScheduler,
    PortfolioService,
    S3Service,
    MarketingBudgetRepository,
  ],
  controllers: [UsersController, PortfolioController],
  exports: [
    UsersService,
    UserRepository,
    RoleRepository,
    NicheRepository,
    NationalityRepository,
    StateRepository,
    BankRepository,
    IndustryRepository,
    MarketingBudgetRepository,
  ],
})
export class UsersModule {}
