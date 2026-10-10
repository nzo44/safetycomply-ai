import type { ActivityEntity, Prisma } from '@prisma/client';

export interface ActivityInput {
  siteId: string;
  actorId: string | null; // null = system
  entityType: ActivityEntity;
  entityId: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
}

/** Always call inside the same transaction as the change it records. */
export const logActivity = (tx: Prisma.TransactionClient, e: ActivityInput) =>
  tx.activityLog.create({
    data: {
      siteId: e.siteId, actorId: e.actorId, entityType: e.entityType,
      entityId: e.entityId, action: e.action, metadata: e.metadata,
    },
  });

const same = (a: unknown, b: unknown) =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime()
  : Array.isArray(a) && Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b)
  : (a ?? null) === (b ?? null);

export const changedKeys = (before: Record<string, unknown>, after: Record<string, unknown>) =>
  Object.keys(after).filter((k) => !same(before[k], after[k]));
