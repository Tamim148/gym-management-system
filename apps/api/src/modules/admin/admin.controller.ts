import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  RequestAuthContext,
  UpdateFeatureFlagDto,
  UpdateFeatureFlagSchema,
  UserRole,
} from '@vintage/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @Get('kpis')
  getKpis(@CurrentUser() user: RequestAuthContext) {
    return this.adminService.getKpis(user);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @Get('churn-radar')
  getChurnRadar(@CurrentUser() user: RequestAuthContext) {
    return this.adminService.getChurnRadar(user);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @Post('churn-radar/:userId/nudge')
  sendChurnNudge(
    @CurrentUser() user: RequestAuthContext,
    @Param('userId') userId: string,
  ) {
    return this.adminService.sendChurnNudge(user, userId);
  }

  @Get('feature-flags')
  listFeatureFlags() {
    return this.adminService.listFeatureFlags();
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch('feature-flags/:key')
  updateFeatureFlag(
    @CurrentUser() user: RequestAuthContext,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(UpdateFeatureFlagSchema))
    dto: UpdateFeatureFlagDto,
  ) {
    return this.adminService.updateFeatureFlag(user, key, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @Get('audit-logs')
  listAuditLogs(@CurrentUser() user: RequestAuthContext) {
    return this.adminService.listAuditLogs(user);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @Get('exports/transactions.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="transactions.csv"')
  @Header('X-Content-Type-Options', 'nosniff')
  exportTransactionsCsv(@CurrentUser() user: RequestAuthContext) {
    return this.adminService.exportTransactionsCsv(user);
  }
}
