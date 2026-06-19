import { Controller, Patch, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';
import { CampaignsService } from '../../campaigns/services/campaigns.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';

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
      message: 'Campaign approved successfully. It is now live.',
      campaign,
    };
  }
}
