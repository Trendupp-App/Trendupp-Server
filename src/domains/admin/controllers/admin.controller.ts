import {
  Controller,
  Patch,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Post,
  Delete,
  Body,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';
import { CampaignsService } from '../../campaigns/services/campaigns.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CreateFeeDto } from '../../campaigns/dtos/create-fee.dto';
import { NewsService } from '../../news/services/news.service';
import { CreateNewsDto } from '../../news/dtos/create-news.dto';
import { UpdateNewsDto } from '../../news/dtos/update-news.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly newsService: NewsService,
  ) {}

  @Patch('campaigns/:id/approve')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @Roles('owner', 'admin', 'super_admin', 'superadmin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a pending campaign (admin / super_admin only)',
  })
  @ApiResponse({ status: 200, description: 'Campaign approved and now live' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async approveCampaign(@Param('id') id: string) {
    const campaign = await this.campaignsService.approve(id);
    return {
      message: 'Campaign approved successfully.',
      campaign,
    };
  }

  @Get('fees')
  @ApiOperation({ summary: 'Get all active fees/charges' })
  @ApiResponse({ status: 200, description: 'List of fees retrieved' })
  async getFees() {
    const fees = await this.campaignsService.getFees();
    return { fees };
  }

  @Post('fees')
  @Roles('owner', 'admin', 'super_admin', 'superadmin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new fee configuration (admin only)' })
  @ApiResponse({ status: 201, description: 'Fee created successfully' })
  async createFee(@Body() dto: CreateFeeDto) {
    const fee = await this.campaignsService.createFee(dto);
    return {
      message: 'Fee configuration created successfully.',
      fee,
    };
  }

  @Delete('fees/:id')
  @Roles('owner', 'admin', 'super_admin', 'superadmin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a fee configuration permanently (admin only)' })
  @ApiResponse({ status: 200, description: 'Fee configuration deleted successfully' })
  @ApiResponse({ status: 404, description: 'Fee configuration not found' })
  async deleteFee(@Param('id') id: string) {
    await this.campaignsService.deleteFee(id);
    return {
      message: 'Fee configuration deleted permanently.',
    };
  }

  @Post('news')
  @Roles('owner', 'admin', 'super_admin', 'superadmin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a news article (admin only)' })
  @ApiResponse({ status: 201, description: 'News article created successfully' })
  @UseInterceptors(FileInterceptor('coverImage'))
  @ApiConsumes('multipart/form-data')
  async createNews(
    @Body() dto: CreateNewsDto,
    @Request() req: { user: { id: string } },
    @UploadedFile() coverImage?: Express.Multer.File,
  ) {
    const news = await this.newsService.create(req.user.id, dto, coverImage);
    return {
      message: 'News article created successfully.',
      news,
    };
  }

  @Patch('news/:id')
  @Roles('owner', 'admin', 'super_admin', 'superadmin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a news article (admin only)' })
  @ApiResponse({ status: 200, description: 'News article updated successfully' })
  @UseInterceptors(FileInterceptor('coverImage'))
  @ApiConsumes('multipart/form-data')
  async updateNews(
    @Param('id') id: string,
    @Body() dto: UpdateNewsDto,
    @UploadedFile() coverImage?: Express.Multer.File,
  ) {
    const news = await this.newsService.update(id, dto, coverImage);
    return {
      message: 'News article updated successfully.',
      news,
    };
  }

  @Delete('news/:id')
  @Roles('owner', 'admin', 'super_admin', 'superadmin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a news article (admin only)' })
  @ApiResponse({ status: 200, description: 'News article deleted successfully' })
  async deleteNews(@Param('id') id: string) {
    await this.newsService.delete(id);
    return {
      message: 'News article deleted successfully.',
    };
  }
}
