import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  displayStatus, isPermitStatus, isPermitType, PERMIT_STATUS_LABEL, PERMIT_TYPE_LABEL,
  type PermitStatus, type PermitType,
} from '@/lib/permits/meta';
import type { PermitRow, PermitSummary } from '@/types/permits';
import { one, pick, type SearchParams } from './params';

export const PERMIT_PAGE_SIZES = [10, 20, 50];

export interface PermitParams {
  q?: string;
  type?: PermitType;
  /** A stored status, or EXPIRED (derived). */
  status?: PermitStatus | 'EXPIRED';
  page: number;
  pageSize: number;
}

export function parsePermitParams(sp: SearchParams): PermitParams {
  const page = Math.min(10_000, Math.max(1, parseInt(one(sp, 'page') ?? '1', 10) || 1));
  const size = parseInt(one(sp, 'pageSize') ?? '', 10);
  const type = pick<PermitType>(one(sp, 'type'), PERMIT_TYPE_LABEL);
  const status = pick(one(sp, 'status'), PERMIT_STATUS_LABEL);
  return {
    q: one(sp, 'q')?.trim() || undefined,
    type: type && isPermitType(type) ? type : undefined,
    status: status && (status === 'EXPIRED' || isPermitStatus(status)) ? status : undefined,
    page,
    pageSize: PERMIT_PAGE_SIZES.includes(size) ? size : 20,
  };
}

/** Approved or in-progress permits whose window has ended. Derived, never stored. */
const expiredWhere = (now: Date): Prisma.WorkPermitWhereInput => ({
  status: { in: ['APPROVED', 'IN_PROGRESS'] },
  validTo: { lt: now },
});

export async function getPermits(siteId: string, p: PermitParams) {
  const now = new Date();
  const where: Prisma.WorkPermitWhereInput = {
    siteId,
    ...(p.type && { type: p.type }),
    ...(p.status === 'EXPIRED' ? expiredWhere(now) : p.status ? { status: p.status } : {}),
    ...(p.status === 'APPROVED' || p.status === 'IN_PROGRESS' ? { validTo: { gte: now } } : {}),
    ...(p.q && {
      OR: [
        { permitCode: { contains: p.q, mode: 'insensitive' } },
        { title: { contains: p.q, mode: 'insensitive' } },
        { location: { contains: p.q, mode: 'insensitive' } },
      ],
    }),
  };

  const total = await prisma.workPermit.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / p.pageSize));
  const page = Math.min(p.page, pageCount);

  const rows = await prisma.workPermit.findMany({
    where,
    orderBy: [{ validFrom: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * p.pageSize,
    take: p.pageSize,
    include: {
      requestedBy: { select: { fullName: true } },
      approvedBy: { select: { fullName: true } },
    },
  });

  const mapped: PermitRow[] = rows.map((r) => {
    const status = r.status as PermitStatus;
    return {
      id: r.id, permitCode: r.permitCode, type: r.type as PermitType, status,
      displayStatus: displayStatus({ status, validFrom: r.validFrom, validTo: r.validTo }, now),
      title: r.title, location: r.location, description: r.description, hazards: r.hazards,
      precautions: r.precautions, workers: r.workers, validFrom: r.validFrom, validTo: r.validTo,
      requestedByName: r.requestedBy.fullName, requestedById: r.requestedById,
      approvedByName: r.approvedBy?.fullName ?? null,
      statusNote: r.statusNote, closeoutNotes: r.closeoutNotes,
    };
  });

  return { rows: mapped, total, page, pageCount, pageSize: p.pageSize };
}

export async function getPermitSummary(siteId: string): Promise<PermitSummary> {
  const now = new Date();
  const [awaiting, active, expired] = await Promise.all([
    prisma.workPermit.count({ where: { siteId, status: 'REQUESTED' } }),
    prisma.workPermit.count({ where: { siteId, status: 'IN_PROGRESS', validTo: { gte: now } } }),
    prisma.workPermit.count({ where: { siteId, ...expiredWhere(now) } }),
  ]);
  return { awaiting, active, expired };
}
