import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Attributes, WhereOptions, Op } from 'sequelize';
import { Broadcast } from '../entities/broadcast.entity';
import { paginate, PaginatedResult } from '../../../shared/utils/pagination.utils';

@Injectable()
export class BroadcastRepository {
  constructor(
    @InjectModel(Broadcast)
    private readonly broadcastModel: typeof Broadcast,
  ) {}

  async create(data: Partial<Attributes<Broadcast>>): Promise<Broadcast> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.broadcastModel as any).create(data) as Promise<Broadcast>;
  }

  async findById(id: string): Promise<Broadcast | null> {
    return this.broadcastModel.findByPk(id, {
      include: [
        {
          association: 'createdBy',
          attributes: ['id', 'firstName', 'lastName', 'email', 'avatarUrl'],
        },
      ],
    });
  }

  async findAll(options: {
    page: number;
    limit: number;
    tab?: string;
    audience?: string;
    q?: string;
  }): Promise<PaginatedResult<Broadcast>> {
    const where: Record<string | symbol, unknown> = {};

    if (options.tab && options.tab !== 'all') {
      where.status = options.tab;
    }

    if (options.audience && options.audience !== 'all') {
      where.audience = options.audience;
    }

    if (options.q) {
      const pattern = `%${options.q.trim()}%`;
      where[Op.or] = [{ title: { [Op.iLike]: pattern } }, { message: { [Op.iLike]: pattern } }];
    }

    return paginate(
      this.broadcastModel,
      {
        where: where as WhereOptions<Broadcast>,
        include: [
          {
            association: 'createdBy',
            attributes: ['id', 'firstName', 'lastName', 'email', 'avatarUrl'],
          },
        ],
        order: [['createdAt', 'DESC']],
      },
      { page: options.page, limit: options.limit },
    );
  }

  async update(id: string, data: Partial<Attributes<Broadcast>>): Promise<[number, Broadcast[]]> {
    const where = { id } as WhereOptions<Attributes<Broadcast>>;
    return this.broadcastModel.update(data, { where, returning: true });
  }

  async delete(id: string): Promise<number> {
    const where = { id } as WhereOptions<Attributes<Broadcast>>;
    return this.broadcastModel.destroy({ where });
  }

  async findPendingScheduled(now: Date = new Date()): Promise<Broadcast[]> {
    return this.broadcastModel.findAll({
      where: {
        status: 'scheduled',
        scheduledAt: {
          [Op.lte]: now,
        },
      },
    });
  }

  /**
   * Atomically claims a scheduled broadcast for dispatch by flipping it to
   * 'sent' ONLY if it is still 'scheduled'. Returns true when this caller won
   * the claim — guards against the scheduler tick racing a manual "send now"
   * (or a concurrent tick) so a broadcast can never dispatch twice.
   */
  async claimScheduled(id: string, now: Date = new Date()): Promise<boolean> {
    const [affected] = await this.broadcastModel.update(
      { status: 'sent', sentAt: now },
      { where: { id, status: 'scheduled' } },
    );
    return affected === 1;
  }
}
