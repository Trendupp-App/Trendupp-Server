import { Audit } from '../audit/audit.decorator';
import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminSettingsService } from '../services/admin-settings.service';
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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';

@ApiTags('admin')
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  // ─── Commissions ──────────────────────────────────────────────────────────

  @Get('commissions')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all platform & brand commission tiers' })
  async getCommissionTiers() {
    return this.adminSettingsService.getCommissionTiers();
  }

  @Post('commissions')
  @Audit('COMMISSION_TIER_CREATED')
  @Roles('owner', 'super_admin', 'finance_admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a custom commission tier for specific brands' })
  async createCommissionTier(@Body() dto: CreateCommissionTierDto) {
    return this.adminSettingsService.createCommissionTier(dto);
  }

  @Patch('commissions/:id')
  @Audit('COMMISSION_TIER_UPDATED')
  @Roles('owner', 'super_admin', 'finance_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update commission tier rate, reason, or assigned brands' })
  async updateCommissionTier(@Param('id') id: string, @Body() dto: UpdateCommissionTierDto) {
    return this.adminSettingsService.updateCommissionTier(id, dto);
  }

  @Delete('commissions/:id')
  @Audit('COMMISSION_TIER_DELETED')
  @Roles('owner', 'super_admin', 'finance_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete custom commission tier' })
  async deleteCommissionTier(@Param('id') id: string) {
    await this.adminSettingsService.deleteCommissionTier(id);
  }

  // ─── Creator Niches ────────────────────────────────────────────────────────

  @Get('niches')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all creator niches' })
  async getNiches() {
    return this.adminSettingsService.getNiches();
  }

  @Post('niches')
  @Audit('NICHE_CREATED')
  @Roles('owner', 'super_admin', 'moderator')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new creator niche' })
  async createNiche(@Body() dto: CreateNicheDto) {
    return this.adminSettingsService.createNiche(dto);
  }

  @Patch('niches/:id')
  @Audit('NICHE_UPDATED')
  @Roles('owner', 'super_admin', 'moderator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rename creator niche' })
  async updateNiche(@Param('id') id: string, @Body() dto: UpdateNicheDto) {
    return this.adminSettingsService.updateNiche(id, dto);
  }

  @Delete('niches/:id')
  @Audit('NICHE_DELETED')
  @Roles('owner', 'super_admin', 'moderator')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete creator niche' })
  async deleteNiche(@Param('id') id: string) {
    await this.adminSettingsService.deleteNiche(id);
  }

  // ─── Brand Industries ──────────────────────────────────────────────────────

  @Get('brand-industries')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all brand industries' })
  async getIndustries() {
    return this.adminSettingsService.getIndustries();
  }

  @Post('brand-industries')
  @Audit('BRAND_INDUSTRY_CREATED')
  @Roles('owner', 'super_admin', 'moderator')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new brand industry' })
  async createIndustry(@Body() dto: CreateIndustryDto) {
    return this.adminSettingsService.createIndustry(dto);
  }

  @Patch('brand-industries/:id')
  @Audit('BRAND_INDUSTRY_UPDATED')
  @Roles('owner', 'super_admin', 'moderator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rename brand industry' })
  async updateIndustry(@Param('id') id: string, @Body() dto: UpdateIndustryDto) {
    return this.adminSettingsService.updateIndustry(id, dto);
  }

  @Delete('brand-industries/:id')
  @Audit('BRAND_INDUSTRY_DELETED')
  @Roles('owner', 'super_admin', 'moderator')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete brand industry' })
  async deleteIndustry(@Param('id') id: string) {
    await this.adminSettingsService.deleteIndustry(id);
  }

  // ─── FAQ Management ────────────────────────────────────────────────────────

  @Get('faqs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get FAQs with category/status filtering' })
  async getFaqs(@Query() query: QueryFaqsDto) {
    return this.adminSettingsService.getFaqs(query);
  }

  @Post('faqs')
  @Audit('FAQ_CREATED')
  @Roles('owner', 'super_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new FAQ' })
  async createFaq(@Body() dto: CreateFaqDto) {
    return this.adminSettingsService.createFaq(dto);
  }

  @Patch('faqs/:id')
  @Audit('FAQ_UPDATED')
  @Roles('owner', 'super_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update FAQ question, answer, category, or status' })
  async updateFaq(@Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.adminSettingsService.updateFaq(id, dto);
  }

  @Delete('faqs/:id')
  @Audit('FAQ_DELETED')
  @Roles('owner', 'super_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete FAQ' })
  async deleteFaq(@Param('id') id: string) {
    await this.adminSettingsService.deleteFaq(id);
  }

  // ─── News Categories ───────────────────────────────────────────────────────

  @Get('news-categories')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all news categories' })
  async getNewsCategories() {
    return this.adminSettingsService.getNewsCategories();
  }

  @Post('news-categories')
  @Audit('NEWS_CATEGORY_CREATED')
  @Roles('owner', 'super_admin', 'moderator')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new news category' })
  async createNewsCategory(@Body() dto: CreateNewsCategoryDto) {
    return this.adminSettingsService.createNewsCategory(dto);
  }

  @Patch('news-categories/:id')
  @Audit('NEWS_CATEGORY_UPDATED')
  @Roles('owner', 'super_admin', 'moderator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rename news category' })
  async updateNewsCategory(@Param('id') id: string, @Body() dto: UpdateNewsCategoryDto) {
    return this.adminSettingsService.updateNewsCategory(id, dto);
  }

  @Delete('news-categories/:id')
  @Audit('NEWS_CATEGORY_DELETED')
  @Roles('owner', 'super_admin', 'moderator')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete news category' })
  async deleteNewsCategory(@Param('id') id: string) {
    await this.adminSettingsService.deleteNewsCategory(id);
  }

  // ─── Contact Info ──────────────────────────────────────────────────────────

  @Get('contact-info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get platform business contact information' })
  async getContactInfo() {
    return this.adminSettingsService.getContactInfo();
  }

  @Put('contact-info')
  @Audit('CONTACT_INFO_UPDATED')
  @Roles('owner', 'super_admin', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update platform business contact information' })
  async updateContactInfo(@Body() dto: UpdateContactInfoDto) {
    return this.adminSettingsService.updateContactInfo(dto);
  }

  // ─── External Links ────────────────────────────────────────────────────────

  @Get('external-links')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get platform external social media links' })
  async getExternalLinks() {
    return this.adminSettingsService.getExternalLinks();
  }

  @Put('external-links')
  @Audit('EXTERNAL_LINKS_UPDATED')
  @Roles('owner', 'super_admin', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update platform external social media links' })
  async updateExternalLinks(@Body() dto: UpdateExternalLinksDto) {
    return this.adminSettingsService.updateExternalLinks(dto);
  }

  // ─── Change Password ───────────────────────────────────────────────────────

  @Post('change-password')
  @Audit('ADMIN_PASSWORD_CHANGED')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update logged in user password' })
  async changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.adminSettingsService.changePassword(user.id, dto);
  }
}
