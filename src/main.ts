import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3002;

  // Winston Logger configuration
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // CORS
  const origins = configService.get<string>('cors.allowedOrigins');
  app.enableCors({
    origin: origins === '*' ? true : origins?.split(','),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Global Prefix
  app.setGlobalPrefix('api');

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const nodeEnv = configService.get<string>('NODE_ENV');

  // Swagger
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Trendupp API')
      .setDescription('The Trendupp Social Commerce Backend API description')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'onboarding-key')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api/v1`);
  if (nodeEnv !== 'production') {
    console.log(`Swagger documentation available on: http://localhost:${port}/docs`);
  }
}
void bootstrap();
