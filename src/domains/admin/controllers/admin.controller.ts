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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';
import { CampaignsService } from '../../campaigns/services/campaigns.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CreateFeeDto } from '../../campaigns/dtos/create-fee.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Patch('campaigns/:id/approve')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @Roles('admin', 'super_admin')
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
  @Roles('admin', 'super_admin')
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
  @Roles('admin', 'super_admin')
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
}
