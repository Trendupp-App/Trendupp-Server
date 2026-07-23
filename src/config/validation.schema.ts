import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test', 'provision')
    .default('development'),
  PORT: Joi.number().default(3000),

  // Web client base URL (deep links in notification emails)
  WEB_APP_URL: Joi.string().uri().default('https://trendupp.com'),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().optional().default('127.0.0.1'),
  REDIS_PORT: Joi.number().default(6379),

  // BetterStack (Logtail)
  BETTERSTACK_SOURCE_TOKEN: Joi.string().optional(),

  // S3
  AWS_S3_REGION: Joi.string().optional(),
  AWS_S3_ACCESS_KEY: Joi.string().optional(),
  AWS_S3_SECRET_KEY: Joi.string().optional(),
  AWS_S3_BUCKET: Joi.string().optional(),
  AWS_SES_REGION: Joi.string().optional(),
  AWS_SES_ACCESS_KEY: Joi.string().optional(),
  AWS_SES_SECRET_KEY: Joi.string().optional(),
  AWS_SES_FROM_EMAIL: Joi.string().email().optional(),

  // Email transport
  EMAIL_PROVIDER: Joi.string().valid('ses', 'zeptomail').default('ses'),
  EMAIL_FROM: Joi.string().email().optional(),
  EMAIL_FROM_NAME: Joi.string().optional(),
  ZEPTOMAIL_API_URL: Joi.string().uri().optional(),
  // Required only when ZeptoMail is the active provider.
  ZEPTOMAIL_TOKEN: Joi.string().when('EMAIL_PROVIDER', {
    is: 'zeptomail',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  // Security
  ALLOWED_ORIGINS: Joi.string().default('*'),
  JWT_SECRET: Joi.string().default('trendupp-default-secret-key-for-development-and-testing'),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  ONBOARDING_API_KEY: Joi.string().default(
    'trendupp-default-onboarding-api-key-for-development-and-testing',
  ),

  // Google OAuth Client IDs
  GOOGLE_CLIENT_ID_WEB: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_ID_IOS: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_ID_ANDROID: Joi.string().allow('').optional(),

  // TikTok OAuth
  TIKTOK_CLIENT_KEY: Joi.string().allow('').optional(),
  TIKTOK_CLIENT_SECRET: Joi.string().allow('').optional(),

  // Instagram OAuth
  INSTAGRAM_APP_ID: Joi.string().allow('').optional(),
  INSTAGRAM_APP_SECRET: Joi.string().allow('').optional(),

  // Firebase Cloud Messaging (push notifications)
  FIREBASE_SERVICE_ACCOUNT_BASE64: Joi.string().allow('').optional(),

  // YouTube OAuth (social connect)
  YOUTUBE_CLIENT_ID: Joi.string().allow('').optional(),
  YOUTUBE_CLIENT_SECRET: Joi.string().allow('').optional(),

  // Twitter / X OAuth (social connect)
  TWITTER_CLIENT_ID: Joi.string().allow('').optional(),
  TWITTER_CLIENT_SECRET: Joi.string().allow('').optional(),

  // Stream Chat
  STREAM_API_KEY: Joi.string().allow('').optional(),
  STREAM_API_SECRET: Joi.string().allow('').optional(),

  // Pandascrow Escrow System
  PANDASCROW_API_KEY: Joi.string().allow('').optional(),
  PANDASCROW_SECRET_KEY: Joi.string().allow('').optional(),
  PANDASCROW_API_URL: Joi.string().uri().allow('').optional(),
  PANDASCROW_ACCOUNT_UUID: Joi.string().allow('').optional(),
  PAYMENT_CALLBACK_URL: Joi.string().uri().allow('').optional(),
});
