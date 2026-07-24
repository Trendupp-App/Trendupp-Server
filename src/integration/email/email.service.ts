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
   * When true, delivery failures are thrown to the caller (used by the
   * notification queue worker so failures are recorded/retryable). Defaults
   * to false: the legacy behavior of falling back to a console mock so
   * request-path flows (signup OTP) are never blocked by the provider.
   */
  throwOnFailure?: boolean;
}

export type SendEmailResult = 'sent' | 'mocked';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly templateDir: string;

  private sesClient: SESClient | null = null;

  constructor(private configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('email.fromEmail', 'noreply@trendupp.com');

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

    const region = this.configService.get<string>('aws.ses.region');
    const accessKey = this.configService.get<string>('aws.ses.accessKey');
    const secretKey = this.configService.get<string>('aws.ses.secretKey');
    if (region && accessKey && secretKey) {
      this.sesClient = new SESClient({
        region,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      });
    }

    if (this.sesClient) {
      this.logger.log('Email service initialized (SES)');
    } else {
      this.logger.warn(
        'SES is not configured. Email service running in MOCK mode (logging to console).',
      );
    }
  }

  /**
   * Generic templated send — the single render / deliver / mock-fallback path
   * every email goes through. Only template rendering errors are always thrown;
   * delivery errors throw only when `throwOnFailure` is set.
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
      // No SES credentials — pure mock mode.
      this.logMockEmail(to, subject);
      return 'mocked';
    }

    try {
      await this.deliverViaSes(to, subject, htmlBody);
      this.logger.log(`Email "${subject}" sent successfully to ${to}`);
      return 'sent';
    } catch (deliveryError) {
      const message =
        deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
      if (throwOnFailure) {
        this.logger.error(`Email delivery to ${to} failed: ${message}`);
        throw deliveryError;
      }
      // SES rejected the send. Fall back to console logging so
      // request-path flows are not blocked.
      this.logger.warn(`Email delivery to ${to} failed, falling back to mock mode: ${message}`);
      this.logMockEmail(to, subject);
      return 'mocked';
    }
  }

  private async deliverViaSes(to: string, subject: string, htmlBody: string): Promise<void> {
    if (!this.sesClient) {
      throw new Error('SES client is not initialized');
    }
    const command = new SendEmailCommand({
      Destination: { ToAddresses: [to] },
      Message: {
        Body: { Html: { Data: htmlBody } },
        Subject: { Data: subject },
      },
      Source: this.fromEmail,
    });
    await this.sesClient.send(command);
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
      // Dev environments without a provider rely on this log to complete signup/login.
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
    await this.send({
      to,
      subject: `Trendupp Strike Warning: ${strikesCount} strike(s) recorded`,
      template: 'strike-warning',
      data: { firstName, strikesCount },
    });
  }

  async sendCreatorBlockEmail(to: string, firstName: string): Promise<void> {
    await this.send({
      to,
      subject: 'Your Trendupp Account Has Been Blocked',
      template: 'creator-blocked',
      data: { firstName },
    });
  }

  async sendAdminInvitationEmail(
    to: string,
    adminName: string,
    roleName: string,
    activationCode: string,
  ): Promise<void> {
    const baseUrl =
      this.configService.get<string>('ADMIN_INVITE_URL') ||
      'https://trendupp-web.vercel.app/setup/invite';
    const inviteUrl = `${baseUrl}/${activationCode}?email=${encodeURIComponent(to)}`;

    const result = await this.send({
      to,
      subject: 'You Have Been Invited to Trendupp Admin Portal',
      template: 'admin-invitation',
      data: { adminName, roleName, activationCode, inviteUrl },
    });
    if (result === 'mocked') {
      this.logger.log(`Admin Invitation Code for ${to}: ${activationCode} (Link: ${inviteUrl})`);
    }
  }
}
