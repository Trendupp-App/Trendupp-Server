/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { AccountLifecycleScheduler } from './account-lifecycle.scheduler';
import { User } from '../../users/entities/user.entity';
import { EmailService } from '../../../integration/email/email.service';

describe('AccountLifecycleScheduler', () => {
  let scheduler: AccountLifecycleScheduler;
  let userModelMock: any;
  let emailServiceMock: jest.Mocked<EmailService>;

  beforeEach(async () => {
    userModelMock = {
      findAll: jest.fn(),
      destroy: jest.fn(),
    };

    emailServiceMock = {
      sendAccountDeletionWarning: jest.fn(),
      sendAccountDeletionTomorrowWarning: jest.fn(),
    } as unknown as jest.Mocked<EmailService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountLifecycleScheduler,
        {
          provide: getModelToken(User),
          useValue: userModelMock,
        },
        {
          provide: EmailService,
          useValue: emailServiceMock,
        },
      ],
    }).compile();

    scheduler = module.get<AccountLifecycleScheduler>(AccountLifecycleScheduler);
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('processInactiveAccounts', () => {
    it('should delete users past 90 days, warn users past 89 days, and warn users past 60 days', async () => {
      const mockExpiredUser = {
        id: 'user-expired',
        email: 'expired@example.com',
        firstName: 'Expired',
      };
      const mockTomorrowWarningUser = {
        id: 'user-tomorrow',
        email: 'tomorrow@example.com',
        firstName: 'Tomorrow',
      };
      const mockWarningUser = {
        id: 'user-warning',
        email: 'warning@example.com',
        firstName: 'Warning',
      };

      // Mock the 3 distinct findAll calls for the scheduler phases
      userModelMock.findAll
        .mockResolvedValueOnce([mockExpiredUser]) // Step 1 (90+ days)
        .mockResolvedValueOnce([mockTomorrowWarningUser]) // Step 2 (89 days)
        .mockResolvedValueOnce([mockWarningUser]); // Step 3 (60-88 days)

      userModelMock.destroy.mockResolvedValue(1);
      emailServiceMock.sendAccountDeletionWarning.mockResolvedValue(undefined);
      emailServiceMock.sendAccountDeletionTomorrowWarning.mockResolvedValue(undefined);

      await scheduler.processInactiveAccounts();

      expect(userModelMock.findAll).toHaveBeenCalledTimes(3);
      expect(userModelMock.destroy).toHaveBeenCalledWith({
        where: { id: mockExpiredUser.id },
      });
      expect(emailServiceMock.sendAccountDeletionTomorrowWarning).toHaveBeenCalledWith(
        mockTomorrowWarningUser.email,
        mockTomorrowWarningUser.firstName,
      );
      expect(emailServiceMock.sendAccountDeletionWarning).toHaveBeenCalledWith(
        mockWarningUser.email,
        mockWarningUser.firstName,
      );
    });

    it('should handle errors gracefully during delete and email sending', async () => {
      const mockExpiredUser = {
        id: 'user-expired',
        email: 'expired@example.com',
        firstName: 'Expired',
      };
      const mockTomorrowWarningUser = {
        id: 'user-tomorrow',
        email: 'tomorrow@example.com',
        firstName: 'Tomorrow',
      };
      const mockWarningUser = {
        id: 'user-warning',
        email: 'warning@example.com',
        firstName: 'Warning',
      };

      userModelMock.findAll
        .mockResolvedValueOnce([mockExpiredUser])
        .mockResolvedValueOnce([mockTomorrowWarningUser])
        .mockResolvedValueOnce([mockWarningUser]);

      userModelMock.destroy.mockRejectedValue(new Error('DB Delete Error'));
      emailServiceMock.sendAccountDeletionTomorrowWarning.mockRejectedValue(
        new Error('Email Tomorrow Error'),
      );
      emailServiceMock.sendAccountDeletionWarning.mockRejectedValue(
        new Error('Email Warning Error'),
      );

      // Should not throw, but handle errors internally and log them
      await expect(scheduler.processInactiveAccounts()).resolves.not.toThrow();

      expect(userModelMock.destroy).toHaveBeenCalledWith({
        where: { id: mockExpiredUser.id },
      });
      expect(emailServiceMock.sendAccountDeletionTomorrowWarning).toHaveBeenCalledWith(
        mockTomorrowWarningUser.email,
        mockTomorrowWarningUser.firstName,
      );
      expect(emailServiceMock.sendAccountDeletionWarning).toHaveBeenCalledWith(
        mockWarningUser.email,
        mockWarningUser.firstName,
      );
    });
  });
});
