/**
 * Per-user module access, on top of the four roles. Pure functions only (no database), so the browser
 * sidebar and the unit tests can use them.
 *
 * `allowedModules === null` means unrestricted: the user gets every module their role permits.
 * A list means the user is limited to those modules. Administrators are never restricted.
 */
export const APP_MODULES = ['compliance', 'incidents', 'waste', 'risk', 'audits', 'permits'] as const;
export type AppModule = (typeof APP_MODULES)[number];
export type ModuleAccess = AppModule[] | null;

export const MODULE_LABEL: Record<AppModule, string> = {
  compliance: 'Legal compliance',
  incidents: 'Incidents and CAPA',
  waste: 'Waste and discharge',
  risk: 'Risk assessments',
  audits: 'Audits and inspections',
  permits: 'Permits to work',
};

export const isAppModule = (v: unknown): v is AppModule =>
  typeof v === 'string' && (APP_MODULES as readonly string[]).includes(v);

export const hasModule = (user: { role: string; allowedModules: ModuleAccess }, m: AppModule) =>
  user.role === 'ADMIN' || user.allowedModules === null || user.allowedModules.includes(m);

/** Which module a permission belongs to, by its prefix. Permissions outside the modules return null. */
const PREFIX_MODULE: Record<string, AppModule> = {
  compliance: 'compliance', requirement: 'compliance', audit: 'compliance',
  incident: 'incidents', rca: 'incidents', capa: 'incidents',
  waste: 'waste',
  risk: 'risk',
  inspection: 'audits', checklist: 'audits',
  permit: 'permits',
};

export const moduleOfPermission = (permission: string): AppModule | null =>
  PREFIX_MODULE[permission.split(':')[0]] ?? null;
