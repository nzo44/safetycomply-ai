import type { Role } from '@prisma/client';

export type Permission =
  | 'compliance:read' | 'requirement:write' | 'audit:write'
  | 'incident:read' | 'incident:report' | 'incident:manage'
  | 'rca:write' | 'rca:approve'
  | 'capa:work' | 'capa:manage' | 'capa:verify'
  | 'waste:read' | 'waste:log' | 'waste:weigh' | 'waste:capacity'
  | 'risk:read' | 'risk:write' | 'risk:approve'
  | 'inspection:read' | 'inspection:schedule' | 'inspection:execute' | 'checklist:manage';

const ALL: Role[] = ['ADMIN', 'HSE_MANAGER', 'INSPECTOR', 'AUDITOR'];

const MATRIX: Record<Permission, Role[]> = {
  'compliance:read': ALL,
  'requirement:write': ['ADMIN', 'HSE_MANAGER'],
  'audit:write': ['ADMIN', 'HSE_MANAGER', 'AUDITOR'],

  'incident:read': ALL,
  'incident:report': ALL,                                  // anyone on site can report
  'incident:manage': ['ADMIN', 'HSE_MANAGER'],             // start investigation, close, reopen
  'rca:write': ['ADMIN', 'HSE_MANAGER', 'INSPECTOR'],      // investigators
  'rca:approve': ['ADMIN', 'HSE_MANAGER'],
  'capa:work': ALL,                                        // plus assignee-or-manager check in the action
  'capa:manage': ['ADMIN', 'HSE_MANAGER'],                 // create, reassign, extend, cancel, escalate
  'capa:verify': ['ADMIN', 'HSE_MANAGER', 'AUDITOR'],

  'waste:read': ALL,
  'waste:log': ['ADMIN', 'HSE_MANAGER', 'INSPECTOR'],      // create manifests, change status
  'waste:weigh': ['ADMIN', 'HSE_MANAGER', 'INSPECTOR'],    // process weighbridge tickets
  'waste:capacity': ['ADMIN', 'HSE_MANAGER'],              // set total / reconcile volume

  'risk:read': ALL,
  'risk:write': ['ADMIN', 'HSE_MANAGER', 'INSPECTOR'],     // create, edit drafts, submit, revise
  'risk:approve': ['ADMIN', 'HSE_MANAGER'],                // approve, return, archive

  'inspection:read': ALL,
  'inspection:schedule': ['ADMIN', 'HSE_MANAGER'],         // schedule, cancel, close minor NCRs
  'inspection:execute': ['ADMIN', 'HSE_MANAGER', 'INSPECTOR', 'AUDITOR'], // plus assigned-inspector check in code
  'checklist:manage': ['ADMIN', 'HSE_MANAGER'],            // templates are visible org-wide
};

export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to do this.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export const can = (role: Role, permission: Permission) => MATRIX[permission].includes(role);

export const hasSiteAccess = (user: { role: Role; sites: { siteId: string }[] }, siteId: string) =>
  user.role === 'ADMIN' || user.sites.some((s) => s.siteId === siteId);
