import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { WinstonModule } from 'nest-winston';
import { HttpLoggerMiddleware } from './shared/logger/http-logger.middleware';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { getLoggerConfig } from './shared/logger/logger.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NOTIFICATIONS_QUEUE } from './domains/notifications/notifications.constants';
import { UsersModule } from './domains/users/users.module';
import { AuthModule } from './domains/auth/auth.module';
import { CampaignsModule } from './domains/campaigns/campaigns.module';
import { AdminModule } from './domains/admin/admin.module';
import { ProfileModule } from './domains/profile/profile.module';
import { DisputesModule } from './domains/disputes/disputes.module';
import { SocialsModule } from './domains/socials/socials.module';
import { NotificationsModule } from './domains/notifications/notifications.module';
import { PostMetricsModule } from './domains/post-metrics/post-metrics.module';
import { NewsModule } from './domains/news/news.module';
import { TransactionsModule } from './domains/transactions/transactions.module';
import { AdsModule } from './domains/ads/ads.module';

@Module({
  imports: [
    // Task Scheduler
    ScheduleModule.forRoot(),

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
      useFactory: (configService: ConfigService) => {
        const isDev = configService.get<string>('env') === 'development';
        return {
          connection: {
            host: isDev ? '127.0.0.1' : configService.get<string>('redis.host'),
            port: isDev ? 6379 : configService.get<number>('redis.port'),
            // AWS ElastiCache Serverless requires in-transit encryption (TLS).
            // Without this, the connection to the *.serverless.*.cache.amazonaws.com
            // endpoint silently fails/hangs. Only applied outside local dev.
            ...(!isDev && {
              tls: configService.get('redis.tls') ?? {
                servername: configService.get<string>('redis.host'),
              },
            }),
            // In development, connect lazily and stop retrying after the first failure
            // so the server starts cleanly without a local Redis instance.
            // NotificationsService already has a try/catch fallback dispatcher for when
            // the queue is unreachable, so notifications still work inline.
            ...(isDev && {
              lazyConnect: true,
              enableOfflineQueue: false,

              retryStrategy: () => null, // give up after first failure — no ECONNREFUSED spam
            }),
          },
        };
      },
    }),

    // Health endpoint's Redis probe — registering an already-registered
    // queue name reuses the same underlying queue token.
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),

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
    SocialsModule,
    NotificationsModule,
    NewsModule,
    TransactionsModule,
    AdsModule,
    PostMetricsModule,
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
