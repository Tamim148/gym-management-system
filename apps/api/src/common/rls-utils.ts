import { PrismaClient } from '@prisma/client';
import { RequestAuthContext, UserRole } from '@vintage/shared';
import { withRlsContext } from '../prisma/rls.helper';

export const SYSTEM_RLS_CONTEXT: RequestAuthContext = {
  userId: '00000000-0000-0000-0000-000000000000',
  role: UserRole.SUPER_ADMIN,
  branchId: '00000000-0000-0000-0000-000000000000',
};

export function withSystemRls<T>(
  prisma: PrismaClient,
  work: (tx: PrismaClient) => Promise<T>,
  branchId?: string,
): Promise<T> {
  return withRlsContext(
    prisma,
    branchId ? { ...SYSTEM_RLS_CONTEXT, branchId } : SYSTEM_RLS_CONTEXT,
    work,
  );
}

/**
 * Always executes inside `prisma.$transaction(...)` (serializing concurrent
 * operations in both PostgreSQL and InMemoryPrismaMock) and sets transaction-local
 * RLS config when connected to PostgreSQL.
 */
export function withTxRls<T>(
  prisma: PrismaClient,
  work: (tx: PrismaClient) => Promise<T>,
  ctx: RequestAuthContext = SYSTEM_RLS_CONTEXT,
): Promise<T> {
  const isPostgres = process.env.DATABASE_URL?.startsWith('postgres');
  return prisma.$transaction(async (tx) => {
    if (isPostgres) {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_role', ${ctx.role}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_branch_id', ${ctx.branchId}, true)`;
    }
    return work(tx as unknown as PrismaClient);
  });
}
