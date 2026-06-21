import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from '../../users/services/users.service';
import { S3Service } from '../../../integration/s3/s3.service';
import { User } from '../../users/entities/user.entity';
import { UpdatePersonalInfoDto } from '../dtos/update-personal-info.dto';
import { UpdateProfileSocialsDto } from '../dtos/update-socials.dto';
import { UpdateProfilePayoutDto } from '../dtos/update-payout.dto';
import { UpdateNotificationSettingsDto } from '../dtos/update-notification-settings.dto';
import { UpdateSecuritySettingsDto } from '../dtos/update-security-settings.dto';
import { ChangePasswordDto } from '../dtos/change-password.dto';
import { DeactivateAccountDto } from '../dtos/deactivate-account.dto';
import { BankRepository } from '../../users/repository/bank.repository';
import { CreateSupportTicketDto } from '../dtos/create-support-ticket.dto';
import { SupportTicket } from '../entities/support-ticket.entity';
import { SupportTicketRepository } from '../repository/support-ticket.repository';
import { IssueCategory } from '../entities/issue-category.entity';
import { IssueCategoryRepository } from '../repository/issue-category.repository';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class ProfileService {
  constructor(
    private readonly usersService: UsersService,
    private readonly s3Service: S3Service,
    private readonly bankRepository: BankRepository,
    private readonly supportTicketRepository: SupportTicketRepository,
    private readonly issueCategoryRepository: IssueCategoryRepository,
  ) {}

  async updatePersonalInfo(
    userId: string,
    dto: UpdatePersonalInfoDto,
    avatarFile?: Express.Multer.File,
  ): Promise<User> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValueProvided = (val: any): boolean => {
      if (val === undefined) return false;
      if (typeof val === 'string' && val.trim() === '') return false;
      return true;
    };

    const updates: Partial<User> = {};

    if (isValueProvided(dto.firstName)) updates.firstName = dto.firstName;
    if (isValueProvided(dto.lastName)) updates.lastName = dto.lastName;

    if (isValueProvided(dto.username) && dto.username !== user.username) {
      const existing = await this.usersService.findByUsername(dto.username!);
      if (existing && existing.id !== userId) {
        throw new ConflictException('Username is already taken');
      }
      updates.username = dto.username!;
    }

    if (isValueProvided(dto.email)) {
      const normalizedEmail = dto.email!.toLowerCase().trim();
      if (normalizedEmail !== user.email) {
        const existing = await this.usersService.findByEmail(normalizedEmail);
        if (existing && existing.id !== userId) {
          throw new ConflictException('Email is already in use');
        }
        updates.email = normalizedEmail;
      }
    }

    if (dto.bio !== undefined) {
      if (dto.bio === null) {
        updates.bio = null as unknown as string;
      } else if (dto.bio.trim() !== '') {
        updates.bio = dto.bio;
      }
    }

    if (dto.nationalityId !== undefined) {
      if (dto.nationalityId === null) {
        updates.nationalityId = null as unknown as string;
      } else if (dto.nationalityId.trim() !== '') {
        updates.nationalityId = dto.nationalityId;
      }
    }

    if (dto.countryId !== undefined) {
      if (dto.countryId === null) {
        updates.countryId = null as unknown as string;
      } else if (dto.countryId.trim() !== '') {
        updates.countryId = dto.countryId;
      }
    }

    if (dto.stateId !== undefined) {
      if (dto.stateId === null) {
        updates.stateId = null as unknown as string;
      } else if (dto.stateId.trim() !== '') {
        updates.stateId = dto.stateId;
      }
    }

    if (avatarFile) {
      const avatarUrl = await this.s3Service.uploadFile(avatarFile, 'avatars');
      updates.avatarUrl = avatarUrl;
    }

    if (Object.keys(updates).length > 0) {
      await this.usersService.update(userId, updates);
    }

    const updated = await this.usersService.findOneWithNiches(userId);
    if (!updated) {
      throw new NotFoundException('User not found after update');
    }
    return updated;
  }

  async updateNiches(userId: string, nicheIds: string[]): Promise<User> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersService.setUserNiches(userId, nicheIds);

    const updated = await this.usersService.findOneWithNiches(userId);
    if (!updated) {
      throw new NotFoundException('User not found after update');
    }
    return updated;
  }

  async updateSocials(userId: string, dto: UpdateProfileSocialsDto): Promise<User> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updates: Partial<User> = {};
    const updatesObj = updates as Record<string, string | number | null | undefined>;

    // Helper to process social connection and disconnection
    // If username is null, we disconnect it. If it's a non-empty string, we connect/update it.
    // If it's an empty string, we ignore it (do not update).
    const processSocial = (
      inputUsername: string | null | undefined,
      inputFollowers: number | undefined,
      currentUsername: string | undefined,
      currentFollowers: number,
      fieldUsername: string,
      fieldFollowers: string,
    ) => {
      if (inputUsername !== undefined) {
        if (inputUsername === null) {
          // Disconnect if explicitly null
          updatesObj[fieldUsername] = null;
          updatesObj[fieldFollowers] = 0;
        } else if (inputUsername.trim() !== '') {
          // Connect/Update only if non-empty string
          updatesObj[fieldUsername] = inputUsername;
          updatesObj[fieldFollowers] =
            inputFollowers !== undefined ? inputFollowers : currentFollowers;
        }
      } else if (inputFollowers !== undefined) {
        // If username not provided, but followers is provided, only update followers if currently connected
        if (currentUsername) {
          updatesObj[fieldFollowers] = inputFollowers;
        }
      }
    };

    processSocial(
      dto.instagramUsername,
      dto.instagramFollowers,
      user.instagramUsername,
      user.instagramFollowers,
      'instagramUsername',
      'instagramFollowers',
    );

    processSocial(
      dto.tiktokUsername,
      dto.tiktokFollowers,
      user.tiktokUsername,
      user.tiktokFollowers,
      'tiktokUsername',
      'tiktokFollowers',
    );

    processSocial(
      dto.youtubeUsername,
      dto.youtubeFollowers,
      user.youtubeUsername,
      user.youtubeFollowers,
      'youtubeUsername',
      'youtubeFollowers',
    );

    processSocial(
      dto.twitterUsername,
      dto.twitterFollowers,
      user.twitterUsername,
      user.twitterFollowers,
      'twitterUsername',
      'twitterFollowers',
    );

    // Resolve details to calculate tier automatically based on highest followers
    const currentInstaFollowers =
      (updates.instagramFollowers as number) !== undefined
        ? (updates.instagramFollowers as number)
        : user.instagramFollowers;
    const currentTiktokFollowers =
      (updates.tiktokFollowers as number) !== undefined
        ? (updates.tiktokFollowers as number)
        : user.tiktokFollowers;
    const currentYoutubeFollowers =
      (updates.youtubeFollowers as number) !== undefined
        ? (updates.youtubeFollowers as number)
        : user.youtubeFollowers;
    const currentTwitterFollowers =
      (updates.twitterFollowers as number) !== undefined
        ? (updates.twitterFollowers as number)
        : user.twitterFollowers;

    const maxFollowers = Math.max(
      currentInstaFollowers || 0,
      currentTiktokFollowers || 0,
      currentYoutubeFollowers || 0,
      currentTwitterFollowers || 0,
    );

    let tier = 'Nano Creator';
    if (maxFollowers >= 500000) {
      tier = 'Macro Creator';
    } else if (maxFollowers >= 100000) {
      tier = 'Mid-tier Creator';
    } else if (maxFollowers >= 10000) {
      tier = 'Micro Creator';
    }

    updates.assignedTier = tier;

    await this.usersService.update(userId, updates);

    const updated = await this.usersService.findOneWithNiches(userId);
    if (!updated) {
      throw new NotFoundException('User not found after update');
    }
    return updated;
  }

  async updatePayout(userId: string, dto: UpdateProfilePayoutDto): Promise<User> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updates: Partial<User> = {};
    if (dto.bankId !== undefined) {
      const bank = await this.bankRepository.findById(dto.bankId);
      if (!bank) {
        throw new NotFoundException('Bank not found');
      }
      updates.bankId = dto.bankId;
    }
    if (dto.bankAccountNumber !== undefined && dto.bankAccountNumber.trim() !== '') {
      updates.bankAccountNumber = dto.bankAccountNumber;
    }
    if (dto.bankAccountName !== undefined && dto.bankAccountName.trim() !== '') {
      updates.bankAccountName = dto.bankAccountName;
    }

    if (Object.keys(updates).length > 0) {
      await this.usersService.update(userId, updates);
    }

    const updated = await this.usersService.findOneWithNiches(userId);
    if (!updated) {
      throw new NotFoundException('User not found after update');
    }
    return updated;
  }

  async getNotificationSettings(userId: string): Promise<User['notificationSettings']> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.notificationSettings;
  }

  async updateNotificationSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<User['notificationSettings']> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentSettings = user.notificationSettings || {};
    const updatedSettings = {
      ...currentSettings,
    };

    if (dto.newCampaigns !== undefined) updatedSettings.newCampaigns = dto.newCampaigns;
    if (dto.applicationUpdates !== undefined)
      updatedSettings.applicationUpdates = dto.applicationUpdates;
    if (dto.paymentAlerts !== undefined) updatedSettings.paymentAlerts = dto.paymentAlerts;
    if (dto.brandMessages !== undefined) updatedSettings.brandMessages = dto.brandMessages;
    if (dto.pushNotifications !== undefined)
      updatedSettings.pushNotifications = dto.pushNotifications;
    if (dto.emailNotifications !== undefined)
      updatedSettings.emailNotifications = dto.emailNotifications;
    if (dto.weeklySummary !== undefined) updatedSettings.weeklySummary = dto.weeklySummary;
    if (dto.marketingOffers !== undefined) updatedSettings.marketingOffers = dto.marketingOffers;

    await this.usersService.update(userId, {
      notificationSettings: updatedSettings,
    });

    return updatedSettings;
  }

  async getSecuritySettings(userId: string): Promise<User['securitySettings']> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.securitySettings;
  }

  async updateSecuritySettings(
    userId: string,
    dto: UpdateSecuritySettingsDto,
  ): Promise<User['securitySettings']> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentSettings = user.securitySettings || {};
    const updatedSettings = {
      ...currentSettings,
    };

    if (dto.twoFactorEnabled !== undefined) updatedSettings.twoFactorEnabled = dto.twoFactorEnabled;
    if (dto.biometricLoginEnabled !== undefined)
      updatedSettings.biometricLoginEnabled = dto.biometricLoginEnabled;
    if (dto.loginAlertsEnabled !== undefined)
      updatedSettings.loginAlertsEnabled = dto.loginAlertsEnabled;

    await this.usersService.update(userId, {
      securitySettings: updatedSettings,
    });

    return updatedSettings;
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password only if one exists on the account (e.g. not a social-only signup)
    if (user.password) {
      if (!dto.currentPassword) {
        throw new ConflictException('Current password is required');
      }
      const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
      if (!isMatch) {
        throw new ConflictException('Incorrect current password');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.update(userId, {
      password: hashedPassword,
    });
  }

  async deactivateAccount(userId: string, dto: DeactivateAccountDto): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify password before deactivation only if one exists on the account
    if (user.password) {
      if (!dto.password) {
        throw new ConflictException('Password is required to deactivate the account');
      }
      const isMatch = await bcrypt.compare(dto.password, user.password);
      if (!isMatch) {
        throw new ConflictException('Incorrect password');
      }
    }

    await this.usersService.update(userId, {
      isActive: false,
      deactivatedAt: new Date(),
    });
  }

  async getTicketCategories(): Promise<IssueCategory[]> {
    return this.issueCategoryRepository.findAll();
  }

  async getSupportTickets(
    userId: string,
    ticketId?: string,
  ): Promise<SupportTicket[] | SupportTicket> {
    if (ticketId) {
      const ticket = await this.supportTicketRepository.findByIdAndUserId(ticketId, userId);
      if (!ticket) {
        throw new NotFoundException('Support ticket not found');
      }
      return ticket;
    }
    return this.supportTicketRepository.findByUserId(userId);
  }

  async createSupportTicket(
    userId: string,
    dto: CreateSupportTicketDto,
    file?: Express.Multer.File,
  ): Promise<SupportTicket> {
    const category = await this.issueCategoryRepository.findById(dto.issueCategoryId);
    if (!category) {
      throw new NotFoundException('Issue category not found');
    }

    let attachmentUrl: string | undefined;

    if (file) {
      attachmentUrl = await this.s3Service.uploadFile(file, 'support-tickets');
    }

    return this.supportTicketRepository.create({
      userId,
      issueCategoryId: dto.issueCategoryId,
      subject: dto.subject,
      description: dto.description,
      attachmentUrl,
    });
  }
}
