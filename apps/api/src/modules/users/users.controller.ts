import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  OnboardMemberDto,
  OnboardMemberSchema,
  RequestAuthContext,
  UpdateOwnProfileDto,
  UpdateOwnProfileSchema,
  UserRole,
} from '@vintage/shared';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.FRONT_DESK)
  @Get()
  listUsers(
    @CurrentUser() user: RequestAuthContext,
    @Query('role') role?: string,
    @Query('search') search?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.usersService.listUsers(user, { role, search, branchId });
  }

  @Patch('me')
  updateOwnProfile(
    @CurrentUser() user: RequestAuthContext,
    @Body(new ZodValidationPipe(UpdateOwnProfileSchema))
    dto: UpdateOwnProfileDto,
  ) {
    return this.usersService.updateOwnProfile(user, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.FRONT_DESK)
  @Post('onboard')
  onboardMember(
    @CurrentUser() user: RequestAuthContext,
    @Body(new ZodValidationPipe(OnboardMemberSchema)) dto: OnboardMemberDto,
  ) {
    return this.usersService.onboardMember(user, dto);
  }

  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.FRONT_DESK,
    UserRole.MEMBER,
  )
  @Get(':id/quick-profile')
  getQuickProfile(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
  ) {
    return this.usersService.getQuickProfile(user, id);
  }

  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.FRONT_DESK,
    UserRole.MEMBER,
  )
  @Post(':id/kyc')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024 },
    }),
  )
  uploadKyc(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('KYC image file is required');
    }
    return this.usersService.uploadKyc(user, id, file.buffer);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.FRONT_DESK)
  @Get(':id/kyc')
  async viewKyc(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.usersService.viewKyc(user, id);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(buffer);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.MEMBER)
  @Delete(':id/anonymize')
  anonymizeUser(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
  ) {
    return this.usersService.anonymizeUser(user, id);
  }

  @Get(':id')
  getUserById(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
  ) {
    return this.usersService.getUserById(user, id);
  }
}
