export default () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT as string, 10) || 3000,
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT as string, 10) || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT as string, 10) || 6379,
  },
  betterstack: {
    sourceToken: process.env.BETTERSTACK_SOURCE_TOKEN,
  },
  aws: {
    s3: {
      region: process.env.AWS_S3_REGION,
      accessKey: process.env.AWS_S3_ACCESS_KEY,
      secretKey: process.env.AWS_S3_SECRET_KEY,
      bucket: process.env.AWS_S3_BUCKET,
    },
    ses: {
      region: process.env.AWS_SES_REGION,
      accessKey: process.env.AWS_SES_ACCESS_KEY,
      secretKey: process.env.AWS_SES_SECRET_KEY,
      fromEmail: process.env.AWS_SES_FROM_EMAIL,
    },
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS || '*',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'trendupp-default-secret-key-for-development-and-testing',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  onboardingApiKey:
    process.env.ONBOARDING_API_KEY ||
    'trendupp-default-onboarding-api-key-for-development-and-testing',
  google: {
    clientIdWeb: process.env.GOOGLE_CLIENT_ID_WEB,
    clientIdIos: process.env.GOOGLE_CLIENT_ID_IOS,
    clientIdAndroid: process.env.GOOGLE_CLIENT_ID_ANDROID,
  },
  tiktok: {
    clientKey: process.env.TIKTOK_CLIENT_KEY,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
  },
  instagram: {
    appId: process.env.INSTAGRAM_APP_ID,
    appSecret: process.env.INSTAGRAM_APP_SECRET,
  },
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
  },
  twitter: {
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
  },
  stream: {
    apiKey: process.env.STREAM_API_KEY,
    apiSecret: process.env.STREAM_API_SECRET,
  },
});
