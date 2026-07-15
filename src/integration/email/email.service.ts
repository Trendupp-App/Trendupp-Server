import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import * as ejs from 'ejs';
import { join } from 'path';
import { existsSync } from 'fs';

export interface SendEmailOptions {
  to: string;
  subject: string;
  /** Template name (without extension) in integration/email/templates */
  template: string;
  data: Record<string, unknown>;
  /**
   * When true, SES delivery failures are thrown to the caller (used by the
   * notification queue worker so failures are recorded/retryable). Defaults
   * to false: the legacy behavior of falling back to a console mock so
   * request-path flows (signup OTP) are never blocked by SES.
   */
  throwOnFailure?: boolean;
}

export type SendEmailResult = 'sent' | 'mocked';

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

  /**
   * Generic templated send — the single render/SES/mock-fallback path every
   * email goes through. Only template rendering errors are always thrown;
   * SES delivery errors throw only when `throwOnFailure` is set.
   */
  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const { to, subject, template, data, throwOnFailure = false } = options;

    // Rendering errors always bubble up: a missing/broken template is a bug.
    const templatePath = join(this.templateDir, `${template}.ejs`);
    let htmlBody: string;
    try {
      htmlBody = await ejs.renderFile(templatePath, data);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`Failed to render email template "${template}" for ${to}`, stack);
      throw error;
    }

    if (!this.sesClient) {
      // No SES credentials — pure mock mode
      this.logMockEmail(to, subject);
      return 'mocked';
    }

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
      this.logger.log(`Email "${subject}" sent successfully to ${to}`);
      return 'sent';
    } catch (sesError) {
      const message = sesError instanceof Error ? sesError.message : String(sesError);
      if (throwOnFailure) {
        this.logger.error(`AWS SES could not deliver email to ${to}: ${message}`);
        throw sesError;
      }
      // SES rejected the send (e.g. sandbox mode — recipient not verified).
      // Fall back to console logging so request-path flows are not blocked.
      this.logger.warn(
        `AWS SES could not deliver email to ${to} (falling back to mock mode): ${message}`,
      );
      this.logMockEmail(to, subject);
      return 'mocked';
    }
  }

  private logMockEmail(to: string, subject: string): void {
    this.logger.log('--- [MOCK EMAIL SENT] ---');
    this.logger.log(`To: ${to}`);
    this.logger.log(`Subject: ${subject}`);
    this.logger.log('--------------------------');
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    const result = await this.send({
      to,
      subject: 'Your Trendupp Verification Code',
      template: 'otp',
      data: { otp },
    });
    if (result === 'mocked') {
      // Dev environments without SES rely on this log to complete signup/login.
      this.logger.log(`OTP Code for ${to}: ${otp}`);
    }
  }

  async sendAccountDeletionWarning(to: string, firstName: string): Promise<void> {
    await this.send({
      to,
      subject: 'Your Trendupp Account Will Be Deleted in 30 Days',
      template: 'account-deletion-warning',
      data: { firstName },
    });
  }

  async sendAccountDeletionTomorrowWarning(to: string, firstName: string): Promise<void> {
    await this.send({
      to,
      subject: 'Your Trendupp Account Will Be Deleted Tomorrow',
      template: 'account-deletion-tomorrow',
      data: { firstName },
    });
  }

  async sendStrikeWarningEmail(to: string, firstName: string, strikesCount: number): Promise<void> {
    const subject = `Trendupp Strike Warning: ${strikesCount} strike(s) recorded`;

    try {
      const templatePath = join(this.templateDir, 'strike-warning.ejs');
      const htmlBody = await ejs.renderFile(templatePath, { firstName, strikesCount });

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
          this.logger.log(`Strike warning email sent to ${to}`);
        } catch (sesError) {
          const message = sesError instanceof Error ? sesError.message : String(sesError);
          this.logger.warn(
            `AWS SES could not deliver strike warning to ${to} (falling back to mock): ${message}`,
          );
          this.logger.log('--- [FALLBACK MOCK EMAIL] ---');
          this.logger.log(`To: ${to}`);
          this.logger.log(`Subject: ${subject}`);
          this.logger.log('-----------------------------');
        }
      } else {
        this.logger.log('--- [MOCK EMAIL SENT] ---');
        this.logger.log(`To: ${to}`);
        this.logger.log(`Subject: ${subject}`);
        this.logger.log('--------------------------');
      }
    } catch (error) {
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`Failed to render strike warning template for ${to}`, stack);
    }
  }

  async sendCreatorBlockEmail(to: string, firstName: string): Promise<void> {
    const subject = 'Your Trendupp Account Has Been Blocked';

    try {
      const templatePath = join(this.templateDir, 'creator-blocked.ejs');
      const htmlBody = await ejs.renderFile(templatePath, { firstName });

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
          this.logger.log(`Creator blocked email sent to ${to}`);
        } catch (sesError) {
          const message = sesError instanceof Error ? sesError.message : String(sesError);
          this.logger.warn(
            `AWS SES could not deliver creator block email to ${to} (falling back to mock): ${message}`,
          );
          this.logger.log('--- [FALLBACK MOCK EMAIL] ---');
          this.logger.log(`To: ${to}`);
          this.logger.log(`Subject: ${subject}`);
          this.logger.log('-----------------------------');
        }
      } else {
        this.logger.log('--- [MOCK EMAIL SENT] ---');
        this.logger.log(`To: ${to}`);
        this.logger.log(`Subject: ${subject}`);
        this.logger.log('--------------------------');
      }
    } catch (error) {
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`Failed to render creator block template for ${to}`, stack);
    }
  }
}
