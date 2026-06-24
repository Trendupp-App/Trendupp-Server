import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StreamChat, ChannelData, OwnUserResponse, UserResponse } from 'stream-chat';

interface StreamError {
  status?: number;
  statusCode?: number;
  response?: {
    status?: number;
  };
  message?: string;
}

@Injectable()
export class StreamService implements OnModuleInit {
  private readonly logger = new Logger(StreamService.name);
  private readonly streamClient: StreamChat | null = null;
  private readonly apiKey: string | undefined;
  private readonly isMockMode: boolean = false;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('stream.apiKey');
    const apiSecret = this.configService.get<string>('stream.apiSecret');

    if (!this.apiKey || !apiSecret) {
      this.logger.warn(
        'STREAM_API_KEY or STREAM_API_SECRET is missing. Stream Chat will run in MOCK mode.',
      );
      this.isMockMode = true;
    } else {
      try {
        this.streamClient = new StreamChat(this.apiKey, apiSecret);
        this.logger.log('Stream Chat Service initialized successfully.');
      } catch (error) {
        const stack = error instanceof Error ? error.stack : '';
        this.logger.error('Failed to initialize Stream Chat client', stack);
        this.isMockMode = true;
      }
    }
  }

  async onModuleInit() {
    if (this.isMockMode || !this.streamClient) {
      return;
    }
    try {
      await this.ensureChannelType('dispute');
    } catch (error) {
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error('Failed to ensure Stream channel types during startup', stack);
    }
  }

  private async ensureChannelType(typeName: string): Promise<void> {
    if (!this.streamClient) return;
    try {
      await this.streamClient.getChannelType(typeName);
      this.logger.log(`Stream channel type "${typeName}" already exists.`);
    } catch (error) {
      const err = error as StreamError;
      const status = err.status || err.statusCode || err.response?.status;
      this.logger.warn(
        `getChannelType for "${typeName}" failed with status ${status}. Attempting to create it...`,
      );
      try {
        await this.streamClient.createChannelType({
          name: typeName,
          typing_events: true,
          read_events: true,
          connect_events: true,
          search: true,
        });
        this.logger.log(`Stream channel type "${typeName}" created successfully.`);
      } catch (createError) {
        const createErr = createError as StreamError;
        const createStatus = createErr.status || createErr.statusCode || createErr.response?.status;
        if (
          createStatus === 400 &&
          String(createErr.message).toLowerCase().includes('already exists')
        ) {
          this.logger.log(
            `Stream channel type "${typeName}" already exists (verified on creation fallback).`,
          );
        } else {
          throw createError;
        }
      }
    }
  }

  getApiKey(): string {
    return this.apiKey || 'mock_stream_api_key';
  }

  /**
   * Upserts a single user to Stream with their full profile details.
   * Called when the user fetches their stream token so their name/email
   * is enriched in Stream before they connect via the SDK.
   */
  async upsertUser(user: {
    id: string;
    name?: string;
    image?: string;
  }): Promise<OwnUserResponse | UserResponse | null> {
    if (this.isMockMode || !this.streamClient) {
      this.logger.warn(`MOCK mode: Skipping upsert for user: ${user.id}`);
      return null;
    }
    try {
      const response = await this.streamClient.upsertUser({
        id: user.id,
        name: user.name || user.id,
        image: user.image,
      });
      return response.users[user.id] ?? null;
    } catch (error) {
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`Failed to upsert Stream user ${user.id}`, stack);
      throw error;
    }
  }

  /**
   * Batch-upserts multiple users by ID only before channel creation.
   * Ensures all participants exist in Stream so GetOrCreateChannel succeeds.
   * Uses minimal user objects — the full profile is enriched when users
   * call getStreamToken() or connect via the SDK.
   */
  async upsertUsers(userIds: string[]): Promise<void> {
    if (this.isMockMode || !this.streamClient) {
      this.logger.warn(`MOCK mode: Skipping batch upsert for ${userIds.length} users`);
      return;
    }
    try {
      const users = userIds.map((id) => ({ id }));
      await this.streamClient.upsertUsers(users);
      this.logger.log(`Upserted ${users.length} users to Stream: [${userIds.join(', ')}]`);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error('Failed to batch-upsert Stream users', stack);
      throw error;
    }
  }

  generateUserToken(userId: string): string {
    if (this.isMockMode || !this.streamClient) {
      this.logger.warn(`MOCK mode: Generating dummy Stream token for user: ${userId}`);
      return `mock_stream_token_for_${userId}_${Buffer.from(userId).toString('base64')}`;
    }
    return this.streamClient.createToken(userId);
  }

  async createChannel(
    channelType: string,
    channelId: string,
    name: string,
    memberIds: string[],
    createdById: string,
  ): Promise<any> {
    if (this.isMockMode || !this.streamClient) {
      this.logger.warn(
        `MOCK mode: Simulating channel creation for type: ${channelType}, ID: ${channelId}`,
      );
      return {
        id: channelId,
        type: channelType,
        name,
        members: memberIds,
        createdById,
        frozen: false,
      };
    }

    try {
      const channel = this.streamClient.channel(channelType, channelId, {
        name,
        members: memberIds,
        created_by_id: createdById,
      } as unknown as ChannelData);

      await channel.create();
      return channel;
    } catch (error) {
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`Failed to create Stream channel ${channelType}:${channelId}`, stack);
      throw error;
    }
  }

  async freezeChannel(channelType: string, channelId: string): Promise<any> {
    if (this.isMockMode || !this.streamClient) {
      this.logger.warn(`MOCK mode: Simulating channel freeze for ${channelType}:${channelId}`);
      return {
        id: channelId,
        type: channelType,
        frozen: true,
      };
    }

    try {
      const channel = this.streamClient.channel(channelType, channelId);
      await channel.update({ frozen: true });
      return channel;
    } catch (error) {
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`Failed to freeze Stream channel ${channelType}:${channelId}`, stack);
      throw error;
    }
  }
}
