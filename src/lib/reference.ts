import type { Prisma } from '@prisma/client';

export type ReferenceKind = 'INC' | 'CAPA' | 'RA' | 'WM' | 'INS' | 'NCR';

/** Atomic: the upsert's increment is a single SQL statement, so concurrent callers can't collide. */
export async function nextReference(tx: Prisma.TransactionClient, kind: ReferenceKind) {
  const key = `${kind}-${new Date().getUTCFullYear()}`;
  const { value } = await tx.referenceCounter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${key}-${String(value).padStart(4, '0')}`;
}

export const nextCapaReference = (tx: Prisma.TransactionClient) => nextReference(tx, 'CAPA');
