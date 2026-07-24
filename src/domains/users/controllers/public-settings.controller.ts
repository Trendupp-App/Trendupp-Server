import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminSettingsService } from '../../admin/services/admin-settings.service';
import { QueryFaqsDto } from '../../admin/dtos/admin-settings.dto';

@ApiTags('settings')
@Controller()
export class PublicSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get('faqs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get published FAQs (optionally filter by category or search term)' })
  @ApiResponse({ status: 200, description: 'FAQs retrieved successfully' })
  async getPublicFaqs(@Query() query: QueryFaqsDto) {
    return this.adminSettingsService.getFaqs({ ...query, status: 'published' });
  }

  @Get('settings/contact-info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get platform contact information' })
  @ApiResponse({ status: 200, description: 'Contact information retrieved successfully' })
  async getContactInfo() {
    return this.adminSettingsService.getContactInfo();
  }

  @Get('settings/external-links')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get platform external social media links' })
  @ApiResponse({ status: 200, description: 'External links retrieved successfully' })
  async getExternalLinks() {
    return this.adminSettingsService.getExternalLinks();
  }
}
