'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { failure, fieldError, invalid, type ActionResult } from '@/lib/action-result';
import { logActivity } from '@/lib/activity';
import { computeProjectedFillDate } from '@/lib/waste/projection';
import { updateCapacitySchema } from '@/lib/validations/waste';

/**
 * Sets up or reconciles the site's landfill record (e.g. after a topographic survey).
 * Day-to-day volume comes from processDischarge. Changing an existing volume needs a reason,
 * and before/after values are written to the activity log.
 */
export async function updateLandfillCapacity(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = updateCapacitySchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;
    const { user, siteId } = await authorize('waste:capacity', d.siteId);

    const total = new Prisma.Decimal(d.totalCapacityTons.toFixed(3));
    const current = new Prisma.Decimal(d.currentVolumeTons.toFixed(3));

    const existing = await prisma.landfillCapacity.findUnique({ where: { siteId } });
    if (existing && !existing.currentVolumeTons.equals(current) && !d.reason) {
      return fieldError('reason', 'Explain why the volume is being adjusted, for example a survey result');
    }

    const saved = await prisma.$transaction(async (tx) => {
      const row = await tx.landfillCapacity.upsert({
        where: { siteId },
        create: { siteId, totalCapacityTons: total, currentVolumeTons: current },
        update: { totalCapacityTons: total, currentVolumeTons: current, lastSurveyedAt: new Date() },
      });
      const projected = await computeProjectedFillDate(tx, siteId, row.totalCapacityTons, row.currentVolumeTons);
      await tx.landfillCapacity.update({ where: { siteId }, data: { projectedFillDate: projected } });

      await logActivity(tx, {
        siteId, actorId: user.id, entityType: 'LANDFILL', entityId: row.id,
        action: existing ? 'landfill.capacity_updated' : 'landfill.capacity_created',
        metadata: {
          before: existing
            ? { totalTons: existing.totalCapacityTons.toString(), currentTons: existing.currentVolumeTons.toString() }
            : null,
          after: { totalTons: total.toString(), currentTons: current.toString() },
          reason: d.reason ?? null,
        },
      });
      return row;
    });

    revalidatePath('/waste');
    const over = saved.currentVolumeTons.greaterThan(saved.totalCapacityTons);
    return {
      ok: true,
      message: over
        ? 'Landfill record saved. The recorded volume exceeds the total capacity.'
        : existing ? 'Landfill record updated.' : 'Landfill capacity set up.',
    };
  } catch (e) {
    return failure(e);
  }
}
