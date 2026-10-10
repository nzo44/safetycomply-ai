import { Prisma } from '@prisma/client';
import type { ZodError } from 'zod';
import { ForbiddenError } from '@/lib/auth/rbac';

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export type FormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/** A rule violation the user can act on (stale state, unmet precondition). */
export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export const invalid = (err: ZodError): ActionResult => ({
  ok: false,
  error: 'Fix the highlighted fields.',
  fieldErrors: err.flatten().fieldErrors,
});

export const fieldError = (field: string, message: string): ActionResult => ({
  ok: false,
  error: 'Fix the highlighted fields.',
  fieldErrors: { [field]: [message] },
});

export function failure(e: unknown): ActionResult {
  if (e instanceof ForbiddenError || e instanceof WorkflowError) return { ok: false, error: e.message };
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return { ok: false, error: 'Another record was created at the same moment. Try again.' };
  }
  console.error(e);
  return { ok: false, error: 'Something went wrong. Try again, and contact support if it continues.' };
}
