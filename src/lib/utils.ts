export const DAY_MS = 86_400_000;

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

export const startOfTodayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

/** For dates stored as UTC midnight (due dates, scheduled dates). */
export const fmtDate = (d: Date | null | undefined) =>
  d
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d)
    : '—';

/** For <input type="date" defaultValue>. */
export const toDateInput = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');

export const todayInput = () => new Date().toISOString().slice(0, 10);

export const fmtDateTime = (d: Date | null | undefined, timeZone: string) =>
  d
    ? new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone,
      }).format(d)
    : '—';

/** For <input type="datetime-local">: wall-clock time in the site's timezone. */
export const toZonedLocalInput = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(d).replace(' ', 'T');

/** Day-precision date in the site's timezone (for instants, unlike `fmtDate`, which is for UTC-midnight dates). */
export const fmtDayInZone = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone }).format(d);

export const fmtKg = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 3 });
export const fmtTons = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 1 });

function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const v = Object.fromEntries(parts.map((p) => [p.type, Number(p.value)]));
  return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - at.getTime();
}

/**
 * Interprets a `datetime-local` string ("2026-10-08T14:30") as wall-clock time in the
 * site's timezone and returns the UTC instant. Returns null for malformed or impossible dates.
 */
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  if (new Date(naive).getUTCMonth() !== mo - 1) return null; // e.g. 30 Feb
  let ts = naive - tzOffsetMs(new Date(naive), timeZone);
  ts = naive - tzOffsetMs(new Date(ts), timeZone);           // second pass handles DST edges
  return new Date(ts);
}
