import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface InitializePaymentPayload {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  title?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PayoutPayload {
  payoutRef: string; // Used as the reference query param (idempotency key)
  amount: number;
  currency: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  country?: string; // Should ideally be provided, defaulting to "Nigeria"
}

export interface RefundPayload {
  transactionReference: string;
  amount: number;
  reason?: string;
}

export interface StartbuttonBank {
  id?: number | string;
  name: string;
  code: string;
  [key: string]: unknown;
}

interface StartbuttonResponse<T> {
  success?: boolean;
  status?: boolean | string;
  message?: string;
  data?: T;
  reference?: string;
}

@Injectable()
export class StartbuttonService {
  private readonly logger = new Logger(StartbuttonService.name);
  private readonly publicKey: string;
  private readonly secretKey: string;
  private readonly apiUrl: string;
  private readonly callbackUrl: string;

  private isSuccessfulResponse(res: { success?: boolean; status?: boolean | string }): boolean {
    return (
      res.success === true ||
      res.status === true ||
      (typeof res.status === 'string' && res.status.toLowerCase() === 'success')
    );
  }

  constructor(private readonly configService: ConfigService) {
    this.publicKey = this.configService.get<string>('startbutton.publicKey') || '';
    this.secretKey = this.configService.get<string>('startbutton.secretKey') || '';
    this.apiUrl =
      this.configService.get<string>('startbutton.apiUrl') || 'https://api.startbutton.tech';
    this.callbackUrl = this.configService.get<string>('startbutton.callbackUrl') || '';
  }

  /**
   * Initializes a collection transaction on Startbutton.
   */
  async initializePayment(payload: InitializePaymentPayload): Promise<{
    payment_url: string;
    transaction_ref: string;
    payment_reference?: string;
    gateway_ref?: string;
    provider: string;
    status: string;
  }> {
    if (!this.publicKey) {
      this.logger.warn('Startbutton credentials missing. Running in simulated mode.');
      return {
        payment_url: `${this.apiUrl}/simulated-checkout`,
        transaction_ref: payload.reference,
        payment_reference: payload.reference,
        gateway_ref: payload.reference,
        provider: 'simulated',
        status: 'pending',
      };
    }

    const currencyUpper = payload.currency.toUpperCase();
    const amountInMinor = Math.round(payload.amount * 100);

    const body = {
      email: payload.email,
      amount: amountInMinor,
      currency: currencyUpper,
      reference: payload.reference,
      redirectUrl: this.callbackUrl,
      metadata: {
        ...payload.metadata,
        title: payload.title,
        description: payload.description,
      },
    };

    console.log('Startbutton initializePayment payload:', body);

    try {
      const response = await fetch(`${this.apiUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.publicKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Startbutton initialize failed: ${response.status} - ${errorText}`);
        throw new Error(`Startbutton initiation failed: ${response.statusText}`);
      }

      const resData = await this.parseJsonResponse<StartbuttonResponse<string>>(response);
      if (!this.isSuccessfulResponse(resData) || !resData.data) {
        throw new Error(resData.message || 'Failed to initialize payment');
      }

      let gatewayRef: string | undefined;
      try {
        const urlParts = resData.data.split('/').filter(Boolean);
        const lastPart = urlParts[urlParts.length - 1]?.split('?')[0];
        if (lastPart && lastPart.length <= 32 && !lastPart.includes('.')) {
          gatewayRef = lastPart;
        }
      } catch {
        // ignore parsing errors
      }

      return {
        payment_url: resData.data, // Contains the hosted checkout URL
        transaction_ref: gatewayRef || payload.reference,
        payment_reference: payload.reference,
        gateway_ref: gatewayRef,
        provider: 'startbutton',
        status: 'pending',
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Startbutton payment initialization exception: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Fetches transaction status from Startbutton.
   */
  async verifyTransaction(reference: string): Promise<{
    transaction_ref: string;
    gateway_ref?: string;
    status: string;
    amount?: number;
    currency?: string;
  }> {
    if (!this.secretKey) {
      this.logger.warn('Startbutton credentials missing. Returning simulated funded status.');
      return {
        transaction_ref: reference,
        gateway_ref: reference,
        status: 'funded',
      };
    }

    try {
      const url = `${this.apiUrl}/transaction/status/${encodeURIComponent(reference)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const rawText = await response.text();
      this.logger.log(`Startbutton verifyTransaction response (${response.status}): ${rawText}`);

      if (!response.ok) {
        this.logger.error(`Startbutton verifyTransaction failed (${response.status}): ${rawText}`);
        throw new Error(`Startbutton verifyTransaction failed: ${response.status} - ${rawText}`);
      }

      interface VerifyTxResponseData {
        status?: string;
        amount?: number;
        currency?: string;
        transactionReference?: string;
        userTransactionReference?: string;
        transaction?: {
          status?: string;
          amount?: number;
          currency?: string;
          transactionReference?: string;
          userTransactionReference?: string;
        };
      }
      const resData = JSON.parse(rawText) as StartbuttonResponse<VerifyTxResponseData>;

      const dataObj = resData.data;
      const tx = dataObj?.transaction || dataObj;
      const rawStatus = tx?.status;
      const parsedStatus = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : 'pending';
      const amount = tx?.amount !== undefined ? Number(tx.amount) / 100 : undefined;
      const gatewayRef = tx?.transactionReference || dataObj?.transactionReference;

      return {
        transaction_ref: reference,
        gateway_ref: gatewayRef,
        status: parsedStatus,
        amount,
        currency: tx?.currency,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Startbutton verifyTransaction exception: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Verifies the bank account details via Startbutton.
   */
  async verifyBankAccount(
    bankCode: string,
    accountNumber: string,
    countryCode: string = 'NG',
  ): Promise<{
    accountName: string;
    accountNumber: string;
  }> {
    if (!this.secretKey) {
      this.logger.warn('Startbutton credentials missing. Simulating bank account verification.');
      return {
        accountName: 'Simulated User Name',
        accountNumber,
      };
    }

    try {
      const url = `${this.apiUrl}/bank/verify?bankCode=${encodeURIComponent(bankCode)}&accountNumber=${encodeURIComponent(accountNumber)}&countryCode=${encodeURIComponent(countryCode)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const rawText = await response.text();
      this.logger.log(`Startbutton verifyBankAccount response (${response.status}): ${rawText}`);

      if (!response.ok) {
        throw new Error(`Startbutton bank verification failed: ${response.status} - ${rawText}`);
      }

      const resData = JSON.parse(rawText) as StartbuttonResponse<{
        account_name?: string;
        accountName?: string;
        account_number?: string;
        accountNumber?: string;
        bank_id?: string;
      }>;

      const accountName = resData.data?.account_name || resData.data?.accountName;
      const verifiedAccountNumber =
        resData.data?.account_number || resData.data?.accountNumber || accountNumber;

      if (!this.isSuccessfulResponse(resData) || !accountName) {
        throw new Error(resData.message || 'Failed to verify bank account');
      }

      return {
        accountName,
        accountNumber: verifiedAccountNumber,
      };
    } catch (error) {
      this.logger.error(`Error verifying bank account: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Fetch list of supported banks for a currency and optional countryCode / channel type.
   */
  async getBanks(
    currency: string = 'NGN',
    options?: { countryCode?: string; type?: string },
  ): Promise<StartbuttonBank[]> {
    try {
      const queryParams = new URLSearchParams();
      if (options?.countryCode) {
        queryParams.set('countryCode', options.countryCode);
      }
      if (options?.type) {
        queryParams.set('type', options.type);
      }

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const url = `${this.apiUrl}/bank/list/${encodeURIComponent(currency)}${queryString}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const rawText = await response.text();

      if (!response.ok) {
        throw new Error(`Failed to fetch banks: ${response.status} - ${rawText}`);
      }

      const resData = JSON.parse(rawText) as StartbuttonResponse<StartbuttonBank[]>;

      if (!this.isSuccessfulResponse(resData) || !Array.isArray(resData.data)) {
        throw new Error(resData.message || 'Failed to fetch banks');
      }

      return resData.data;
    } catch (error) {
      this.logger.error(`Error fetching banks: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Withdraws/transfers funds to a creator's bank account.
   */
  async requestPayout(payload: PayoutPayload): Promise<boolean> {
    if (!this.secretKey) {
      this.logger.warn('Startbutton API Key missing. Simulating creator bank payout.');
      return true;
    }

    const amountInMinor = Math.round(payload.amount * 100);

    const body = {
      amount: amountInMinor,
      currency: payload.currency.toUpperCase(),
      country: payload.country || 'Nigeria',
      bankCode: payload.bankCode,
      accountNumber: payload.accountNumber,
      accountName: payload.accountName,
      reference: payload.payoutRef,
    };

    try {
      const response = await fetch(`${this.apiUrl}/transaction/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Startbutton payout failed: ${response.status} - ${errorText}`);
        let message = response.statusText;
        try {
          const errObj = JSON.parse(errorText) as { message?: string };
          if (errObj?.message) {
            message = errObj.message;
          }
        } catch {
          // Ignore parsing errors and fallback to statusText
        }
        throw new Error(`Startbutton payout failed: ${message}`);
      }

      const resData = await this.parseJsonResponse<{
        success?: boolean;
        status?: boolean | string;
        message?: string;
        data?: { status?: string };
      }>(response);

      if (!this.isSuccessfulResponse(resData)) {
        const errMsg = resData.message || 'Startbutton payout returned status false';
        throw new Error(`Startbutton payout failed: ${errMsg}`);
      }

      if (resData.data && typeof resData.data.status === 'string') {
        const transferStatus = resData.data.status.toLowerCase();
        if (
          transferStatus === 'failed' ||
          transferStatus === 'error' ||
          transferStatus === 'rejected'
        ) {
          throw new Error(`Startbutton payout failed: Transfer status is ${transferStatus}`);
        }
      }

      return true;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Startbutton payout request exception: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Initiates a refund for a transaction.
   */
  async initiateRefund(payload: RefundPayload): Promise<boolean> {
    if (!this.secretKey) {
      this.logger.warn('Startbutton API Key missing. Simulating refund.');
      return true;
    }

    const body = {
      transactionReference: payload.transactionReference,
      amount: payload.amount,
      reason: payload.reason,
    };

    try {
      const response = await fetch(`${this.apiUrl}/transaction/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Startbutton refund failed: ${response.status} - ${errorText}`);
        let message = response.statusText;
        try {
          const errObj = JSON.parse(errorText) as { message?: string };
          if (errObj?.message) {
            message = errObj.message;
          }
        } catch {
          // Ignore parsing errors and fallback to statusText
        }
        throw new Error(`Startbutton refund failed: ${message}`);
      }

      const resData = await this.parseJsonResponse<StartbuttonResponse<any>>(response);

      if (!this.isSuccessfulResponse(resData)) {
        throw new Error(`Startbutton refund failed: ${resData.message}`);
      }

      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Startbutton refund request exception: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Safely parses JSON responses.
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
   * Verifies the authenticity of a webhook using HMAC-SHA512 signature.
   * Startbutton uses HMAC SHA512.
   */
  verifyWebhookSignature(rawBody: string | Buffer, receivedSignature: string): boolean {
    if (!this.secretKey) {
      this.logger.warn('Startbutton Secret Key missing. Skipping signature check.');
      return true;
    }

    try {
      const hash = crypto.createHmac('sha512', this.secretKey).update(rawBody).digest('hex');

      return hash === receivedSignature;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Signature verification error: ${errMsg}`);
      return false;
    }
  }

  /**
   * Simulates a customer bank transfer payment to a virtual account in Startbutton Sandbox.
   */
  async mockVirtualAccountPayment(payload: {
    amount: number;
    accountNumber: string;
    reference: string;
    isKobo?: boolean;
  }): Promise<{ success: boolean; message: string; data?: unknown }> {
    if (!this.publicKey) {
      throw new BadRequestException('STARTBUTTON_PUBLIC_KEY is not configured in .env');
    }

    const amountInMinor = payload.isKobo
      ? Math.round(payload.amount)
      : Math.round(payload.amount * 100);

    let targetReference = payload.reference;
    if (targetReference && (targetReference.startsWith('TRX-') || targetReference.length > 20)) {
      try {
        const txStatus = await this.verifyTransaction(targetReference);
        if (txStatus.gateway_ref) {
          this.logger.log(
            `Auto-resolved merchant reference ${targetReference} to Startbutton ID: ${txStatus.gateway_ref}`,
          );
          targetReference = txStatus.gateway_ref;
        }
      } catch (err) {
        this.logger.warn(
          `Could not auto-resolve Startbutton gateway ID for ${targetReference}: ${err}`,
        );
      }
    }

    const body = {
      amount: amountInMinor,
      accountNumber: payload.accountNumber,
      reference: targetReference,
    };

    this.logger.log(
      `Calling Startbutton mock-va-collection for ref: ${targetReference} (input ref: ${payload.reference}), amount: ${amountInMinor}`,
    );

    try {
      const response = await fetch(`${this.apiUrl}/transaction/mock-va-collection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.publicKey}`,
        },
        body: JSON.stringify(body),
      });

      const rawText = await response.text();
      this.logger.log(`Startbutton mock-va-collection response (${response.status}): ${rawText}`);

      if (!response.ok) {
        throw new BadRequestException(
          `Startbutton mock-va-collection failed (${response.status}): ${rawText}`,
        );
      }

      return JSON.parse(rawText) as { success: boolean; message: string; data?: unknown };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Startbutton mock-va-collection exception: ${errMsg}`);
      throw error;
    }
  }
}
