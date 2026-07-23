import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface InitializeEscrowPayload {
  title: string;
  description: string;
  amount: number;
  currency: string;
  deliveryDate: string;
  buyerDetails: {
    name: string;
    email: string;
    phone: string;
  };
  sellerDetails: {
    name: string;
    email: string;
    phone: string;
  };
}

export interface PayoutPayload {
  payoutRef: string; // Used as the uuid query param (idempotency key)
  walletId: number;
  amount: number;
  currency: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

interface PandascrowResponse<T> {
  status: boolean;
  message?: string;
  data?: T;
}

interface EscrowInitData {
  escrow_id: number;
  payment_url: string;
  transaction_ref: string;
  provider: string;
  status: string;
}

@Injectable()
export class PandascrowService {
  private readonly logger = new Logger(PandascrowService.name);
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly apiUrl: string;
  private readonly accountUuid: string;
  private readonly callbackUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('pandascrow.apiKey') || '';
    this.secretKey = this.configService.get<string>('pandascrow.secretKey') || '';
    this.apiUrl =
      this.configService.get<string>('pandascrow.apiUrl') || 'https://sandbox.pandascrow.io';
    this.accountUuid = this.configService.get<string>('pandascrow.accountUuid') || '';
    this.callbackUrl = this.configService.get<string>('pandascrow.callbackUrl') || '';
  }

  /**
   * Initializes a one-time escrow transaction on Pandascrow.
   */
  async initializeEscrow(payload: InitializeEscrowPayload): Promise<{
    escrow_id: number;
    payment_url: string;
    transaction_ref: string;
    provider: string;
    status: string;
  }> {
    if (!this.apiKey || !this.accountUuid) {
      this.logger.warn('Pandascrow credentials missing. Running in simulated mode.');
      return {
        escrow_id: Math.floor(Math.random() * 100000),
        payment_url: `${this.apiUrl}/simulated-checkout`,
        transaction_ref: `sim_ref_${Math.random().toString(36).substring(2, 11)}`,
        provider: 'simulated',
        status: 'pending',
      };
    }

    const body = {
      uuid: this.accountUuid,
      escrow_type: 'onetime',
      initiator_role: 'buyer', // Trendupp manages OTP & release; escrow.paid webhook fires back correctly
      initiator_id: this.accountUuid,
      title: payload.title,
      currency: payload.currency.toUpperCase(),
      description: payload.description,
      inspection_period: '7', // default 7 days
      delivery_date: payload.deliveryDate,
      who_pay_fees: 'seller', // Trendupp pays fees
      amount: payload.amount,
      ...(this.callbackUrl && { callback_url: this.callbackUrl }),
      buyer_details: {
        name: payload.buyerDetails.name,
        email: payload.buyerDetails.email,
        phone: payload.buyerDetails.phone,
      },
      seller_details: {
        name: payload.sellerDetails.name,
        email: payload.sellerDetails.email,
        phone: payload.sellerDetails.phone,
      },
    };

    console.log({ check_body: body });

    try {
      const response = await fetch(`${this.apiUrl}/escrow/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Token: this.apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Pandascrow initialize failed: ${response.status} - ${errorText}`);
        throw new Error(`Pandascrow initiation failed: ${response.statusText}`);
      }

      const resData = await this.parseJsonResponse<PandascrowResponse<EscrowInitData>>(response);
      if (!resData.status || !resData.data) {
        throw new Error(resData.message || 'Failed to initialize escrow');
      }

      console.log({ escrow_check: resData });

      return {
        escrow_id: resData.data.escrow_id,
        payment_url: resData.data.payment_url,
        transaction_ref: resData.data.transaction_ref,
        provider: resData.data.provider,
        status: resData.data.status,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Pandascrow escrow initialization exception: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Fetches escrow transaction details and status from Pandascrow.
   */
  async getEscrowDetails(escrowId: string): Promise<{
    escrow_id: string | number;
    status: string;
    amount?: number;
    currency?: string;
  }> {
    if (!this.apiKey || !this.accountUuid) {
      this.logger.warn('Pandascrow credentials missing. Returning simulated funded escrow status.');
      return {
        escrow_id: escrowId,
        status: 'funded',
      };
    }

    try {
      const url = `${this.apiUrl}/escrow/single?uuid=${encodeURIComponent(
        this.accountUuid,
      )}&escrow_id=${encodeURIComponent(escrowId)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Token: this.apiKey,
        },
      });

      const rawText = await response.text();
      this.logger.log(`Pandascrow getEscrowDetails response (${response.status}): ${rawText}`);

      if (!response.ok) {
        this.logger.error(`Pandascrow getEscrowDetails failed (${response.status}): ${rawText}`);
        throw new Error(
          `Pandascrow getEscrowDetails failed: ${response.status} - ${rawText || response.statusText}`,
        );
      }

      const jsonStart = rawText.indexOf('{');
      if (jsonStart === -1) {
        this.logger.warn(`Non-JSON response received from Pandascrow: ${rawText}`);
        return {
          escrow_id: escrowId,
          status: 'pending',
        };
      }

      const cleanJson = rawText.substring(jsonStart);
      type SingleEscrowWrapper = {
        escrow?: {
          _id?: string | number;
          status?: string;
          amount?: string | number;
          currency?: string;
        };
      };
      const resData = JSON.parse(cleanJson) as PandascrowResponse<
        SingleEscrowWrapper | SingleEscrowWrapper[]
      >;

      const rawData = resData.data;
      const escrowObj = Array.isArray(rawData) ? rawData[0]?.escrow : rawData?.escrow;

      const rawStatus = escrowObj?.status;
      const parsedStatus = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : 'pending';

      return {
        escrow_id: escrowObj?._id ?? escrowId,
        status: parsedStatus,
        amount: escrowObj?.amount !== undefined ? Number(escrowObj.amount) : undefined,
        currency: escrowObj?.currency,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Pandascrow getEscrowDetails exception: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Withdraws/transfers funds from Trendupp wallet to a creator's bank account.
   */
  async requestPayout(payload: PayoutPayload): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn('Pandascrow API Key missing. Simulating creator bank payout.');
      return true;
    }

    const body = {
      uuid: this.accountUuid,
      idempotency_key: payload.payoutRef,
      amount: payload.amount.toString(),
      currency: payload.currency.toUpperCase(),
      bank: {
        account_number: payload.accountNumber,
        account_name: payload.accountName,
        bank_code: payload.bankCode,
      },
      description: 'Trendupp Creator Payout',
    };

    try {
      const response = await fetch(`${this.apiUrl}/bank/transfers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Token: this.apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Pandascrow payout failed: ${response.status} - ${errorText}`);
        let message = response.statusText;
        try {
          const errObj = JSON.parse(errorText) as { data?: { message?: string } };
          if (errObj?.data?.message) {
            message = errObj.data.message;
          }
        } catch {
          // Ignore parsing errors and fallback to statusText
        }
        throw new Error(`Pandascrow payout failed: ${message}`);
      }

      const resData = await this.parseJsonResponse<{ status?: boolean }>(response);
      return !!resData.status;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Pandascrow payout request exception: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Safely parses JSON responses from Pandascrow.
   * Strips out any leading HTML warnings (like PHP warnings) occasionally returned by the Sandbox API.
   */
  private async parseJsonResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    const jsonStart = text.indexOf('{');
    if (jsonStart === -1) {
      throw new Error(`Invalid JSON response: ${text}`);
    }
    try {
      const cleanJson = text.substring(jsonStart);
      return JSON.parse(cleanJson) as T;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse JSON response: ${errMsg}. Body: ${text}`);
    }
  }

  /**
   * Verifies the authenticity of a webhook using HMAC-SHA256 signature.
   */
  verifyWebhookSignature(
    rawBody: string | Buffer,
    receivedSignature: string,
    event?: string,
    data?: unknown,
    timestamp?: number,
  ): boolean {
    if (!this.secretKey) {
      // In development/test with no secret key, skip signature verification
      this.logger.warn('Pandascrow Secret Key missing. Skipping signature check.');
      return true;
    }

    try {
      const cleanSignature = receivedSignature.replace(/['"]/g, '').trim();
      const receivedBuffer = Buffer.from(cleanSignature);

      // 1. Verify against Raw Body (Standard Webhook Hashing)
      const calculatedSignatureRaw = crypto
        .createHmac('sha256', this.secretKey)
        .update(rawBody)
        .digest('hex');
      const calculatedBufferRaw = Buffer.from(calculatedSignatureRaw);

      if (
        receivedBuffer.length === calculatedBufferRaw.length &&
        crypto.timingSafeEqual(receivedBuffer, calculatedBufferRaw)
      ) {
        return true;
      }

      // 2. Fallback to subset JSON string verification (if fields are passed)
      if (event && data && timestamp !== undefined) {
        const dataToSign = { event, data, timestamp };
        const calculatedSignatureFields = crypto
          .createHmac('sha256', this.secretKey)
          .update(JSON.stringify(dataToSign))
          .digest('hex');
        const calculatedBufferFields = Buffer.from(calculatedSignatureFields);

        if (
          receivedBuffer.length === calculatedBufferFields.length &&
          crypto.timingSafeEqual(receivedBuffer, calculatedBufferFields)
        ) {
          return true;
        }
      }

      this.logger.warn(
        `Signature mismatch. Received: ${receivedSignature}. Expected (raw): ${calculatedSignatureRaw}`,
      );
      return false;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Signature verification error: ${errMsg}`);
      return false;
    }
  }
}
