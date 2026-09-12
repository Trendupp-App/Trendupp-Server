import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BannerAd } from '../admin/entities/banner-ad.entity';
import { BannerAdRepository } from '../admin/repository/banner-ad.repository';
import { BannerAdsService } from '../admin/services/banner-ads.service';
import { AdminBannerAdsController } from '../admin/controllers/admin-banner-ads.controller';
import { BannerAdsController } from '../users/controllers/banner-ads.controller';
import { UsersModule } from '../users/users.module';
import { S3Service } from '../../integration/s3/s3.service';

@Module({
  imports: [SequelizeModule.forFeature([BannerAd]), UsersModule],
  providers: [BannerAdRepository, BannerAdsService, S3Service],
  controllers: [AdminBannerAdsController, BannerAdsController],
  exports: [BannerAdsService, BannerAdRepository],
})
export class AdsModule {}
