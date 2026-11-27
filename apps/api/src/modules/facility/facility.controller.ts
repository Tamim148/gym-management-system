import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CreateEquipmentTicketDto,
  CreateEquipmentTicketSchema,
  LockerTapDto,
  LockerTapSchema,
  RequestAuthContext,
  UpdateTicketStatusDto,
  UpdateTicketStatusSchema,
  UserRole,
} from '@vintage/shared';
import { memoryStorage } from 'multer';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { FacilityService } from './facility.service';

@Controller('facility')
export class FacilityController {
  constructor(private readonly facilityService: FacilityService) {}

  @Get('lockers')
  listLockers(
    @CurrentUser() user: RequestAuthContext,
    @Query('branchId') branchId?: string,
  ) {
    return this.facilityService.listLockers(user, branchId);
  }

  @Post('lockers/:id/tap')
  tapLocker(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(LockerTapSchema)) dto: LockerTapDto,
  ) {
    return this.facilityService.tapLocker(user, id, dto);
  }

  @Get('equipment')
  listEquipment(@Query('branchId') branchId?: string) {
    return this.facilityService.listEquipment(branchId);
  }

  @Get('equipment/qr/:token')
  getEquipmentByQr(@Param('token') token: string) {
    return this.facilityService.getEquipmentByQr(token);
  }

  @Get('tickets')
  listTickets(
    @CurrentUser() user: RequestAuthContext,
    @Query('branchId') branchId?: string,
  ) {
    return this.facilityService.listTickets(user, branchId);
  }

  @Post('tickets')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  createTicket(
    @CurrentUser() user: RequestAuthContext,
    @Body(new ZodValidationPipe(CreateEquipmentTicketSchema))
    dto: CreateEquipmentTicketDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.facilityService.createTicket(user, dto, file?.buffer);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.FRONT_DESK)
  @Patch('tickets/:id')
  updateTicketStatus(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTicketStatusSchema))
    dto: UpdateTicketStatusDto,
  ) {
    return this.facilityService.updateTicketStatus(user, id, dto);
  }
}
