import { z } from 'zod';
import { UserRole } from './enums';

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  service: z.string(),
  database: z.enum(['connected', 'disconnected']),
  latencyMs: z.number().nonnegative().optional(),
  environment: z.string(),
  timestamp: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export interface RequestAuthContext {
  userId: string;
  role: UserRole;
  branchId: string;
}

export const AccessVerifySchema = z.object({
  branchId: z.string().uuid(),
  cardUid: z.string().trim().min(1).optional(),
  qrToken: z.string().trim().min(1).optional(),
  syncedFromEdge: z.boolean().optional().default(false),
  clientEventId: z.string().uuid().optional(),
  scannedAt: z.string().datetime().optional(),
});

export type AccessVerifyDto = z.infer<typeof AccessVerifySchema>;

export const ManualOverrideSchema = z.object({
  userId: z.string().uuid(),
  branchId: z.string().uuid(),
  reason: z.enum([
    'Promised to pay tomorrow',
    'Card reader glitch',
    'Admin approved',
  ]),
  notes: z.string().trim().min(10, 'Override justification note must be at least 10 characters'),
});

export type ManualOverrideDto = z.infer<typeof ManualOverrideSchema>;
