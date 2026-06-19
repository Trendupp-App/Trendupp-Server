import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import * as ejs from 'ejs';
import { join } from 'path';
import { existsSync } from 'fs';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private sesClient: SESClient | null = null;
  private readonly fromEmail: string;
  private readonly templateDir: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('aws.ses.region');
    const accessKey = this.configService.get<string>('aws.ses.accessKey');
    const secretKey = this.configService.get<string>('aws.ses.secretKey');
    this.fromEmail = this.configService.get<string>('aws.ses.fromEmail', 'noreply@trendupp.com');

    // Set the template directory with fallback for dev/compilation environments
    const possiblePaths = [
      join(__dirname, 'templates'),
      join(process.cwd(), 'src', 'integration', 'email', 'templates'),
    ];
    let resolvedPath = possiblePaths[0];
    for (const p of possiblePaths) {
      if (existsSync(p)) {
        resolvedPath = p;
        break;
      }
    }
    this.templateDir = resolvedPath;

    if (region && accessKey && secretKey) {
      this.sesClient = new SESClient({
        region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
      });
      this.logger.log('AWS SES Client initialized');
    } else {
      this.logger.warn(
        'AWS SES credentials missing. Email service running in MOCK mode (Logging to console).',
      );
    }
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    const subject = 'Your Trendupp Verification Code';

    try {
      // Render the template
      const templatePath = join(this.templateDir, 'otp.ejs');
      const htmlBody = await ejs.renderFile(templatePath, { otp });

      if (this.sesClient) {
        try {
          const command = new SendEmailCommand({
            Destination: { ToAddresses: [to] },
            Message: {
              Body: { Html: { Data: htmlBody } },
              Subject: { Data: subject },
            },
            Source: this.fromEmail,
          });
          await this.sesClient.send(command);
          this.logger.log(`OTP Email sent successfully to ${to}`);
        } catch (sesError) {
          // SES rejected the send (e.g. sandbox mode — recipient not verified).
          // Fall back to console logging so the signup flow is not blocked.
          const message = sesError instanceof Error ? sesError.message : String(sesError);
          this.logger.warn(
            `AWS SES could not deliver email to ${to} (falling back to mock mode): ${message}`,
          );
          this.logger.log('--- [FALLBACK MOCK EMAIL] ---');
          this.logger.log(`To: ${to}`);
          this.logger.log(`Subject: ${subject}`);
          this.logger.log(`OTP Code: ${otp}`);
          this.logger.log('-----------------------------');
        }
      } else {
        // No SES credentials — pure mock mode
        this.logger.log('--- [MOCK EMAIL SENT] ---');
        this.logger.log(`To: ${to}`);
        this.logger.log(`Subject: ${subject}`);
        this.logger.log(`OTP Code: ${otp}`);
        this.logger.log('--------------------------');
      }
    } catch (error) {
      // Only template rendering errors bubble up as a 500 here
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`Failed to render OTP email template for ${to}`, stack);
      throw error;
    }
  }
}
