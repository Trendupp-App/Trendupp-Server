import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BannerAd } from '../admin/entities/banner-ad.entity';
import { BannerAdRepository } from '../admin/repository/banner-ad.repository';
import { BannerAdsService } from '../admin/services/banner-ads.service';
import { AdminBannerAdsController } from '../admin/controllers/admin-banner-ads.controller';
import { BannerAdsController } from '../users/controllers/banner-ads.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [SequelizeModule.forFeature([BannerAd]), UsersModule],
  providers: [BannerAdRepository, BannerAdsService],
  controllers: [AdminBannerAdsController, BannerAdsController],
  exports: [BannerAdsService, BannerAdRepository],
})
export class AdsModule {}
