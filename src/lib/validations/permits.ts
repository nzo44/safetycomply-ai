import { z } from 'zod';
import { PERMIT_STATUSES, PERMIT_TYPES } from '@/lib/permits/meta';
import { id, optText } from './helpers';

const localDateTime = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, msg);
const text = (label: string, min: number, max: number) =>
  z.string({ required_error: `Enter the ${label}` }).trim().min(min, `Enter the ${label} (at least ${min} characters)`).max(max);

export const requestPermitSchema = z.object({
  siteId: id('Missing site'),
  type: z.enum(PERMIT_TYPES, { errorMap: () => ({ message: 'Choose a permit type' }) }),
  title: text('job title', 3, 150),
  location: text('location', 2, 200),
  description: text('work description', 5, 2000),
  hazards: text('hazards', 3, 2000),
  precautions: text('precautions', 3, 2000),
  workers: optText(1000),
  validFrom: localDateTime('Enter when the permit starts'),
  validTo: localDateTime('Enter when the permit ends'),
});

export const permitStatusSchema = z.object({
  permitId: id('Missing permit'),
  toStatus: z.enum(PERMIT_STATUSES),
  note: optText(1000),
});
