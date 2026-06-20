import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Attributes } from 'sequelize';
import { SupportTicket } from '../entities/support-ticket.entity';

@Injectable()
export class SupportTicketRepository {
  constructor(
    @InjectModel(SupportTicket)
    private readonly ticketModel: typeof SupportTicket,
  ) {}

  async create(ticket: Partial<Attributes<SupportTicket>>): Promise<SupportTicket> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.ticketModel as any).create(ticket) as Promise<SupportTicket>;
  }

  async findByUserId(userId: string): Promise<SupportTicket[]> {
    return this.ticketModel.findAll({
      where: { userId },
      include: ['issueCategory'],
      order: [['createdAt', 'DESC']],
    });
  }

  async findByIdAndUserId(id: string, userId: string): Promise<SupportTicket | null> {
    return this.ticketModel.findOne({
      where: { id, userId },
      include: ['issueCategory'],
    });
  }
}
