/** Pure helpers shared by the browser and the server. Nothing here touches the network or the database. */

export const EVIDENCE_BUCKET = 'evidence';
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

/** Allowed uploads: MIME type to file extension. The storage bucket enforces the same list server-side. */
export const EVIDENCE_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};
export const EVIDENCE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.docx,.xlsx';

/** "evidence/<siteId>/<uuid>-<name>": one level under the site, no slashes or dots-only segments in the name. */
const STORAGE_REF = /^evidence\/([A-Za-z0-9_-]{1,40})\/([A-Za-z0-9][A-Za-z0-9._-]{0,200})$/;
const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

export interface StorageRef { siteId: string; name: string; objectPath: string }

export function parseStorageRef(ref: string): StorageRef | null {
  const m = STORAGE_REF.exec(ref);
  if (!m || m[2].includes('..')) return null;
  return { siteId: m[1], name: m[2], objectPath: `${m[1]}/${m[2]}` };
}

export const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);
export const isEvidenceRef = (v: string) => isHttpUrl(v) || parseStorageRef(v) !== null;

/** Human label for a stored reference: the original file name, or the last part of a link. */
export function evidenceLabel(ref: string): string {
  const s = parseStorageRef(ref);
  if (s) return s.name.replace(UUID_PREFIX, '');
  try {
    const u = new URL(ref);
    return decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '') || u.hostname;
  } catch {
    return ref;
  }
}

/** File name without extension, reduced to lowercase letters, digits, dots, dashes and underscores. */
export function safeFileBase(fileName: string): string {
  const base = fileName.replace(/\.[^.]*$/, '');
  const cleaned = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // drop accent marks so "Été" becomes "ete", not "e-te"
    .replace(/[^\w.-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return cleaned || 'file';
}
