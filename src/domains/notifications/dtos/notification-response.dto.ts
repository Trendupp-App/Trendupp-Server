import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Swagger response shapes for the notifications endpoints — classes (not the
 * Sequelize entity) so OpenAPI can introspect them.
 */
export class NotificationActorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ada' })
  firstName: string;

  @ApiProperty({ example: 'Obi' })
  lastName: string;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl: string | null;
}

export class NotificationItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: 'payout.released',
    description: 'Catalog key — see docs/NOTIFICATIONS.md for all types',
  })
  type: string;

  @ApiProperty({
    example: 'paymentAlerts',
    description: "Preference category it was gated on, or 'security' (non-suppressible)",
  })
  category: string;

  @ApiProperty({ enum: ['critical', 'high', 'medium', 'low'], example: 'critical' })
  priority: string;

  @ApiProperty({ example: 'Payment sent: ₦150,000' })
  title: string;

  @ApiProperty({
    example:
      'Your payout of ₦150,000 for "Lagos Skincare Launch" has been sent to your bank account.',
  })
  body: string;

  @ApiProperty({
    example: '/campaigns/7b0c.../',
    nullable: true,
    type: String,
    description: 'Client deep-link path',
  })
  actionUrl: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { campaignId: '7b0c...', amount: 150000, releaseId: '91ce...' },
    description: 'Raw event payload for client-side rendering/deep-linking',
  })
  data: Record<string, unknown>;

  @ApiProperty({ nullable: true, type: String, description: 'Set when the badge was cleared' })
  seenAt: Date | null;

  @ApiProperty({ nullable: true, type: String, description: 'Set when the item was opened' })
  readAt: Date | null;

  @ApiProperty({
    enum: ['skipped', 'sent', 'mocked', 'failed'],
    example: 'sent',
    description: 'Delivery status of the email leg',
  })
  emailStatus: string;

  @ApiProperty({ example: '2026-07-15T13:01:09.000Z' })
  createdAt: Date;

  @ApiPropertyOptional({
    type: NotificationActorDto,
    nullable: true,
    description: 'Who triggered the event (brand accepting, admin resolving, ...)',
  })
  actor?: NotificationActorDto | null;
}

export class NotificationPaginationDto {
  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 5 })
  pages: number;
}

export class PaginatedNotificationsDto {
  @ApiProperty({ type: [NotificationItemDto] })
  data: NotificationItemDto[];

  @ApiProperty({ type: NotificationPaginationDto })
  pagination: NotificationPaginationDto;
}

export class UnreadCountDto {
  @ApiProperty({ example: 3, description: 'Unread notifications for the caller' })
  count: number;
}

export class UpdatedCountDto {
  @ApiProperty({ example: 5, description: 'Number of notifications affected' })
  updated: number;
}
