import { describe, expect, it } from 'vitest';
import { APP_MODULES, hasModule, isAppModule, moduleOfPermission } from '@/lib/auth/modules';
import { can, PERMISSIONS } from '@/lib/auth/rbac';

describe('hasModule', () => {
  it('admins and unrestricted users see everything', () => {
    expect(hasModule({ role: 'ADMIN', allowedModules: ['waste'] }, 'risk')).toBe(true);
    expect(hasModule({ role: 'INSPECTOR', allowedModules: null }, 'risk')).toBe(true);
  });
  it('restricted users only see their modules', () => {
    const u = { role: 'INSPECTOR', allowedModules: ['waste' as const] };
    expect(hasModule(u, 'waste')).toBe(true);
    expect(hasModule(u, 'risk')).toBe(false);
  });
});

describe('moduleOfPermission', () => {
  it('maps every permission except users:manage to a module', () => {
    for (const p of PERMISSIONS) {
      if (p === 'users:manage') expect(moduleOfPermission(p)).toBeNull();
      else expect(APP_MODULES).toContain(moduleOfPermission(p));
    }
  });
  it('users:manage is admin only', () => {
    expect(can('ADMIN', 'users:manage')).toBe(true);
    for (const r of ['HSE_MANAGER', 'INSPECTOR', 'AUDITOR'] as const) expect(can(r, 'users:manage')).toBe(false);
  });
  it('validates module names', () => {
    expect(isAppModule('waste')).toBe(true);
    expect(isAppModule('hacker')).toBe(false);
  });
});
