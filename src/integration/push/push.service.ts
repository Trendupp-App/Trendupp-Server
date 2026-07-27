import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApp, getApps, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

export interface PushMessage {
  title: string;
  body: string;
  /**
   * Data payload delivered alongside the notification. FCM requires string
   * values; the mobile app uses `type` and `actionUrl` for deep-link routing.
   */
  data?: Record<string, string>;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  /** Tokens FCM reported as unregistered/invalid — prune them from storage. */
  invalidTokens: string[];
}

/** FCM error codes that mean "this token is permanently dead". */
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Thin FCM adapter. Initialized from a base64-encoded service-account JSON
 * (FIREBASE_SERVICE_ACCOUNT_BASE64). Like the other social integrations,
 * missing credentials degrade to a boot-time warning — send() then no-ops —
 * so environments without push (local dev, CI) run unchanged.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  private messaging: Messaging | null = null;

  constructor(private readonly configService: ConfigService) {
    const serviceAccountBase64 = this.configService.get<string>('firebase.serviceAccountBase64');
    if (!serviceAccountBase64) {
      this.logger.warn(
        'Firebase credentials (FIREBASE_SERVICE_ACCOUNT_BASE64) are missing. ' +
          'Push notifications are disabled until they are set.',
      );
      return;
    }

    try {
      const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountBase64, 'base64').toString('utf8'),
      ) as ServiceAccount;
      const app =
        getApps().length > 0 ? getApp() : initializeApp({ credential: cert(serviceAccount) });
      this.messaging = getMessaging(app);
      this.logger.log('Firebase push messaging initialized.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to initialize Firebase from FIREBASE_SERVICE_ACCOUNT_BASE64: ${message}. ` +
          'Push notifications are disabled.',
      );
    }
  }

  get isConfigured(): boolean {
    return this.messaging !== null;
  }

  /**
   * Sends one push message to a set of device tokens. Never throws — push is
   * best-effort by design; delivery problems must not fail the notification
   * job (the in-app row is already written).
   */
  async sendToTokens(tokens: string[], message: PushMessage): Promise<PushSendResult> {
    if (!this.messaging || tokens.length === 0) {
      return { sent: 0, failed: 0, invalidTokens: [] };
    }

    // FCM multicast accepts at most 500 tokens per call — chunk transparently
    // so large fan-outs (broadcasts) work through the same method.
    if (tokens.length > 500) {
      const aggregate: PushSendResult = { sent: 0, failed: 0, invalidTokens: [] };
      for (let i = 0; i < tokens.length; i += 500) {
        const result = await this.sendToTokens(tokens.slice(i, i + 500), message);
        aggregate.sent += result.sent;
        aggregate.failed += result.failed;
        aggregate.invalidTokens.push(...result.invalidTokens);
      }
      return aggregate;
    }

    try {
      const response = await this.messaging.sendEachForMulticast({
        tokens,
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      const invalidTokens: string[] = [];
      response.responses.forEach(
        (
          result: { success: boolean; error?: { code?: string; message?: string } },
          index: number,
        ) => {
          if (result.success) return;
          const code = result.error?.code ?? 'unknown';
          if (INVALID_TOKEN_CODES.has(code)) {
            invalidTokens.push(tokens[index]);
          } else {
            this.logger.warn(`FCM send failed (${code}): ${result.error?.message ?? ''}`);
          }
        },
      );

      return { sent: response.successCount, failed: response.failureCount, invalidTokens };
    } catch (error: unknown) {
      const message_ = error instanceof Error ? error.message : String(error);
      this.logger.error(`FCM multicast send failed: ${message_}`);
      return { sent: 0, failed: tokens.length, invalidTokens: [] };
    }
  }
}
