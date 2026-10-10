import { z } from 'zod';
import { DAY_MS, startOfTodayUtc } from '@/lib/utils';

export const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
export const optText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());
export const optDate = z.preprocess(blankToUndefined, z.coerce.date().optional());
export const optId = z.preprocess(blankToUndefined, z.string().trim().min(1).max(40).optional());
export const id = (msg = 'Missing record') => z.string({ required_error: msg }).trim().min(1, msg).max(40);
export const uuid = (msg: string) => z.string({ required_error: msg }).uuid(msg);
export const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());
export const count = (max: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int('Enter a whole number').min(0, 'Enter 0 or more').max(max).default(0));

/** JSON posted by a client form; blank means "not provided". */
export const jsonField = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => {
    if (typeof v !== 'string' || v.trim() === '') return undefined;
    try { return JSON.parse(v); } catch { return null; }
  }, schema);

/** Newline-separated list -> string[] */
export const lineList = (maxItems: number, maxLen: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : v),
    z.array(z.string().max(maxLen)).max(maxItems, `Use ${maxItems} items or fewer`).default([]),
  );

/** A future-or-today due date, at most 2 years out. */
export const dueDateField = z.coerce
  .date({ errorMap: () => ({ message: 'Enter a due date' }) })
  .refine((d) => d.getTime() >= startOfTodayUtc().getTime(), 'The due date cannot be in the past')
  .refine((d) => d.getTime() <= startOfTodayUtc().getTime() + 730 * DAY_MS, 'The due date must be within 2 years');

/** Newline-separated http(s) links. `z.string().url()` would accept `javascript:`, so we check the scheme. */
export const httpUrlList = (max = 10) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : v),
    z
      .array(
        z.string().max(2000).refine((u) => /^https?:\/\/\S+$/i.test(u), 'Each link must start with http:// or https://'),
      )
      .max(max, `Attach ${max} links or fewer`)
      .default([]),
  );
