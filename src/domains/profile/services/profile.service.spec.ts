/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Bank } from '../../users/entities/bank.entity';
import { ProfileService } from './profile.service';
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
import { SupportTicketRepository } from '../repository/support-ticket.repository';
import { CreateSupportTicketDto } from '../dtos/create-support-ticket.dto';
import { IssueCategoryRepository } from '../repository/issue-category.repository';
import { SupportTicket } from '../entities/support-ticket.entity';
import { IssueCategory } from '../entities/issue-category.entity';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('ProfileService', () => {
  let service: ProfileService;
  let usersServiceMock: jest.Mocked<UsersService>;
  let s3ServiceMock: jest.Mocked<S3Service>;
  let bankRepositoryMock: jest.Mocked<BankRepository>;
  let supportTicketRepositoryMock: jest.Mocked<SupportTicketRepository>;
  let issueCategoryRepositoryMock: jest.Mocked<IssueCategoryRepository>;

  beforeEach(async () => {
    usersServiceMock = {
      findOne: jest.fn(),
      findOneWithNiches: jest.fn(),
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      setUserNiches: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    s3ServiceMock = {
      uploadFile: jest.fn(),
    } as unknown as jest.Mocked<S3Service>;

    bankRepositoryMock = {
      findById: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<BankRepository>;

    supportTicketRepositoryMock = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findByIdAndUserId: jest.fn(),
    } as unknown as jest.Mocked<SupportTicketRepository>;

    issueCategoryRepositoryMock = {
      findAll: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<IssueCategoryRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: S3Service, useValue: s3ServiceMock },
        { provide: BankRepository, useValue: bankRepositoryMock },
        { provide: SupportTicketRepository, useValue: supportTicketRepositoryMock },
        { provide: IssueCategoryRepository, useValue: issueCategoryRepositoryMock },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updatePersonalInfo', () => {
    it('should update user fields successfully', async () => {
      const mockUser = {
        id: 'u1',
        email: 'old@example.com',
        username: 'olduser',
      } as unknown as User;
      usersServiceMock.findOne.mockResolvedValue(mockUser);
      usersServiceMock.findByUsername.mockResolvedValue(null);
      usersServiceMock.findByEmail.mockResolvedValue(null);
      usersServiceMock.update.mockResolvedValue({
        ...mockUser,
        username: 'newuser',
      } as unknown as User);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'u1',
        username: 'newuser',
      } as unknown as User);

      const dto: UpdatePersonalInfoDto = {
        firstName: 'NewFirst',
        lastName: 'NewLast',
        username: 'newuser',
        email: 'new@example.com',
        bio: 'New bio description',
      };

      const result = await service.updatePersonalInfo('u1', dto);

      expect(usersServiceMock.findOne).toHaveBeenCalledWith('u1');
      expect(usersServiceMock.findByUsername).toHaveBeenCalledWith('newuser');
      expect(usersServiceMock.findByEmail).toHaveBeenCalledWith('new@example.com');
      expect(usersServiceMock.update).toHaveBeenCalledWith('u1', {
        firstName: 'NewFirst',
        lastName: 'NewLast',
        username: 'newuser',
        email: 'new@example.com',
        bio: 'New bio description',
      });
      expect(result.username).toBe('newuser');
    });

    it('should upload profile picture and set avatarUrl when file is provided', async () => {
      const mockUser = { id: 'u1', email: 'old@example.com' } as unknown as User;
      const mockFile = {
        originalname: 'avatar.png',
        buffer: Buffer.from([]),
      } as Express.Multer.File;

      usersServiceMock.findOne.mockResolvedValue(mockUser);
      s3ServiceMock.uploadFile.mockResolvedValue('https://s3.amazonaws.com/avatars/u1.png');
      usersServiceMock.update.mockResolvedValue(mockUser);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'u1',
        avatarUrl: 'https://s3.amazonaws.com/avatars/u1.png',
      } as unknown as User);

      const result = await service.updatePersonalInfo('u1', {}, mockFile);

      expect(s3ServiceMock.uploadFile).toHaveBeenCalledWith(mockFile, 'avatars');
      expect(usersServiceMock.update).toHaveBeenCalledWith('u1', {
        avatarUrl: 'https://s3.amazonaws.com/avatars/u1.png',
      });
      expect(result.avatarUrl).toBe('https://s3.amazonaws.com/avatars/u1.png');
    });

    it('should throw ConflictException if username is already taken by another user', async () => {
      const mockUser = { id: 'u1', username: 'olduser' } as unknown as User;
      const anotherUser = { id: 'u2', username: 'newuser' } as unknown as User;

      usersServiceMock.findOne.mockResolvedValue(mockUser);
      usersServiceMock.findByUsername.mockResolvedValue(anotherUser);

      await expect(service.updatePersonalInfo('u1', { username: 'newuser' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if email is already in use by another user', async () => {
      const mockUser = { id: 'u1', email: 'old@example.com' } as unknown as User;
      const anotherUser = { id: 'u2', email: 'new@example.com' } as unknown as User;

      usersServiceMock.findOne.mockResolvedValue(mockUser);
      usersServiceMock.findByEmail.mockResolvedValue(anotherUser);

      await expect(service.updatePersonalInfo('u1', { email: 'new@example.com' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateNiches', () => {
    it('should update user niches and return user', async () => {
      const mockUser = { id: 'u1' } as unknown as User;
      usersServiceMock.findOne.mockResolvedValue(mockUser);
      usersServiceMock.setUserNiches.mockResolvedValue(undefined);
      usersServiceMock.findOneWithNiches.mockResolvedValue(mockUser);

      const result = await service.updateNiches('u1', ['n1', 'n2']);

      expect(usersServiceMock.findOne).toHaveBeenCalledWith('u1');
      expect(usersServiceMock.setUserNiches).toHaveBeenCalledWith('u1', ['n1', 'n2']);
      expect(result).toBeDefined();
    });
  });

  describe('updateSocials', () => {
    it('should update social account details and calculate creator tier correctly', async () => {
      const mockUser = {
        id: 'u1',
        instagramUsername: 'old_insta',
        instagramFollowers: 500,
        tiktokUsername: null,
        tiktokFollowers: 0,
        youtubeUsername: null,
        youtubeFollowers: 0,
        twitterUsername: null,
        twitterFollowers: 0,
      } as unknown as User;

      usersServiceMock.findOne.mockResolvedValue(mockUser);
      usersServiceMock.update.mockResolvedValue(mockUser);
      usersServiceMock.findOneWithNiches.mockResolvedValue(mockUser);

      const dto: UpdateProfileSocialsDto = {
        instagramUsername: 'new_insta',
        instagramFollowers: 15000, // micro creator range
        tiktokUsername: 'new_tiktok',
        tiktokFollowers: 200,
      };

      await service.updateSocials('u1', dto);

      expect(usersServiceMock.update).toHaveBeenCalledWith('u1', {
        instagramUsername: 'new_insta',
        instagramFollowers: 15000,
        tiktokUsername: 'new_tiktok',
        tiktokFollowers: 200,
        assignedTier: 'Micro Creator', // max is 15000
      });
    });

    it('should disconnect social platform when username is explicitly null', async () => {
      const mockUser = {
        id: 'u1',
        instagramUsername: 'old_insta',
        instagramFollowers: 50000,
        tiktokUsername: null,
        tiktokFollowers: 0,
        youtubeUsername: null,
        youtubeFollowers: 0,
        twitterUsername: null,
        twitterFollowers: 0,
      } as unknown as User;

      usersServiceMock.findOne.mockResolvedValue(mockUser);
      usersServiceMock.update.mockResolvedValue(mockUser);
      usersServiceMock.findOneWithNiches.mockResolvedValue(mockUser);

      const dto: UpdateProfileSocialsDto = {
        instagramUsername: null, // disconnect
      };

      await service.updateSocials('u1', dto);

      expect(usersServiceMock.update).toHaveBeenCalledWith('u1', {
        instagramUsername: null,
        instagramFollowers: 0,
        assignedTier: 'Nano Creator', // resets to nano
      });
    });

    it('should ignore social platform update when username is empty string', async () => {
      const mockUser = {
        id: 'u1',
        instagramUsername: 'old_insta',
        instagramFollowers: 500000,
        tiktokUsername: null,
        tiktokFollowers: 0,
        youtubeUsername: null,
        youtubeFollowers: 0,
        twitterUsername: null,
        twitterFollowers: 0,
      } as unknown as User;

      usersServiceMock.findOne.mockResolvedValue(mockUser);
      usersServiceMock.update.mockResolvedValue(mockUser);
      usersServiceMock.findOneWithNiches.mockResolvedValue(mockUser);

      const dto: UpdateProfileSocialsDto = {
        instagramUsername: '   ', // empty string / whitespace
        tiktokUsername: '',
      };

      await service.updateSocials('u1', dto);

      // Verify usersServiceMock.update was NOT called since no valid updates were resolved
      expect(usersServiceMock.update).toHaveBeenCalledWith('u1', {
        assignedTier: 'Macro Creator', // recalculates existing insta followers 500000 -> macro
      });
    });
  });

  describe('updatePersonalInfo empty payload handling', () => {
    it('should refuse to update fields if provided as empty strings or whitespace', async () => {
      const mockUser = {
        id: 'u1',
        email: 'old@example.com',
        username: 'olduser',
        bio: 'oldbio',
      } as unknown as User;
      usersServiceMock.findOne.mockResolvedValue(mockUser);
      usersServiceMock.update.mockResolvedValue(mockUser);
      usersServiceMock.findOneWithNiches.mockResolvedValue(mockUser);

      const dto: UpdatePersonalInfoDto = {
        firstName: '   ',
        lastName: '',
        bio: '   ',
        username: '  ',
        email: '',
      };

      await service.updatePersonalInfo('u1', dto);

      // updates object should be empty because all fields are filtered out
      expect(usersServiceMock.update).not.toHaveBeenCalled();
    });

    it('should allow explicit null updates for nullable fields like bio', async () => {
      const mockUser = {
        id: 'u1',
        email: 'old@example.com',
        username: 'olduser',
        bio: 'oldbio',
      } as unknown as User;
      usersServiceMock.findOne.mockResolvedValue(mockUser);
      usersServiceMock.update.mockResolvedValue(mockUser);
      usersServiceMock.findOneWithNiches.mockResolvedValue(mockUser);

      const dto: UpdatePersonalInfoDto = {
        bio: null,
        nationalityId: null,
      };

      await service.updatePersonalInfo('u1', dto);

      expect(usersServiceMock.update).toHaveBeenCalledWith('u1', {
        bio: null,
        nationalityId: null,
      });
    });
  });

  describe('updatePayout', () => {
    it('should update payout bank details if bankId exists', async () => {
      const mockUser = { id: 'u1' } as unknown as User;
      usersServiceMock.findOne.mockResolvedValue(mockUser);
      usersServiceMock.update.mockResolvedValue(mockUser);
      usersServiceMock.findOneWithNiches.mockResolvedValue(mockUser);
      bankRepositoryMock.findById.mockResolvedValue({ id: 'bank-uuid-123' } as unknown as Bank);

      const dto: UpdateProfilePayoutDto = {
        bankId: 'bank-uuid-123',
        bankAccountNumber: '0123456789',
        bankAccountName: 'Test Account Name',
      };

      const result = await service.updatePayout('u1', dto);

      expect(bankRepositoryMock.findById).toHaveBeenCalledWith('bank-uuid-123');
      expect(usersServiceMock.update).toHaveBeenCalledWith('u1', {
        bankId: 'bank-uuid-123',
        bankAccountNumber: '0123456789',
        bankAccountName: 'Test Account Name',
      });
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if bankId is not found', async () => {
      const mockUser = { id: 'u1' } as unknown as User;
      usersServiceMock.findOne.mockResolvedValue(mockUser);
      bankRepositoryMock.findById.mockResolvedValue(null);

      const dto: UpdateProfilePayoutDto = {
        bankId: 'invalid-bank-uuid',
        bankAccountNumber: '0123456789',
        bankAccountName: 'Test Account Name',
      };

      await expect(service.updatePayout('u1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('notificationSettings', () => {
    const defaultSettings = {
      newCampaigns: true,
      applicationUpdates: true,
      paymentAlerts: true,
      brandMessages: true,
      pushNotifications: true,
      emailNotifications: true,
      weeklySummary: false,
      marketingOffers: false,
    };

    describe('getNotificationSettings', () => {
      it('should return user notification settings', async () => {
        const mockUser = { id: 'u1', notificationSettings: defaultSettings } as unknown as User;
        usersServiceMock.findOne.mockResolvedValue(mockUser);

        const result = await service.getNotificationSettings('u1');

        expect(usersServiceMock.findOne).toHaveBeenCalledWith('u1');
        expect(result).toEqual(defaultSettings);
      });

      it('should throw NotFoundException if user is not found', async () => {
        usersServiceMock.findOne.mockResolvedValue(null);

        await expect(service.getNotificationSettings('u1')).rejects.toThrow(NotFoundException);
      });
    });

    describe('updateNotificationSettings', () => {
      it('should merge updates into user notification settings and return them', async () => {
        const mockUser = { id: 'u1', notificationSettings: defaultSettings } as unknown as User;
        usersServiceMock.findOne.mockResolvedValue(mockUser);
        usersServiceMock.update.mockResolvedValue(mockUser);

        const dto: UpdateNotificationSettingsDto = {
          newCampaigns: false,
          weeklySummary: true,
        };

        const result = await service.updateNotificationSettings('u1', dto);

        expect(usersServiceMock.update).toHaveBeenCalledWith('u1', {
          notificationSettings: {
            ...defaultSettings,
            newCampaigns: false,
            weeklySummary: true,
          },
        });
        expect(result).toEqual({
          ...defaultSettings,
          newCampaigns: false,
          weeklySummary: true,
        });
      });

      it('should throw NotFoundException if user is not found', async () => {
        usersServiceMock.findOne.mockResolvedValue(null);

        const dto: UpdateNotificationSettingsDto = {
          newCampaigns: false,
        };

        await expect(service.updateNotificationSettings('u1', dto)).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });

  describe('securitySettings', () => {
    const defaultSecurity = {
      twoFactorEnabled: false,
      biometricLoginEnabled: true,
      loginAlertsEnabled: true,
    };

    describe('getSecuritySettings', () => {
      it('should return user security settings', async () => {
        const mockUser = { id: 'u1', securitySettings: defaultSecurity } as unknown as User;
        usersServiceMock.findOne.mockResolvedValue(mockUser);

        const result = await service.getSecuritySettings('u1');

        expect(usersServiceMock.findOne).toHaveBeenCalledWith('u1');
        expect(result).toEqual(defaultSecurity);
      });
    });

    describe('updateSecuritySettings', () => {
      it('should merge updates into user security settings and return them', async () => {
        const mockUser = { id: 'u1', securitySettings: defaultSecurity } as unknown as User;
        usersServiceMock.findOne.mockResolvedValue(mockUser);
        usersServiceMock.update.mockResolvedValue(mockUser);

        const dto: UpdateSecuritySettingsDto = {
          twoFactorEnabled: true,
        };

        const result = await service.updateSecuritySettings('u1', dto);

        expect(usersServiceMock.update).toHaveBeenCalledWith('u1', {
          securitySettings: {
            ...defaultSecurity,
            twoFactorEnabled: true,
          },
        });
        expect(result).toEqual({
          ...defaultSecurity,
          twoFactorEnabled: true,
        });
      });
    });
  });

  describe('changePassword', () => {
    it('should change password successfully if current password matches', async () => {
      const mockUser = { id: 'u1', password: 'hashed_old_password' } as unknown as User;
      usersServiceMock.findOne.mockResolvedValue(mockUser);
      usersServiceMock.update.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_new_password');

      const dto: ChangePasswordDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      };

      await service.changePassword('u1', dto);

      expect(bcrypt.compare).toHaveBeenCalledWith('OldPassword123!', 'hashed_old_password');
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 10);
      expect(usersServiceMock.update).toHaveBeenCalledWith('u1', {
        password: 'hashed_new_password',
      });
    });

    it('should throw ConflictException if current password does not match', async () => {
      const mockUser = { id: 'u1', password: 'hashed_old_password' } as unknown as User;
      usersServiceMock.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const dto: ChangePasswordDto = {
        currentPassword: 'WrongPassword!',
        newPassword: 'NewPassword123!',
      };

      await expect(service.changePassword('u1', dto)).rejects.toThrow(ConflictException);
    });

    it('should bypass current password check if user does not have a password set', async () => {
      const mockUser = { id: 'u1', password: null } as unknown as User;
      usersServiceMock.findOne.mockResolvedValue(mockUser);
      usersServiceMock.update.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_new_password');

      const dto: ChangePasswordDto = {
        newPassword: 'NewPassword123!',
      };

      await service.changePassword('u1', dto);

      expect(usersServiceMock.update).toHaveBeenCalledWith('u1', {
        password: 'hashed_new_password',
      });
    });
  });

  describe('deactivateAccount', () => {
    it('should deactivate account successfully when password matches', async () => {
      const mockUser = { id: 'u1', password: 'hashed_password' } as unknown as User;
      usersServiceMock.findOne.mockResolvedValue(mockUser);
      usersServiceMock.update.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const dto: DeactivateAccountDto = {
        password: 'Password123!',
      };

      await service.deactivateAccount('u1', dto);

      expect(usersServiceMock.update).toHaveBeenCalledWith('u1', {
        isActive: false,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        deactivatedAt: expect.any(Date),
      });
    });

    it('should throw ConflictException if password does not match during deactivation', async () => {
      const mockUser = { id: 'u1', password: 'hashed_password' } as unknown as User;
      usersServiceMock.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const dto: DeactivateAccountDto = {
        password: 'WrongPassword!',
      };

      await expect(service.deactivateAccount('u1', dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('getTicketCategories', () => {
    it('should return all ticket categories', async () => {
      const mockCategories = [{ id: 'cat1', name: 'Payments' }];
      issueCategoryRepositoryMock.findAll.mockResolvedValue(
        mockCategories as unknown as IssueCategory[],
      );

      const result = await service.getTicketCategories();
      expect(issueCategoryRepositoryMock.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockCategories);
    });
  });

  describe('getSupportTickets', () => {
    it('should return all support tickets of a user when no ID is provided', async () => {
      const mockTickets = [{ id: 'ticket1', userId: 'u1', subject: 'Test' }];
      supportTicketRepositoryMock.findByUserId.mockResolvedValue(
        mockTickets as unknown as SupportTicket[],
      );

      const result = await service.getSupportTickets('u1');

      expect(supportTicketRepositoryMock.findByUserId).toHaveBeenCalledWith('u1');
      expect(result).toEqual(mockTickets);
    });

    it('should return a single support ticket when a valid ID is provided', async () => {
      const mockTicket = { id: 'ticket1', userId: 'u1', subject: 'Test' };
      supportTicketRepositoryMock.findByIdAndUserId.mockResolvedValue(
        mockTicket as unknown as SupportTicket,
      );

      const result = await service.getSupportTickets('u1', 'ticket1');

      expect(supportTicketRepositoryMock.findByIdAndUserId).toHaveBeenCalledWith('ticket1', 'u1');
      expect(result).toEqual(mockTicket);
    });

    it('should throw NotFoundException if support ticket is not found by ID', async () => {
      supportTicketRepositoryMock.findByIdAndUserId.mockResolvedValue(null);

      await expect(service.getSupportTickets('u1', 'ticket-nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(supportTicketRepositoryMock.findByIdAndUserId).toHaveBeenCalledWith(
        'ticket-nonexistent',
        'u1',
      );
    });
  });

  describe('createSupportTicket', () => {
    it('should throw NotFoundException if category does not exist', async () => {
      const dto: CreateSupportTicketDto = {
        issueCategoryId: 'cat-nonexistent',
        subject: 'Payout issue',
        description: 'I did not receive my payout.',
      };
      issueCategoryRepositoryMock.findById.mockResolvedValue(null);

      await expect(service.createSupportTicket('u1', dto)).rejects.toThrow(NotFoundException);
      expect(issueCategoryRepositoryMock.findById).toHaveBeenCalledWith('cat-nonexistent');
    });

    it('should create a support ticket without file attachment', async () => {
      const dto: CreateSupportTicketDto = {
        issueCategoryId: 'cat1',
        subject: 'Payout issue',
        description: 'I did not receive my payout.',
      };

      issueCategoryRepositoryMock.findById.mockResolvedValue({
        id: 'cat1',
        name: 'Payments',
      } as unknown as IssueCategory);
      supportTicketRepositoryMock.create.mockResolvedValue({
        id: 'ticket1',
        userId: 'u1',
        ...dto,
      } as unknown as SupportTicket);

      const result = await service.createSupportTicket('u1', dto);

      expect(supportTicketRepositoryMock.create).toHaveBeenCalledWith({
        userId: 'u1',
        issueCategoryId: dto.issueCategoryId,
        subject: dto.subject,
        description: dto.description,
        attachmentUrl: undefined,
      });
      expect(result.id).toBe('ticket1');
    });

    it('should create a support ticket with a file attachment', async () => {
      const dto: CreateSupportTicketDto = {
        issueCategoryId: 'cat1',
        subject: 'Bug in page',
        description: 'Page is showing white screen.',
      };
      const mockFile = {
        originalname: 'test.png',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      issueCategoryRepositoryMock.findById.mockResolvedValue({
        id: 'cat1',
        name: 'Payments',
      } as unknown as IssueCategory);
      s3ServiceMock.uploadFile.mockResolvedValue(
        'https://s3.amazonaws.com/support-tickets/test.png',
      );
      supportTicketRepositoryMock.create.mockResolvedValue({
        id: 'ticket2',
        userId: 'u1',
        attachmentUrl: 'https://s3.amazonaws.com/support-tickets/test.png',
        ...dto,
      } as unknown as SupportTicket);

      const result = await service.createSupportTicket('u1', dto, mockFile);

      expect(s3ServiceMock.uploadFile).toHaveBeenCalledWith(mockFile, 'support-tickets');
      expect(supportTicketRepositoryMock.create).toHaveBeenCalledWith({
        userId: 'u1',
        issueCategoryId: dto.issueCategoryId,
        subject: dto.subject,
        description: dto.description,
        attachmentUrl: 'https://s3.amazonaws.com/support-tickets/test.png',
      });
      expect(result.id).toBe('ticket2');
    });
  });
});
