import type { Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { can, hasSiteAccess, type Permission } from '@/lib/auth/rbac';
import { CAPA_TRANSITIONS } from '@/lib/incidents/workflow';

const ROLES: Role[] = ['ADMIN', 'HSE_MANAGER', 'INSPECTOR', 'AUDITOR'];
const PERMISSIONS: Permission[] = [
  'compliance:read', 'requirement:write', 'audit:write', 'incident:read', 'incident:report', 'incident:manage',
  'rca:write', 'rca:approve', 'capa:work', 'capa:manage', 'capa:verify', 'waste:read', 'waste:log', 'waste:weigh',
  'waste:capacity', 'risk:read', 'risk:write', 'risk:approve', 'inspection:read', 'inspection:schedule',
  'inspection:execute', 'checklist:manage',
];

describe('role permissions', () => {
  it('lets ADMIN do everything', () => {
    for (const p of PERMISSIONS) expect(can('ADMIN', p), p).toBe(true);
  });
  it('lets every role read every register', () => {
    for (const r of ROLES) for (const p of ['compliance:read', 'incident:read', 'waste:read', 'risk:read', 'inspection:read'] as const) {
      expect(can(r, p), `${r} ${p}`).toBe(true);
    }
  });
  it('keeps approvals with managers', () => {
    for (const p of ['rca:approve', 'risk:approve', 'capa:manage', 'incident:manage', 'checklist:manage', 'waste:capacity'] as const) {
      expect(can('HSE_MANAGER', p), p).toBe(true);
      expect(can('INSPECTOR', p), p).toBe(false);
      expect(can('AUDITOR', p), p).toBe(false);
    }
  });
  it('stops inspectors editing the legal register or verifying actions', () => {
    expect(can('INSPECTOR', 'requirement:write')).toBe(false);
    expect(can('INSPECTOR', 'capa:verify')).toBe(false);
    expect(can('INSPECTOR', 'audit:write')).toBe(false);
  });
  it('lets auditors audit and verify but not log waste or write risk assessments', () => {
    expect(can('AUDITOR', 'audit:write')).toBe(true);
    expect(can('AUDITOR', 'capa:verify')).toBe(true);
    expect(can('AUDITOR', 'inspection:execute')).toBe(true);
    expect(can('AUDITOR', 'waste:log')).toBe(false);
    expect(can('AUDITOR', 'risk:write')).toBe(false);
  });
});

describe('site access', () => {
  const sites = [{ siteId: 'a' }];
  it('lets ADMIN into every site', () => {
    expect(hasSiteAccess({ role: 'ADMIN', sites: [] }, 'anything')).toBe(true);
  });
  it('limits everyone else to assigned sites', () => {
    expect(hasSiteAccess({ role: 'INSPECTOR', sites }, 'a')).toBe(true);
    expect(hasSiteAccess({ role: 'INSPECTOR', sites }, 'b')).toBe(false);
    expect(hasSiteAccess({ role: 'HSE_MANAGER', sites: [] }, 'a')).toBe(false);
  });
});

describe('CAPA workflow', () => {
  it('never lets a plain transition close an action (only verification can)', () => {
    for (const [from, targets] of Object.entries(CAPA_TRANSITIONS)) {
      expect(targets, `${from} -> CLOSED`).not.toContain('CLOSED');
    }
  });
  it('gives cancelled actions no way back', () => {
    expect(CAPA_TRANSITIONS.CANCELLED).toEqual([]);
  });
});
