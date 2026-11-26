import { PrismaClient } from '@prisma/client';
import { RequestAuthContext } from '@vintage/shared';

/**
 * Executes database queries with transaction-local PostgreSQL RLS variables.
 * Safe for Neon pooled connections because SET LOCAL resets at transaction end.
 */
export async function withRlsContext<T>(
  prisma: PrismaClient,
  ctx: RequestAuthContext,
  work: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  const isPostgres = process.env.DATABASE_URL?.startsWith('postgres');

  if (!isPostgres) {
    return work(prisma);
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_role', ${ctx.role}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_branch_id', ${ctx.branchId}, true)`;
    return work(tx as unknown as PrismaClient);
  });
}
