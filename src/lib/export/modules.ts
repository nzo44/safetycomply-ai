import type { AppModule } from '@/lib/auth/modules';
import type { ExportKey } from './registers';

/** Which module each export belongs to. The type forces a new export to be assigned one. */
export const EXPORT_MODULE = {
  compliance: 'compliance',
  incidents: 'incidents',
  capa: 'incidents',
  waste: 'waste',
  risk: 'risk',
  inspections: 'audits',
  ncrs: 'audits',
} as const satisfies Record<ExportKey, AppModule>;
