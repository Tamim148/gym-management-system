import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  FreePassLeadDto,
  FreePassLeadResponse,
  FreePassLeadSchema,
} from '@vintage/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Public } from '../auth/auth.decorators';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Public()
  @Post('free-pass')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  reserveFreePass(
    @Body(new ZodValidationPipe(FreePassLeadSchema.strict()))
    dto: FreePassLeadDto,
  ): Promise<FreePassLeadResponse> {
    return this.leadsService.reserveFreePass(dto);
  }
}
