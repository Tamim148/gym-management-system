import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { RequestAuthContext, UserRole } from '@vintage/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Public, Roles } from '../auth/auth.decorators';
import { BranchesService } from './branches.service';

const UpdateEdgeStatusSchema = z.object({
  edgeNodeOnline: z.boolean(),
});

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Public()
  @Get()
  listBranches() {
    return this.branchesService.listBranches();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.FRONT_DESK)
  @Patch(':id/edge-status')
  setEdgeStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateEdgeStatusSchema))
    body: { edgeNodeOnline: boolean },
    @CurrentUser() user: RequestAuthContext,
  ) {
    return this.branchesService.setEdgeStatus(id, body.edgeNodeOnline, user);
  }
}
