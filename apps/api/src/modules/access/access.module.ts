import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { HARDWARE_ADAPTER, VirtualHardwareAdapter } from './hardware.adapter';

@Module({
  controllers: [AccessController],
  providers: [
    AccessService,
    VirtualHardwareAdapter,
    {
      provide: HARDWARE_ADAPTER,
      useExisting: VirtualHardwareAdapter,
    },
  ],
  exports: [AccessService, HARDWARE_ADAPTER],
})
export class AccessModule {}
