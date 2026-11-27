import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestAuthContext, UserRole } from '@vintage/shared';
import { Request } from 'express';

@Injectable()
export class BranchScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestAuthContext }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Missing authentication context');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    const targetBranchId =
      (request.params?.branchId as string | undefined) ||
      (typeof request.body?.branchId === 'string'
        ? request.body.branchId
        : undefined) ||
      (typeof request.query?.branchId === 'string'
        ? request.query.branchId
        : undefined);

    if (targetBranchId && targetBranchId !== user.branchId) {
      throw new ForbiddenException('Cross-branch operation forbidden');
    }

    return true;
  }
}
