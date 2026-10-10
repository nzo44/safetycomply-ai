import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runCapaEscalationSweep } from '@/lib/incidents/escalation';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret ?? ''}`;
  const authorized =
    Boolean(secret) && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));

  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await runCapaEscalationSweep());
}
