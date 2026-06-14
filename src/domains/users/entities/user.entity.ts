import {
  Table,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
} from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { Nationality } from './nationality.entity';
import { Role } from './role.entity';
import { State } from './state.entity';
import { Niche } from './niche.entity';
import { UserNiche } from './user-niche.entity';

@Table({ tableName: 'users' })
export class User extends BaseEntity<User> {
  @Column({ type: DataType.STRING, allowNull: false })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare firstName: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare lastName: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare phoneNumber: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  declare isActive: boolean;

  @ForeignKey(() => Role)
  @Column({ type: DataType.UUID, allowNull: true, field: 'role_id' })
  declare roleId?: string;

  @BelongsTo(() => Role)
  declare role?: Role;

  @Column({ type: DataType.STRING, allowNull: true })
  declare password?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'google_id',
    unique: true,
  })
  declare googleId?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'tiktok_open_id',
    unique: true,
  })
  declare tiktokOpenId?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'instagram_open_id',
    unique: true,
  })
  declare instagramOpenId?: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    field: 'is_email_verified',
  })
  declare isEmailVerified: boolean;

  @Column({ type: DataType.STRING, allowNull: true })
  declare username?: string;

  @ForeignKey(() => Nationality)
  @Column({ type: DataType.UUID, allowNull: true, field: 'nationality_id' })
  declare nationalityId?: string;

  @BelongsTo(() => Nationality)
  declare nationality?: Nationality;

  // Separate from nationality — represents the country the user currently lives/operates in.
  // Both nationality_id and country_id reference the same nationalities table data.
  @ForeignKey(() => Nationality)
  @Column({ type: DataType.UUID, allowNull: true, field: 'country_id' })
  declare countryId?: string;

  @BelongsTo(() => Nationality, 'country_id')
  declare country?: Nationality;

  @ForeignKey(() => State)
  @Column({ type: DataType.UUID, allowNull: true, field: 'state_id' })
  declare stateId?: string;

  @BelongsTo(() => State)
  declare state?: State;

  @Column({ type: DataType.STRING, allowNull: true })
  declare bio?: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'instagram_username' })
  declare instagramUsername?: string;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    allowNull: false,
    field: 'instagram_followers',
  })
  declare instagramFollowers: number;

  @Column({ type: DataType.STRING, allowNull: true, field: 'tiktok_username' })
  declare tiktokUsername?: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0, allowNull: false, field: 'tiktok_followers' })
  declare tiktokFollowers: number;

  @Column({ type: DataType.STRING, allowNull: true, field: 'youtube_username' })
  declare youtubeUsername?: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0, allowNull: false, field: 'youtube_followers' })
  declare youtubeFollowers: number;

  @Column({ type: DataType.STRING, allowNull: true, field: 'twitter_username' })
  declare twitterUsername?: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0, allowNull: false, field: 'twitter_followers' })
  declare twitterFollowers: number;

  @Column({ type: DataType.STRING, allowNull: true, field: 'verification_video_url' })
  declare verificationVideoUrl?: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'verification_status' })
  declare verificationStatus?: string; // 'pending' | 'approved' | 'rejected'

  @Column({ type: DataType.STRING, allowNull: true, field: 'assigned_tier' })
  declare assignedTier?: string;

  // Step 4: Payout Details — stored after mobile-side bank account verification
  @Column({ type: DataType.STRING, allowNull: true, field: 'bank_name' })
  declare bankName?: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'bank_account_number' })
  declare bankAccountNumber?: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'bank_account_name' })
  declare bankAccountName?: string;

  @BelongsToMany(() => Niche, () => UserNiche)
  declare niches?: Niche[];

  get onboardingPercentage(): number {
    let percentage = 0;

    // Signup & Email Verification: 20%
    if (this.email && this.isEmailVerified) {
      percentage += 20;
    }

    // Step 1 (Build Profile) complete: 20%
    // Requires username, country (operating country), and state.
    // Nationality (citizenship) is optional and does not gate this step.
    if (this.username && this.countryId && this.stateId) {
      percentage += 20;
    }

    // Step 2 (Niches selection) complete: 20%
    if (this.niches && this.niches.length > 0) {
      percentage += 20;
    }

    // Step 3 (Socials connection) complete: 20%
    if (
      this.instagramUsername ||
      this.tiktokUsername ||
      this.youtubeUsername ||
      this.twitterUsername
    ) {
      percentage += 20;
    }

    // Step 4 (Payout Details) complete: 20%
    // Stored after the mobile app verifies the bank account and sends the result.
    if (this.bankName && this.bankAccountNumber && this.bankAccountName) {
      percentage += 20;
    }

    return percentage;
  }

  /**
   * Returns the completion status of each individual onboarding step.
   * The mobile app uses this to know exactly which screens the user still
   * needs to visit, regardless of the order they were filled in.
   *
   * NOTE: Requires niches to be eagerly loaded (findOneWithNiches) for
   * the `niches` field to be accurate.
   */
  get onboardingStepsCompleted(): {
    profile: boolean;
    niches: boolean;
    socials: boolean;
    payout: boolean;
  } {
    return {
      // Step 1: username + country + state all set
      profile: !!(this.username && this.countryId && this.stateId),

      // Step 2: at least one niche selected
      niches: !!(this.niches && this.niches.length > 0),

      // Step 3: at least one social account connected
      socials: !!(
        this.instagramUsername ||
        this.tiktokUsername ||
        this.youtubeUsername ||
        this.twitterUsername
      ),

      // Step 4: bank account details saved after mobile-side verification
      payout: !!(this.bankName && this.bankAccountNumber && this.bankAccountName),
    };
  }

  override toJSON(): any {
    const values = { ...this.get() };
    delete values.password;
    return values;
  }
}
