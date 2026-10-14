import { WorkflowError } from '@/lib/action-result';
import { parseStorageRef } from '@/lib/evidence';

/** Uploaded files can only be attached to records at the site they were uploaded for. */
export function assertEvidenceForSite(refs: string[], siteId: string) {
  for (const r of refs) {
    const s = parseStorageRef(r);
    if (s && s.siteId !== siteId) {
      throw new WorkflowError('An attached file belongs to a different site. Remove it and upload it again.');
    }
  }
}
