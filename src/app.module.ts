import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { WinstonModule } from 'nest-winston';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { getLoggerConfig } from './shared/logger/logger.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './domains/users/users.module';
import { AuthModule } from './domains/auth/auth.module';

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

    // Domain Modules
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
