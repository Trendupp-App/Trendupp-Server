import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { News } from './entities/news.entity';
import { NewsController } from './controllers/news.controller';
import { NewsService } from './services/news.service';
import { NewsRepository } from './repository/news.repository';
import { UsersModule } from '../users/users.module';
import { S3Service } from '../../integration/s3/s3.service';

@Module({
  imports: [SequelizeModule.forFeature([News]), UsersModule],
  controllers: [NewsController],
  providers: [NewsService, NewsRepository, S3Service],
  exports: [NewsService],
})
export class NewsModule {}
