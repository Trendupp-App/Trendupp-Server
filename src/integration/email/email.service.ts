import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import * as ejs from 'ejs';
import { join } from 'path';

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

    // Set the template directory
    this.templateDir = join(__dirname, 'templates');

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
      } else {
        // Mock mode
        this.logger.log('--- [MOCK EMAIL SENT] ---');
        this.logger.log(`To: ${to}`);
        this.logger.log(`Subject: ${subject}`);
        this.logger.log(`Template: ${templatePath}`);
        this.logger.log(`Body (HTML Rendered): \n${htmlBody}`);
        this.logger.log('--------------------------');
      }
    } catch (error) {
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`Failed to process/send OTP Email to ${to}`, stack);
      throw error;
    }
  }
}
