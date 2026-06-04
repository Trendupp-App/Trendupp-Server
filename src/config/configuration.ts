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
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS || '*',
  },
});
