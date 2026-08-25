import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { OtpService } from './otp.service';
import { EmailService } from '../../../integration/email/email.service';
import { UsersService } from '../../users/services/users.service';
import { SignupDto } from '../dtos/signup.dto';
import { LoginDto } from '../dtos/login.dto';
import { ForgotPasswordDto } from '../dtos/forgot-password.dto';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import { VerifyOtpDto } from '../dtos/verify-otp.dto';
import { SendOtpDto } from '../dtos/send-otp.dto';
import { GoogleLoginDto } from '../dtos/google-login.dto';
import { TiktokLoginDto } from '../dtos/tiktok-login.dto';
import { InstagramLoginDto } from '../dtos/instagram-login.dto';
import { FacebookLoginDto } from '../dtos/facebook-login.dto';
import { AppleLoginDto } from '../dtos/apple-login.dto';
import { GoogleAuthService } from '../../../integration/social-apis/google-auth.service';
import { TiktokAuthService } from '../../../integration/social-apis/tiktok-auth.service';
import { InstagramAuthService } from '../../../integration/social-apis/instagram-auth.service';
import { FacebookAuthService } from '../../../integration/social-apis/facebook-auth.service';
import { AppleAuthService } from '../../../integration/social-apis/apple-auth.service';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { AppleNameCache } from '../entities/apple-name-cache.entity';
import { AuthProviderSetting } from '../entities/auth-provider-setting.entity';

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isEmailVerified: boolean;
    onboardingPercentage: number;
    onboardingStepsCompleted: {
      profile: boolean;
      niches?: boolean;
      socials: boolean;
      payout?: boolean;
      industries?: boolean;
      representative?: boolean;
    };
    socialsConnected: {
      instagram: boolean;
      tiktok: boolean;
      youtube: boolean;
      twitter: boolean;
      facebook: boolean;
    };
    username?: string;
    niches: any[];
    acceptedPromotions: boolean;
  };
}

export interface SignupResponse {
  message: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    username?: string;
    role: string;
    isEmailVerified: boolean;
    onboardingPercentage: number;
    onboardingStepsCompleted: {
      profile: boolean;
      niches?: boolean;
      socials: boolean;
      payout?: boolean;
      industries?: boolean;
      representative?: boolean;
    };
    socialsConnected: {
      instagram: boolean;
      tiktok: boolean;
      youtube: boolean;
      twitter: boolean;
    };
    niches: any[];
    acceptedPromotions: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly tiktokAuthService: TiktokAuthService,
    private readonly instagramAuthService: InstagramAuthService,
    private readonly facebookAuthService: FacebookAuthService,
    private readonly appleAuthService: AppleAuthService,
    @InjectModel(AppleNameCache)
    private readonly appleNameCacheModel: typeof AppleNameCache,
    @InjectModel(AuthProviderSetting)
    private readonly authProviderSettingModel: typeof AuthProviderSetting,
  ) {}

  /**
   * Stash the (first-authorization-only) Apple name server-side so a later
   * signup from any device can recover it. Best-effort: a cache failure must
   * never break the auth flow itself.
   */
  private async upsertAppleNameCache(
    appleUserId: string,
    email: string | undefined,
    dto: AppleLoginDto,
  ): Promise<void> {
    try {
      const existing = await this.appleNameCacheModel.findOne({ where: { appleUserId } });
      if (existing) {
        await existing.update({
          firstName: dto.firstName!,
          lastName: dto.lastName ?? null,
          email: email ?? existing.email,
        });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (this.appleNameCacheModel as any).create({
          appleUserId,
          email: email ?? null,
          firstName: dto.firstName!,
          lastName: dto.lastName ?? null,
        });
      }
      this.logger.log(`Apple name cached server-side for ${appleUserId}`);
    } catch (error) {
      this.logger.warn(
        `Could not cache Apple name for ${appleUserId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Effective kill-switch state for an OAuth provider. Fail-open on a missing
   * row or a DB hiccup: a broken settings lookup must never lock every user
   * out of authentication.
   */
  private async getProviderPolicy(
    provider: string,
  ): Promise<{ signinEnabled: boolean; signupEnabled: boolean }> {
    try {
      const row = await this.authProviderSettingModel.findOne({ where: { provider } });
      if (!row) return { signinEnabled: true, signupEnabled: true };
      return { signinEnabled: row.signinEnabled, signupEnabled: row.signupEnabled };
    } catch (error) {
      this.logger.warn(
        `Could not load auth provider policy for "${provider}" — allowing: ${(error as Error).message}`,
      );
      return { signinEnabled: true, signupEnabled: true };
    }
  }

  private assertSigninEnabled(policy: { signinEnabled: boolean }, label: string): void {
    if (!policy.signinEnabled) {
      throw new ForbiddenException(
        `Sign-in with ${label} is currently unavailable. Please try another sign-in method.`,
      );
    }
  }

  private assertSignupEnabled(policy: { signupEnabled: boolean }, label: string): void {
    if (!policy.signupEnabled) {
      throw new ForbiddenException(
        `New signups with ${label} are currently unavailable. Please sign up another way.`,
      );
    }
  }

  /** Public list of provider availability — drives which buttons clients show. */
  async getAuthProviders(): Promise<
    Array<{ provider: string; signinEnabled: boolean; signupEnabled: boolean }>
  > {
    const providers = ['google', 'apple', 'facebook', 'tiktok', 'instagram'];
    const rows = await this.authProviderSettingModel.findAll();
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    return providers.map((provider) => {
      const row = byProvider.get(provider);
      return {
        provider,
        signinEnabled: row?.signinEnabled ?? true,
        signupEnabled: row?.signupEnabled ?? true,
      };
    });
  }

  /**
   * Shared role resolution for social signups: accepts a role UUID or name,
   * defaulting to 'creator'.
   */
  private async resolveSignupRole(role?: string): Promise<Role> {
    let roleRecord: Role | null = null;
    if (role) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(role);
      roleRecord = isUuid
        ? await this.usersService.findRoleById(role)
        : await this.usersService.findRoleByName(role);
    } else {
      roleRecord = await this.usersService.findRoleByName('creator');
    }
    if (!roleRecord) {
      throw new NotFoundException('Account type does not exist');
    }
    return roleRecord;
  }

  /**
   * Derive a presentable first name from an email's local part —
   * "ada.obi99@gmail.com" → "Ada". Returns null for addresses whose local
   * part means nothing to a human: Apple private relay (random tokens like
   * "x9f3k2q@privaterelay.appleid.com") and our own synthetic fallbacks.
   */
  private static nameFromEmail(email?: string | null): string | null {
    if (!email) return null;
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return null;
    if (/privaterelay\.appleid\.com$/i.test(domain) || /^trendupp\./i.test(domain)) return null;

    const word = localPart.split(/[._\-+]/)[0]?.replace(/\d+$/g, '') ?? '';
    if (word.length < 2) return null;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  async signup(signupDto: SignupDto): Promise<SignupResponse> {
    const { password, firstName, lastName, phoneNumber, role } = signupDto;
    // Normalise email: force lowercase and strip surrounding whitespace.
    // Mobile keyboards often auto-capitalise the first character, which would
    // cause lookups to fail if stored with mixed case.
    const email = signupDto.email.toLowerCase().trim();

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser && existingUser.isEmailVerified) {
      throw new ConflictException('A user with this account already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    if (!role) {
      throw new BadRequestException('role is required. Please specify either "creator" or "brand"');
    }

    let roleRecord: Role | null = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(role);
    if (isUuid) {
      roleRecord = await this.usersService.findRoleById(role);
    } else {
      roleRecord = await this.usersService.findRoleByName(role);
    }

    if (!roleRecord) {
      throw new NotFoundException('Account type does not exist');
    }

    let finalFirstName = firstName || '';
    let finalLastName = lastName || '';
    let finalUsername = '';

    if (roleRecord.name === 'brand') {
      if (!signupDto.brandName) {
        throw new BadRequestException('brandName is required for brand signup');
      }
      finalUsername = signupDto.brandName;
      finalFirstName = '';
      finalLastName = '';
    } else {
      if (!firstName || !lastName) {
        throw new BadRequestException('firstName and lastName are required for creator signup');
      }
      if (!signupDto.username) {
        throw new BadRequestException('username is required for creator signup');
      }
      finalUsername = signupDto.username;
    }

    if (existingUser) {
      // If email is not verified, update details, generate a new OTP, and resend
      await existingUser.update({
        password: hashedPassword,
        firstName: finalFirstName,
        lastName: finalLastName,
        username: finalUsername || undefined,
        phoneNumber,
        roleId: roleRecord.id,
        acceptedPromotions: signupDto.acceptedPromotions || false,
      });

      const otpRecord = await this.otpService.generateOtp(email, 'registration');
      await this.emailService.sendOtpEmail(email, otpRecord.code);

      this.logger.log(`User registration resent successfully and OTP sent to ${email}`);

      const freshUser = await this.usersService.findOneWithNiches(existingUser.id);
      const defaultSteps = {
        profile: false,
        niches: false,
        socials: false,
        payout: false,
        industries: false,
        representative: false,
      };
      const defaultSocials = {
        instagram: false,
        tiktok: false,
        youtube: false,
        twitter: false,
        facebook: false,
      };

      return {
        message: `Signup successful. Please verify your email with the OTP sent. Here is your OTP: ${otpRecord.code}`,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          username: existingUser.username,
          role: roleRecord.name,
          isEmailVerified: existingUser.isEmailVerified,
          acceptedPromotions: existingUser.acceptedPromotions,
          onboardingPercentage: freshUser?.onboardingPercentage ?? 0,
          onboardingStepsCompleted: freshUser?.onboardingStepsCompleted ?? defaultSteps,
          socialsConnected: freshUser?.socialsConnected ?? defaultSocials,
          niches: freshUser?.niches || [],
        },
      };
    }

    const user = await this.usersService.create({
      email,
      password: hashedPassword,
      firstName: finalFirstName,
      lastName: finalLastName,
      username: finalUsername || undefined,
      phoneNumber,
      roleId: roleRecord.id,
      isEmailVerified: false,
      acceptedTerms: true,
      acceptedPromotions: signupDto.acceptedPromotions || false,
    });

    // Send OTP of type 'registration'
    const otpRecord = await this.otpService.generateOtp(email, 'registration');
    await this.emailService.sendOtpEmail(email, otpRecord.code);

    this.logger.log(`User registered successfully and registration OTP sent to ${email}`);

    // Retrieve fresh user details (with dynamic onboardingPercentage computed)
    const freshUser = await this.usersService.findOneWithNiches(user.id);
    // Default steps object used as fallback if user record is unexpectedly null
    const defaultSteps = {
      profile: false,
      niches: false,
      socials: false,
      payout: false,
      industries: false,
      representative: false,
    };
    const defaultSocials = {
      instagram: false,
      tiktok: false,
      youtube: false,
      twitter: false,
      facebook: false,
    };

    return {
      message: `Signup successful. Please verify your email with the OTP sent. Here is your OTP: ${otpRecord.code}`,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: roleRecord.name,
        isEmailVerified: user.isEmailVerified,
        acceptedPromotions: user.acceptedPromotions,
        onboardingPercentage: freshUser?.onboardingPercentage ?? 0,
        onboardingStepsCompleted: freshUser?.onboardingStepsCompleted ?? defaultSteps,
        socialsConnected: freshUser?.socialsConnected ?? defaultSocials,
        niches: freshUser?.niches || [],
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    // Normalise email before lookup to handle mixed-case input from mobile keyboards.
    const email = loginDto.email.toLowerCase().trim();
    const { password } = loginDto;

    const user = await this.usersService.findByEmail(email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.checkAndReactivateUser(user);

    if (!user.isEmailVerified) {
      // Trigger a new registration OTP if they try to log in but haven't verified yet
      const otpRecord = await this.otpService.generateOtp(email, 'registration');
      await this.emailService.sendOtpEmail(email, otpRecord.code);
      throw new UnauthorizedException(
        'Email is not verified. A new verification OTP code has been sent.',
      );
    }

    // Load full user details with associations for percentage calculation
    await this.usersService.update(user.id, { lastLoginAt: new Date() });
    const userWithNiches = await this.usersService.findOneWithNiches(user.id);
    const token = this.generateToken(user);
    const defaultSteps = {
      profile: false,
      niches: false,
      socials: false,
      payout: false,
      industries: false,
      representative: false,
    };
    const defaultSocials = {
      instagram: false,
      tiktok: false,
      youtube: false,
      twitter: false,
      facebook: false,
    };

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role?.name || 'creator',
        isEmailVerified: user.isEmailVerified,
        acceptedPromotions: user.acceptedPromotions,
        onboardingPercentage: userWithNiches?.onboardingPercentage ?? 0,
        onboardingStepsCompleted: userWithNiches?.onboardingStepsCompleted ?? defaultSteps,
        socialsConnected: userWithNiches?.socialsConnected ?? defaultSocials,
        username: user.username,
        niches: userWithNiches?.niches || [],
      },
    };
  }

  async googleLogin(googleLoginDto: GoogleLoginDto): Promise<AuthResponse> {
    const { idToken, role } = googleLoginDto;

    const policy = await this.getProviderPolicy('google');
    let isNewUser = false;

    const payload = await this.googleAuthService.verifyIdToken(idToken);
    const googleId = payload.sub;
    const email = payload.email!;

    const firstName = payload.given_name || payload.name || 'Google';
    const lastName = payload.family_name || '';

    let user = await this.usersService.findByGoogleId(googleId);

    if (!user) {
      user = await this.usersService.findByEmail(email);

      if (user) {
        await this.usersService.update(user.id, {
          googleId,
          isEmailVerified: true,
        });
        user = await this.usersService.findOne(user.id);
      } else {
        isNewUser = true;
        this.assertSignupEnabled(policy, 'Google');
        if (googleLoginDto.acceptedTerms !== true) {
          throw new BadRequestException('No account found, please signup first to continue.');
        }

        let roleRecord: Role | null = null;
        if (role) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            role,
          );
          if (isUuid) {
            roleRecord = await this.usersService.findRoleById(role);
          } else {
            roleRecord = await this.usersService.findRoleByName(role);
          }
        } else {
          roleRecord = await this.usersService.findRoleByName('creator');
        }

        if (!roleRecord) {
          throw new NotFoundException('Account type does not exist');
        }

        user = await this.usersService.create({
          email,
          firstName,
          lastName,
          googleId,
          roleId: roleRecord.id,
          isEmailVerified: true,
          acceptedTerms: true,
          acceptedPromotions: googleLoginDto.acceptedPromotions || false,
        });
        user = await this.usersService.findOne(user.id);
      }
    } else {
      if (!user.isEmailVerified) {
        await this.usersService.update(user.id, { isEmailVerified: true });
        user = await this.usersService.findOne(user.id);
      }
    }

    if (!user) {
      throw new UnauthorizedException('Authentication failed');
    }

    if (!isNewUser) {
      this.assertSigninEnabled(policy, 'Google');
    }
    this.checkAndReactivateUser(user);

    const userWithNiches = await this.usersService.findOneWithNiches(user.id);
    const token = this.generateToken(user);
    const defaultSteps = {
      profile: false,
      niches: false,
      socials: false,
      payout: false,
      industries: false,
      representative: false,
    };
    const defaultSocials = {
      instagram: false,
      tiktok: false,
      youtube: false,
      twitter: false,
      facebook: false,
    };

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role?.name || 'creator',
        isEmailVerified: user.isEmailVerified,
        acceptedPromotions: user.acceptedPromotions,
        onboardingPercentage: userWithNiches?.onboardingPercentage ?? 0,
        onboardingStepsCompleted: userWithNiches?.onboardingStepsCompleted ?? defaultSteps,
        socialsConnected: userWithNiches?.socialsConnected ?? defaultSocials,
        username: user.username,
        niches: userWithNiches?.niches || [],
      },
    };
  }

  async tiktokLogin(tiktokLoginDto: TiktokLoginDto): Promise<AuthResponse> {
    const { code, redirectUri, role, codeVerifier } = tiktokLoginDto;

    const policy = await this.getProviderPolicy('tiktok');
    let isNewUser = false;

    const tokenResponse = await this.tiktokAuthService.exchangeCodeForToken(
      code,
      redirectUri,
      codeVerifier,
    );
    const profile = await this.tiktokAuthService.getUserProfile(tokenResponse.accessToken);

    const tiktokOpenId = profile.openId;
    const email = `tiktok_${tiktokOpenId}@trendupp.tiktok`;

    const nameParts = profile.displayName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'TikTok';
    const lastName = nameParts.slice(1).join(' ') || '';

    let user = await this.usersService.findByTiktokOpenId(tiktokOpenId);

    if (!user) {
      isNewUser = true;
      this.assertSignupEnabled(policy, 'TikTok');
      if (tiktokLoginDto.acceptedTerms !== true) {
        throw new BadRequestException('No account found, please sign up first to continue.');
      }

      let roleRecord: Role | null = null;
      if (role) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(role);
        if (isUuid) {
          roleRecord = await this.usersService.findRoleById(role);
        } else {
          roleRecord = await this.usersService.findRoleByName(role);
        }
      } else {
        roleRecord = await this.usersService.findRoleByName('creator');
      }

      if (!roleRecord) {
        throw new NotFoundException('Account type does not exist');
      }

      user = await this.usersService.create({
        email,
        firstName,
        lastName,
        tiktokOpenId,
        roleId: roleRecord.id,
        isEmailVerified: true,
        acceptedTerms: true,
        acceptedPromotions: tiktokLoginDto.acceptedPromotions || false,
      });
      user = await this.usersService.findOne(user.id);
    } else {
      if (!user.isEmailVerified) {
        await this.usersService.update(user.id, { isEmailVerified: true });
        user = await this.usersService.findOne(user.id);
      }
    }

    if (!user) {
      throw new UnauthorizedException('Authentication failed');
    }

    if (!isNewUser) {
      this.assertSigninEnabled(policy, 'TikTok');
    }
    this.checkAndReactivateUser(user);

    const userWithNiches = await this.usersService.findOneWithNiches(user.id);
    const token = this.generateToken(user);
    const defaultSteps = {
      profile: false,
      niches: false,
      socials: false,
      payout: false,
      industries: false,
      representative: false,
    };
    const defaultSocials = {
      instagram: false,
      tiktok: false,
      youtube: false,
      twitter: false,
      facebook: false,
    };

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role?.name || 'creator',
        isEmailVerified: user.isEmailVerified,
        acceptedPromotions: user.acceptedPromotions,
        onboardingPercentage: userWithNiches?.onboardingPercentage ?? 0,
        onboardingStepsCompleted: userWithNiches?.onboardingStepsCompleted ?? defaultSteps,
        socialsConnected: userWithNiches?.socialsConnected ?? defaultSocials,
        username: user.username,
        niches: userWithNiches?.niches || [],
      },
    };
  }

  async instagramLogin(instagramLoginDto: InstagramLoginDto): Promise<AuthResponse> {
    const { code, redirectUri, role } = instagramLoginDto;

    const policy = await this.getProviderPolicy('instagram');
    let isNewUser = false;

    const tokenResponse = await this.instagramAuthService.exchangeCodeForToken(code, redirectUri);
    const profile = await this.instagramAuthService.getUserProfile(tokenResponse.accessToken);

    const instagramOpenId = profile.id;
    const username = profile.username;
    const email = `instagram_${instagramOpenId}@trendupp.instagram`;

    const firstName = username || 'Instagram';
    const lastName = '';

    let user = await this.usersService.findByInstagramOpenId(instagramOpenId);

    if (!user) {
      isNewUser = true;
      this.assertSignupEnabled(policy, 'Instagram');
      if (instagramLoginDto.acceptedTerms !== true) {
        throw new BadRequestException('No account found, please signup first to continue.');
      }

      let roleRecord: Role | null = null;
      if (role) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(role);
        if (isUuid) {
          roleRecord = await this.usersService.findRoleById(role);
        } else {
          roleRecord = await this.usersService.findRoleByName(role);
        }
      } else {
        roleRecord = await this.usersService.findRoleByName('creator');
      }

      if (!roleRecord) {
        throw new NotFoundException('Account type does not exist');
      }

      user = await this.usersService.create({
        email,
        firstName,
        lastName,
        instagramOpenId,
        instagramUsername: username,
        roleId: roleRecord.id,
        isEmailVerified: true,
        acceptedTerms: true,
        acceptedPromotions: instagramLoginDto.acceptedPromotions || false,
      });
      user = await this.usersService.findOne(user.id);
    } else {
      const updates: Partial<User> = {};
      if (!user.isEmailVerified) {
        updates.isEmailVerified = true;
      }
      if (user.instagramUsername !== username) {
        updates.instagramUsername = username;
      }
      if (Object.keys(updates).length > 0) {
        await this.usersService.update(user.id, updates);
        user = await this.usersService.findOne(user.id);
      }
    }

    if (!user) {
      throw new UnauthorizedException('Authentication failed');
    }

    if (!isNewUser) {
      this.assertSigninEnabled(policy, 'Instagram');
    }
    this.checkAndReactivateUser(user);

    const userWithNiches = await this.usersService.findOneWithNiches(user.id);
    const token = this.generateToken(user);
    const defaultSteps = {
      profile: false,
      niches: false,
      socials: false,
      payout: false,
      industries: false,
      representative: false,
    };
    const defaultSocials = {
      instagram: false,
      tiktok: false,
      youtube: false,
      twitter: false,
      facebook: false,
    };

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role?.name || 'creator',
        isEmailVerified: user.isEmailVerified,
        acceptedPromotions: user.acceptedPromotions,
        onboardingPercentage: userWithNiches?.onboardingPercentage ?? 0,
        onboardingStepsCompleted: userWithNiches?.onboardingStepsCompleted ?? defaultSteps,
        socialsConnected: userWithNiches?.socialsConnected ?? defaultSocials,
        username: user.username,
        niches: userWithNiches?.niches || [],
      },
    };
  }

  async facebookLogin(facebookLoginDto: FacebookLoginDto): Promise<AuthResponse> {
    const { code, redirectUri, role } = facebookLoginDto;

    const policy = await this.getProviderPolicy('facebook');
    let isNewUser = false;

    const tokenResponse = await this.facebookAuthService.exchangeCodeForToken(code, redirectUri);
    const profile = await this.facebookAuthService.getUserProfile(tokenResponse.accessToken);

    const facebookOpenId = profile.id;
    // Facebook shares the real email when the user grants it; otherwise fall
    // back to a synthetic address (in-app becomes the primary channel).
    const email = profile.email || `facebook_${facebookOpenId}@trendupp.facebook`;

    let user = await this.usersService.findByFacebookOpenId(facebookOpenId);

    if (!user && profile.email) {
      // Same mailbox, existing account (e.g. signed up with Google) — link it.
      user = await this.usersService.findByEmail(profile.email);
      if (user) {
        await this.usersService.update(user.id, { facebookOpenId, isEmailVerified: true });
        user = await this.usersService.findOne(user.id);
      }
    }

    if (!user) {
      isNewUser = true;
      this.assertSignupEnabled(policy, 'Facebook');
      if (facebookLoginDto.acceptedTerms !== true) {
        throw new BadRequestException('No account found, please signup first to continue.');
      }

      const roleRecord = await this.resolveSignupRole(role);

      user = await this.usersService.create({
        email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        facebookOpenId,
        roleId: roleRecord.id,
        isEmailVerified: true,
        acceptedTerms: true,
        acceptedPromotions: facebookLoginDto.acceptedPromotions || false,
      });
      user = await this.usersService.findOne(user.id);
    } else if (!user.isEmailVerified) {
      await this.usersService.update(user.id, { isEmailVerified: true });
      user = await this.usersService.findOne(user.id);
    }

    if (!user) {
      throw new UnauthorizedException('Authentication failed');
    }

    if (!isNewUser) {
      this.assertSigninEnabled(policy, 'Facebook');
    }
    this.checkAndReactivateUser(user);
    return this.buildSocialAuthResponse(user);
  }

  async appleLogin(appleLoginDto: AppleLoginDto): Promise<AuthResponse> {
    const { identityToken, role } = appleLoginDto;

    const policy = await this.getProviderPolicy('apple');
    let isNewUser = false;

    const identity = await this.appleAuthService.verifyIdentityToken(identityToken);

    const appleUserId = identity.appleUserId;
    // identity.email is real or a private-relay address (both deliverable);
    // it can be absent on repeat logins — synthetic fallback covers that.
    const email = identity.email || `apple_${appleUserId}@trendupp.apple`;

    // Server-side name backup: Apple sends the name exactly once per Apple
    // ID, and that one delivery often lands on a request that does NOT create
    // the account (sign-in before signup, abandoned flow). Stash it keyed by
    // the verified appleUserId whenever it shows up, so a later signup — from
    // ANY device — can recover it. Deleted once consumed.
    if (appleLoginDto.firstName) {
      await this.upsertAppleNameCache(appleUserId, identity.email, appleLoginDto);
    }

    let user = await this.usersService.findByAppleUserId(appleUserId);

    if (!user && identity.email) {
      // Same mailbox, existing account — link the Apple identity to it.
      user = await this.usersService.findByEmail(identity.email);
      if (user) {
        await this.usersService.update(user.id, { appleUserId, isEmailVerified: true });
        user = await this.usersService.findOne(user.id);
      }
    }

    if (!user) {
      isNewUser = true;
      this.assertSignupEnabled(policy, 'Apple');
      if (appleLoginDto.acceptedTerms !== true) {
        throw new BadRequestException('No account found, please signup first to continue.');
      }

      const roleRecord = await this.resolveSignupRole(role);

      // Name resolution, best source first: the request body (Apple's
      // first-authorization delivery), then the server-side cache stashed by
      // an earlier attempt (e.g. the sign-in that got "please signup first"),
      // then a name derived from a real mailbox, then a neutral placeholder.
      const cachedName = appleLoginDto.firstName
        ? null
        : await this.appleNameCacheModel.findOne({ where: { appleUserId } });

      user = await this.usersService.create({
        email,
        firstName:
          appleLoginDto.firstName ||
          cachedName?.firstName ||
          AuthService.nameFromEmail(identity.email) ||
          'User',
        lastName: appleLoginDto.lastName || cachedName?.lastName || '',
        appleUserId,
        roleId: roleRecord.id,
        isEmailVerified: true,
        acceptedTerms: true,
        acceptedPromotions: appleLoginDto.acceptedPromotions || false,
      });
      user = await this.usersService.findOne(user.id);

      // The cache did its job (or was never needed) — don't keep PII around.
      await this.appleNameCacheModel.destroy({ where: { appleUserId }, force: true });
    } else {
      // Self-heal: if this login carried the name (first authorization, or a
      // Settings revoke + re-grant, which makes Apple resend it) — or an
      // earlier attempt stashed it in the server-side cache — and the stored
      // name is still a placeholder, adopt it.
      const hasPlaceholderName =
        !user.firstName || user.firstName === 'Apple' || user.firstName === 'User';
      const updates: Record<string, unknown> = {};
      if (hasPlaceholderName) {
        const cachedName = appleLoginDto.firstName
          ? null
          : await this.appleNameCacheModel.findOne({ where: { appleUserId } });
        const healFirstName = appleLoginDto.firstName || cachedName?.firstName;
        if (healFirstName) {
          updates.firstName = healFirstName;
          const healLastName = appleLoginDto.lastName || cachedName?.lastName;
          if (healLastName && !user.lastName) updates.lastName = healLastName;
        }
      }
      if (!user.isEmailVerified) updates.isEmailVerified = true;

      if (Object.keys(updates).length > 0) {
        await this.usersService.update(user.id, updates);
        user = await this.usersService.findOne(user.id);
      }
      if (updates.firstName) {
        await this.appleNameCacheModel.destroy({ where: { appleUserId }, force: true });
      }
    }

    if (!user) {
      throw new UnauthorizedException('Authentication failed');
    }

    if (!isNewUser) {
      this.assertSigninEnabled(policy, 'Apple');
    }
    this.checkAndReactivateUser(user);
    return this.buildSocialAuthResponse(user);
  }

  /** Shared response assembly for the social login methods. */
  private async buildSocialAuthResponse(user: User): Promise<AuthResponse> {
    const userWithNiches = await this.usersService.findOneWithNiches(user.id);
    const token = this.generateToken(user);
    const defaultSteps = {
      profile: false,
      niches: false,
      socials: false,
      payout: false,
      industries: false,
      representative: false,
    };
    const defaultSocials = {
      instagram: false,
      tiktok: false,
      youtube: false,
      twitter: false,
      facebook: false,
    };

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role?.name || 'creator',
        isEmailVerified: user.isEmailVerified,
        acceptedPromotions: user.acceptedPromotions,
        onboardingPercentage: userWithNiches?.onboardingPercentage ?? 0,
        onboardingStepsCompleted: userWithNiches?.onboardingStepsCompleted ?? defaultSteps,
        socialsConnected: userWithNiches?.socialsConnected ?? defaultSocials,
        username: user.username,
        niches: userWithNiches?.niches || [],
      },
    };
  }

  async sendOtp(sendOtpDto: SendOtpDto): Promise<void> {
    // Normalise email before OTP generation and email dispatch.
    const email = sendOtpDto.email.toLowerCase().trim();

    const otpRecord = await this.otpService.generateOtp(email, 'login');

    await this.emailService.sendOtpEmail(email, otpRecord.code);

    this.logger.log(`OTP orchestration complete for ${email}`);
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<AuthResponse | { message: string }> {
    // Normalise email before OTP verification lookup.
    const email = verifyOtpDto.email.toLowerCase().trim();
    const { code } = verifyOtpDto;

    // If this is a password-reset OTP, mark it as verified (do not delete it).
    // The resetPassword endpoint will confirm and consume it instead of re-asking for the code.
    const isPasswordResetOtp = await this.otpService.verifyOtpForPasswordReset(email, code);
    if (isPasswordResetOtp) {
      return { message: 'OTP verified successfully. You may now reset your password.' };
    }

    // For all other OTP types (registration, login, etc.) — verify and delete as normal.
    const isValid = await this.otpService.verifyOtp(email, code);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    const user = await this.usersService.findByEmail(email);
    if (user) {
      this.checkAndReactivateUser(user);

      if (!user.isEmailVerified) {
        await this.usersService.update(user.id, { isEmailVerified: true });
        user.isEmailVerified = true;
      }

      const freshUser = await this.usersService.findOneWithNiches(user.id);
      const token = this.generateToken(user);
      const defaultSteps = {
        profile: false,
        niches: false,
        socials: false,
        payout: false,
        industries: false,
        representative: false,
      };
      const defaultSocials = {
        instagram: false,
        tiktok: false,
        youtube: false,
        twitter: false,
        facebook: false,
      };

      return {
        accessToken: token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role?.name || 'creator',
          isEmailVerified: user.isEmailVerified,
          acceptedPromotions: user.acceptedPromotions,
          onboardingPercentage: freshUser?.onboardingPercentage ?? 0,
          onboardingStepsCompleted: freshUser?.onboardingStepsCompleted ?? defaultSteps,
          socialsConnected: freshUser?.socialsConnected ?? defaultSocials,
          username: user.username,
          niches: freshUser?.niches || [],
        },
      };
    }

    return { message: 'OTP verified successfully' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    // Normalise email before lookup — prevents false negatives if user typed in mixed case.
    const email = forgotPasswordDto.email.toLowerCase().trim();

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Production standard: Do not reveal that the user does not exist (mitigates enumeration)
      this.logger.warn(`Password reset requested for non-existent email: ${email}`);
      return { message: 'If the email exists, a password reset OTP code has been sent.' };
    }

    const otpRecord = await this.otpService.generateOtp(email, 'password-reset');
    await this.emailService.sendOtpEmail(email, otpRecord.code);

    return {
      message:
        'If the email exists, a password reset OTP code has been sent. code:' + otpRecord.code,
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    // Normalise email before lookup.
    const email = resetPasswordDto.email.toLowerCase().trim();
    const { newPassword } = resetPasswordDto;

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Confirm the user completed the OTP verification step for password-reset.
    // The otp/verify endpoint marks the OTP as verified without deleting it;
    // we consume it here after a successful reset to prevent reuse.
    const hasVerified = await this.otpService.hasVerifiedPasswordResetOtp(email);
    if (!hasVerified) {
      throw new UnauthorizedException(
        'Password reset requires a verified OTP. Please complete the OTP verification step first.',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.update(user.id, { password: hashedPassword });

    // Consume the verified OTP so it cannot be reused.
    await this.otpService.consumeVerifiedPasswordResetOtp(email);

    this.logger.log(`Password reset complete for user ${email}`);

    return { message: 'Password has been reset successfully' };
  }

  private generateToken(user: User): string {
    const secret =
      this.configService.get<string>('jwt.secret') ||
      'trendupp-default-secret-key-for-development-and-testing';
    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '24h';
    return jwt.sign({ id: user.id, email: user.email }, secret, {
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  private checkAndReactivateUser(user: User): void {
    if (user.isActive === false || user.deactivatedAt) {
      throw new ForbiddenException(
        'Your account has been deleted or deactivated. You cannot log in with this account.',
      );
    }
  }

  async checkUsernameAvailability(
    username: string,
  ): Promise<{ username: string; isAvailable: boolean }> {
    const user = await this.usersService.findByUsername(username);
    return {
      username,
      isAvailable: !user,
    };
  }
}
