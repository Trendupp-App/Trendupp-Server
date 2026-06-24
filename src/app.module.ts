import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { WinstonModule } from 'nest-winston';
import { HttpLoggerMiddleware } from './shared/logger/http-logger.middleware';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { getLoggerConfig } from './shared/logger/logger.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './domains/users/users.module';
import { AuthModule } from './domains/auth/auth.module';
import { CampaignsModule } from './domains/campaigns/campaigns.module';
import { AdminModule } from './domains/admin/admin.module';
import { ProfileModule } from './domains/profile/profile.module';
import { DisputesModule } from './domains/disputes/disputes.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),

    // Logging
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getLoggerConfig(
          configService.get<string>('env', 'development'),
          configService.get<string>('betterstack.sourceToken', ''),
        ),
    }),

    // Database
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        dialect: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        autoLoadModels: true,
        synchronize: false,
        logging: configService.get<string>('env') === 'development',
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false, // For Render/Heroku/AWS self-signed certs
          },
        },
      }),
    }),

    // Task Queue (Redis - BullMQ)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
        },
      }),
    }),

    // Rate Limiting
    ThrottlerModule.forRoot({
      errorMessage: 'too many request try again later',
      throttlers: [
        {
          ttl: 60000, // 60 seconds (in ms)
          limit: 1000, // global fallback ceiling — per-route decorators override this
        },
      ],
    }),

    // Domain Modules
    UsersModule,
    AuthModule,
    CampaignsModule,
    AdminModule,
    ProfileModule,
    DisputesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
