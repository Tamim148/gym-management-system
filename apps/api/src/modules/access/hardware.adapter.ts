import { Injectable, Logger } from '@nestjs/common';

export const HARDWARE_ADAPTER = Symbol('HARDWARE_ADAPTER');

export interface HardwareAdapter {
  openGate(branchId: string, reason: string): Promise<void>;
  triggerDeniedAlarm(branchId: string, reason: string): Promise<void>;
  unlockLocker(hardwareRelayId: string): Promise<void>;
}

@Injectable()
export class VirtualHardwareAdapter implements HardwareAdapter {
  private readonly logger = new Logger(VirtualHardwareAdapter.name);

  async openGate(branchId: string, reason: string): Promise<void> {
    this.logger.debug(`[VIRTUAL GATE OPEN] branch=${branchId} reason=${reason}`);
  }

  async triggerDeniedAlarm(branchId: string, reason: string): Promise<void> {
    this.logger.debug(
      `[VIRTUAL GATE ALARM] branch=${branchId} reason=${reason}`,
    );
  }

  async unlockLocker(hardwareRelayId: string): Promise<void> {
    this.logger.debug(`[VIRTUAL LOCKER UNLOCK] relay=${hardwareRelayId}`);
  }
}
