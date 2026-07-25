import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import * as bcrypt from 'bcryptjs';
import { BrandCommissionTier } from '../entities/brand-commission-tier.entity';
import { Faq } from '../entities/faq.entity';
import { NewsCategory } from '../entities/news-category.entity';
import { SystemSetting } from '../entities/system-setting.entity';
import { Niche } from '../../users/entities/niche.entity';
import { Industry } from '../../users/entities/industry.entity';
import { User } from '../../users/entities/user.entity';
import {
  CreateCommissionTierDto,
  UpdateCommissionTierDto,
  CreateFaqDto,
  UpdateFaqDto,
  QueryFaqsDto,
  CreateNewsCategoryDto,
  UpdateNewsCategoryDto,
  CreateNicheDto,
  UpdateNicheDto,
  CreateIndustryDto,
  UpdateIndustryDto,
  UpdateContactInfoDto,
  UpdateExternalLinksDto,
  ChangePasswordDto,
} from '../dtos/admin-settings.dto';

@Injectable()
export class AdminSettingsService {
  constructor(
    @InjectModel(BrandCommissionTier)
    private readonly commissionTierModel: typeof BrandCommissionTier,
    @InjectModel(Faq)
    private readonly faqModel: typeof Faq,
    @InjectModel(NewsCategory)
    private readonly newsCategoryModel: typeof NewsCategory,
    @InjectModel(SystemSetting)
    private readonly systemSettingModel: typeof SystemSetting,
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
    @InjectModel(Industry)
    private readonly industryModel: typeof Industry,
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  // ─── Commission Tiers ──────────────────────────────────────────────────────

  async getCommissionTiers(): Promise<BrandCommissionTier[]> {
    return this.commissionTierModel.findAll({
      order: [
        ['isDefault', 'DESC'],
        ['createdAt', 'ASC'],
      ],
    });
  }

  async createCommissionTier(dto: CreateCommissionTierDto): Promise<BrandCommissionTier> {
    if (dto.isDefault) {
      await this.commissionTierModel.update({ isDefault: false }, { where: { isDefault: true } });
    }
    return this.commissionTierModel.create({
      name: dto.name,
      ratePercentage: dto.ratePercentage,
      isDefault: dto.isDefault || false,
      reason: dto.reason,
      brandIds: dto.brandIds || [],
    } as unknown as BrandCommissionTier);
  }

  async updateCommissionTier(
    id: string,
    dto: UpdateCommissionTierDto,
  ): Promise<BrandCommissionTier> {
    const tier = await this.commissionTierModel.findByPk(id);
    if (!tier) {
      throw new NotFoundException(`Commission Tier with ID ${id} not found.`);
    }

    if (dto.isDefault) {
      await this.commissionTierModel.update({ isDefault: false }, { where: { isDefault: true } });
    }

    const payload: Record<string, any> = {};
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.ratePercentage !== undefined) payload.ratePercentage = dto.ratePercentage;
    if (dto.isDefault !== undefined) payload.isDefault = dto.isDefault;
    if (dto.reason !== undefined) payload.reason = dto.reason;
    if (dto.brandIds !== undefined) payload.brandIds = dto.brandIds;

    await tier.update(payload);
    return tier;
  }

  async deleteCommissionTier(id: string): Promise<void> {
    const tier = await this.commissionTierModel.findByPk(id);
    if (!tier) {
      throw new NotFoundException(`Commission Tier with ID ${id} not found.`);
    }
    if (tier.isDefault) {
      throw new ForbiddenException('Cannot delete the default platform commission tier.');
    }
    await tier.destroy();
  }

  async getCommissionRateForBrand(brandId?: string): Promise<number> {
    if (brandId) {
      const customTier = await this.commissionTierModel.findOne({
        where: {
          brandIds: { [Op.contains]: [brandId] },
        },
      });
      if (customTier) {
        return customTier.ratePercentage;
      }
    }

    const defaultTier = await this.commissionTierModel.findOne({ where: { isDefault: true } });
    return defaultTier ? defaultTier.ratePercentage : 15.0;
  }

  // ─── Creator Niches ────────────────────────────────────────────────────────

  async getNiches(): Promise<Niche[]> {
    return this.nicheModel.findAll({ order: [['name', 'ASC']] });
  }

  async createNiche(dto: CreateNicheDto): Promise<Niche> {
    const existing = await this.nicheModel.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new BadRequestException(`Niche "${dto.name}" already exists.`);
    }

    // Auto-assign order as max(order) + 1 so niches self-sequence on creation
    const maxOrderNiche = await this.nicheModel.findOne({
      order: [['order', 'DESC']],
    });
    const nextOrder = maxOrderNiche ? maxOrderNiche.order + 1 : 1;

    return this.nicheModel.create({ name: dto.name, order: nextOrder } as unknown as Niche);
  }

  async updateNiche(id: string, dto: UpdateNicheDto): Promise<Niche> {
    const niche = await this.nicheModel.findByPk(id);
    if (!niche) throw new NotFoundException(`Niche with ID ${id} not found.`);
    await niche.update({ name: dto.name });
    return niche;
  }

  async deleteNiche(id: string): Promise<void> {
    const niche = await this.nicheModel.findByPk(id);
    if (!niche) throw new NotFoundException(`Niche with ID ${id} not found.`);
    await niche.destroy();
  }

  // ─── Brand Industries ──────────────────────────────────────────────────────

  async getIndustries(): Promise<Industry[]> {
    return this.industryModel.findAll({ order: [['name', 'ASC']] });
  }

  async createIndustry(dto: CreateIndustryDto): Promise<Industry> {
    const existing = await this.industryModel.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new BadRequestException(`Industry "${dto.name}" already exists.`);
    }
    return this.industryModel.create({ name: dto.name } as unknown as Industry);
  }

  async updateIndustry(id: string, dto: UpdateIndustryDto): Promise<Industry> {
    const ind = await this.industryModel.findByPk(id);
    if (!ind) throw new NotFoundException(`Industry with ID ${id} not found.`);
    await ind.update({ name: dto.name });
    return ind;
  }

  async deleteIndustry(id: string): Promise<void> {
    const ind = await this.industryModel.findByPk(id);
    if (!ind) throw new NotFoundException(`Industry with ID ${id} not found.`);
    await ind.destroy();
  }

  // ─── FAQs ──────────────────────────────────────────────────────────────────

  async getFaqs(query: QueryFaqsDto): Promise<Faq[]> {
    const whereClause: Record<string, unknown> = {};
    if (query.category && query.category !== 'All') {
      whereClause.category = query.category;
    }
    if (query.status) {
      whereClause.status = query.status;
    }
    if (query.search) {
      const searchPattern = `%${query.search}%`;
      Object.assign(whereClause, {
        [Op.or]: [
          { question: { [Op.iLike]: searchPattern } },
          { answer: { [Op.iLike]: searchPattern } },
        ],
      });
    }
    return this.faqModel.findAll({
      where: whereClause as never,
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'DESC'],
      ],
    });
  }

  async createFaq(dto: CreateFaqDto): Promise<Faq> {
    return this.faqModel.create({
      question: dto.question,
      answer: dto.answer,
      category: dto.category,
      status: dto.status || 'published',
      sortOrder: dto.sortOrder || 0,
    } as unknown as Faq);
  }

  async updateFaq(id: string, dto: UpdateFaqDto): Promise<Faq> {
    const faq = await this.faqModel.findByPk(id);
    if (!faq) throw new NotFoundException(`FAQ with ID ${id} not found.`);
    await faq.update(dto);
    return faq;
  }

  async deleteFaq(id: string): Promise<void> {
    const faq = await this.faqModel.findByPk(id);
    if (!faq) throw new NotFoundException(`FAQ with ID ${id} not found.`);
    await faq.destroy();
  }

  // ─── News Categories ───────────────────────────────────────────────────────

  async getNewsCategories(): Promise<NewsCategory[]> {
    return this.newsCategoryModel.findAll({ order: [['name', 'ASC']] });
  }

  async createNewsCategory(dto: CreateNewsCategoryDto): Promise<NewsCategory> {
    const existing = await this.newsCategoryModel.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new BadRequestException(`News category "${dto.name}" already exists.`);
    }
    return this.newsCategoryModel.create({ name: dto.name } as unknown as NewsCategory);
  }

  async updateNewsCategory(id: string, dto: UpdateNewsCategoryDto): Promise<NewsCategory> {
    const cat = await this.newsCategoryModel.findByPk(id);
    if (!cat) throw new NotFoundException(`News Category with ID ${id} not found.`);
    await cat.update({ name: dto.name });
    return cat;
  }

  async deleteNewsCategory(id: string): Promise<void> {
    const cat = await this.newsCategoryModel.findByPk(id);
    if (!cat) throw new NotFoundException(`News Category with ID ${id} not found.`);
    await cat.destroy();
  }

  // ─── Contact Info & External Links ────────────────────────────────────────

  async getContactInfo(): Promise<Record<string, any>> {
    const setting = await this.systemSettingModel.findOne({ where: { key: 'contact_info' } });
    return (
      setting?.value || {
        businessAddress: '12 Marina Way, Lagos Island, Lagos, Nigeria',
        supportEmail: 'support@trendupp.com',
        supportPhone: '+234 800 TRENDUPP',
      }
    );
  }

  async updateContactInfo(dto: UpdateContactInfoDto): Promise<Record<string, any>> {
    const val = JSON.parse(JSON.stringify(dto)) as Record<string, unknown>;
    const [setting] = await this.systemSettingModel.findOrCreate({
      where: { key: 'contact_info' },
      defaults: { key: 'contact_info', value: val } as unknown as SystemSetting,
    });
    await setting.update({ value: val });
    return setting.value;
  }

  async getExternalLinks(): Promise<Record<string, any>> {
    const setting = await this.systemSettingModel.findOne({ where: { key: 'external_links' } });
    return (
      setting?.value || {
        websiteUrl: 'https://trendupp.com',
        instagram: '@trendupp',
        twitter: '@trendupp_ng',
        linkedin: 'trendupp',
        youtube: 'TrenduppAfrica',
      }
    );
  }

  async updateExternalLinks(dto: UpdateExternalLinksDto): Promise<Record<string, any>> {
    const val = JSON.parse(JSON.stringify(dto)) as Record<string, unknown>;
    const [setting] = await this.systemSettingModel.findOrCreate({
      where: { key: 'external_links' },
      defaults: { key: 'external_links', value: val } as unknown as SystemSetting,
    });
    await setting.update({ value: val });
    return setting.value;
  }

  // ─── Change Password ───────────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirm password do not match.');
    }

    const user = await this.userModel.findByPk(userId);
    if (!user || !user.password) {
      throw new NotFoundException('User account not found.');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new ForbiddenException('Current password entered is incorrect.');
    }

    const hashedNewPassword = await bcrypt.hash(dto.newPassword, 10);
    await user.update({ password: hashedNewPassword });

    return { message: 'Password updated successfully.' };
  }
}
