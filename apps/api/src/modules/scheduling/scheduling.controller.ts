import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  BookingStatus,
  CreateSessionDto,
  CreateSessionSchema,
  RequestAuthContext,
  UpdateSessionDto,
  UpdateSessionSchema,
  UserRole,
} from '@vintage/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { SchedulingService } from './scheduling.service';

const MarkAttendanceSchema = z.object({
  status: z.enum([BookingStatus.ATTENDED, BookingStatus.NO_SHOW]),
});

@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get('sessions')
  listSessions(
    @Query('branchId') branchId?: string,
    @Query('trainerId') trainerId?: string,
    @Query('includeCancelled') includeCancelled?: string,
  ) {
    return this.schedulingService.listSessions({
      branchId,
      trainerId,
      includeCancelled: includeCancelled === 'true',
    });
  }

  @Get('bookings/me')
  listMyBookings(@CurrentUser() user: RequestAuthContext) {
    return this.schedulingService.listMyBookings(user.userId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.TRAINER)
  @Post('sessions')
  createSession(
    @CurrentUser() user: RequestAuthContext,
    @Body(new ZodValidationPipe(CreateSessionSchema)) dto: CreateSessionDto,
  ) {
    return this.schedulingService.createSession(user, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.TRAINER)
  @Patch('sessions/:id')
  updateSession(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSessionSchema)) dto: UpdateSessionDto,
  ) {
    return this.schedulingService.updateSession(user, id, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.TRAINER)
  @Delete('sessions/:id')
  deleteSession(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.schedulingService.deleteOrCancelSession(user, id, body);
  }

  @Post('sessions/:id/book')
  bookSession(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
  ) {
    return this.schedulingService.bookSession(user, id);
  }

  @Delete('bookings/:id')
  cancelBooking(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
  ) {
    return this.schedulingService.cancelBooking(user, id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.TRAINER)
  @Patch('bookings/:id/attendance')
  markAttendance(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MarkAttendanceSchema))
    body: { status: typeof BookingStatus.ATTENDED | typeof BookingStatus.NO_SHOW },
  ) {
    return this.schedulingService.markAttendance(user, id, body.status);
  }
}
