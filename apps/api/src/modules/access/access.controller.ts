import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AccessVerifyDto,
  AccessVerifySchema,
  ManualOverrideDto,
  ManualOverrideSchema,
  OfflineSyncBatchDto,
  OfflineSyncBatchSchema,
  ReplaceCardDto,
  ReplaceCardSchema,
  RequestAuthContext,
  UserRole,
} from '@vintage/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { BranchScopeGuard } from '../auth/branch-scope.guard';
import { AccessService } from './access.service';

@Controller('access')
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verifyAccess(
    @Body(new ZodValidationPipe(AccessVerifySchema)) dto: AccessVerifyDto,
  ) {
    return this.accessService.verifyAccess(dto);
  }

  @Get('qr-pass')
  getQrPass(@CurrentUser() user: RequestAuthContext) {
    return this.accessService.getQrPass(user.userId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.FRONT_DESK)
  @UseGuards(BranchScopeGuard)
  @Post('override')
  manualOverride(
    @CurrentUser() user: RequestAuthContext,
    @Body(new ZodValidationPipe(ManualOverrideSchema)) dto: ManualOverrideDto,
  ) {
    return this.accessService.manualOverride(user, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.FRONT_DESK)
  @Post('cards/replace')
  replaceCard(
    @CurrentUser() user: RequestAuthContext,
    @Body(new ZodValidationPipe(ReplaceCardSchema)) dto: ReplaceCardDto,
  ) {
    return this.accessService.replaceCard(user, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.FRONT_DESK)
  @UseGuards(BranchScopeGuard)
  @Post('offline-sync')
  @HttpCode(HttpStatus.OK)
  offlineSync(
    @CurrentUser() user: RequestAuthContext,
    @Body(new ZodValidationPipe(OfflineSyncBatchSchema))
    dto: OfflineSyncBatchDto,
  ) {
    return this.accessService.offlineSync(user, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.FRONT_DESK)
  @Get('logs')
  getRecentLogs(
    @CurrentUser() user: RequestAuthContext,
    @Query('branchId') branchId?: string,
  ) {
    return this.accessService.getRecentLogs(user, branchId);
  }
}
