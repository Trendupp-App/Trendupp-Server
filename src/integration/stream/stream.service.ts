import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StreamChat, ChannelData } from 'stream-chat';

@Injectable()
export class StreamService {
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

  getApiKey(): string {
    return this.apiKey || 'mock_stream_api_key';
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
