import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client | null = null;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('aws.s3.region');
    const accessKey = this.configService.get<string>('aws.s3.accessKey');
    const secretKey = this.configService.get<string>('aws.s3.secretKey');
    this.bucketName = this.configService.get<string>('aws.s3.bucket', 'trendupp-assets');

    const hasValidCredentials =
      accessKey && secretKey && accessKey !== 'your_access_key' && secretKey !== 'your_secret_key';

    if (region && hasValidCredentials) {
      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
      });
      this.logger.log('AWS S3 Client initialized');
    } else {
      this.logger.warn(
        'AWS S3 credentials missing or using placeholders. S3 service running in MOCK mode (returning dormant URLs).',
      );
    }
  }

  async uploadFile(file: Express.Multer.File, folder = 'campaign-covers'): Promise<string> {
    const ext = file.originalname.split('.').pop() ?? 'bin';
    const safeName = file.originalname
      .replace(/\.[^.]+$/, '') // strip extension
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // replace spaces / special chars with dash
      .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
      .slice(0, 60); // cap length
    const key = `${folder}/${Date.now()}-${safeName}.${ext}`;

    if (this.s3Client) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        });
        await this.s3Client.send(command);
        const region = this.configService.get<string>('aws.s3.region');
        return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `S3 upload failed (likely due to invalid credentials: ${errorMessage}). Falling back to dormant URL.`,
        );
      }
    }

    // Fallback dormant URL
    return `https://trendupp-assets.s3.amazonaws.com/images/default-campaign.jpg`;
  }
}
