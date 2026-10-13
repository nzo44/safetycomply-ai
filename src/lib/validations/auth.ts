import { z } from 'zod';
import { blankToUndefined } from './helpers';

const email = z
  .string({ required_error: 'Enter your email address' })
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254);

const next = z.preprocess(blankToUndefined, z.string().max(500).optional());

export const signInSchema = z.object({
  email,
  password: z.string({ required_error: 'Enter your password' }).min(1, 'Enter your password').max(200),
  next,
});

export const magicLinkSchema = z.object({ email, next });
