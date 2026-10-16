import type { Permission } from '@/lib/auth/rbac';
import { INSPECTION_STATUS_LABEL, NCR_SEVERITY_LABEL, NCR_STATUS_LABEL, STANDARD_LABEL } from '@/lib/audits/meta';
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from '@/lib/compliance-meta';
import { getInspections, getNcrRegister, parseInspectionFilters } from '@/lib/data/audits';
import { getCapaBoard, parseCapaFilters } from '@/lib/data/capa';
import { getMatrix, parseFilters, toMatrixRow } from '@/lib/data/compliance';
import { getIncidents, parseIncidentFilters } from '@/lib/data/incidents';
import type { SearchParams } from '@/lib/data/params';
import { getAssessments, parseRiskFilters } from '@/lib/data/risk';
import { getWasteManifests, parseManifestParams } from '@/lib/data/waste';
import { INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL, SEVERITY_LABEL } from '@/lib/incidents-meta';
import { LEVEL_META } from '@/lib/risk/matrix';
import { ASSESSMENT_STATUS_LABEL, ASSESSMENT_TYPE_LABEL } from '@/lib/risk/workflow';
import { MANIFEST_STATUS_LABEL, WASTE_TYPE_LABEL } from '@/lib/waste/meta';
import { humanize, toCsv, type Column } from './csv';

type Ctx = { siteId: string; viewerId: string; sp: SearchParams };
export type ExportDef = { permission: Permission; build: (ctx: Ctx) => Promise<string> };

/** Hard stops so one click can never pull an unbounded table. */
const MAX_ROWS = 5000;
const MAX_PAGES = 50;

function define<T>(permission: Permission, load: (ctx: Ctx) => Promise<T[]>, columns: Column<T>[]): ExportDef {
  return { permission, build: async (ctx) => toCsv(columns, await load(ctx)) };
}

const label = <K extends string>(map: Record<K, string>, k: K | null | undefined) => (k ? (map[k] ?? humanize(k)) : '');
const level = (k: keyof typeof LEVEL_META | null | undefined) => (k ? LEVEL_META[k].label : '');

export const EXPORTS = {
  compliance: define(
    'compliance:read',
    async ({ siteId, sp }) => (await getMatrix(siteId, parseFilters(sp))).map(toMatrixRow),
    [
      { header: 'Requirement', value: (r) => r.title },
      { header: 'Citation', value: (r) => r.citation },
      { header: 'Category', value: (r) => label(CATEGORY_LABEL, r.category) },
      { header: 'Status', value: (r) => label(STATUS_LABEL, r.currentStatus) },
      { header: 'Owner', value: (r) => r.ownerName },
      { header: 'Last audit', value: (r) => r.lastAuditDate },
      { header: 'Gap severity', value: (r) => label(PRIORITY_LABEL, r.gapSeverity) },
      { header: 'Next review', value: (r) => r.nextReviewDate },
      { header: 'Evidence links', value: (r) => r.evidenceUrls },
    ],
  ),

  incidents: define(
    'incident:read',
    ({ siteId, sp }) => getIncidents(siteId, parseIncidentFilters(sp)),
    [
      { header: 'Reference', value: (r) => r.referenceNo },
      { header: 'Title', value: (r) => r.title },
      { header: 'Type', value: (r) => label(INCIDENT_TYPE_LABEL, r.type) },
      { header: 'Severity', value: (r) => label(SEVERITY_LABEL, r.severity) },
      { header: 'Status', value: (r) => label(INCIDENT_STATUS_LABEL, r.status) },
      { header: 'Occurred at', value: (r) => r.occurredAt },
      { header: 'Location', value: (r) => r.location },
      { header: 'Recordable', value: (r) => r.isRecordable },
      { header: 'Reportable to authority', value: (r) => r.isReportableToAuthority },
      { header: 'Open actions', value: (r) => r._count.capaActions },
    ],
  ),

  capa: define(
    'incident:read',
    ({ siteId, sp, viewerId }) => getCapaBoard(siteId, parseCapaFilters(sp), viewerId),
    [
      { header: 'Reference', value: (r) => r.referenceNo },
      { header: 'Title', value: (r) => r.title },
      { header: 'Description', value: (r) => r.description },
      { header: 'Type', value: (r) => humanize(r.type) },
      { header: 'Status', value: (r) => humanize(r.status) },
      { header: 'Priority', value: (r) => label(PRIORITY_LABEL, r.priority) },
      { header: 'Assignee', value: (r) => r.assigneeName },
      { header: 'Due date', value: (r) => r.dueDate },
      { header: 'Days overdue', value: (r) => r.overdueDays },
      { header: 'Escalation level', value: (r) => r.escalationLevel },
      { header: 'Escalated to', value: (r) => r.escalatedToName },
      { header: 'Incident', value: (r) => r.incidentRef },
      { header: 'Inspection', value: (r) => r.inspectionRef },
      { header: 'Completion notes', value: (r) => r.completionNotes },
      { header: 'Effectiveness notes', value: (r) => r.effectivenessNotes },
    ],
  ),

  waste: define(
    'waste:read',
    async ({ siteId, sp }) => {
      // The page paginates. The export asks for one large page instead.
      const params = { ...parseManifestParams(sp), page: 1, pageSize: MAX_ROWS };
      return (await getWasteManifests(siteId, params)).rows;
    },
    [
      { header: 'Manifest code', value: (r) => r.manifestCode },
      { header: 'Waste type', value: (r) => label(WASTE_TYPE_LABEL, r.wasteType) },
      { header: 'Description', value: (r) => r.description },
      { header: 'Transporter', value: (r) => r.transporterName },
      { header: 'Destination', value: (r) => r.destinationFacility },
      { header: 'Disposal method', value: (r) => humanize(r.disposalMethod) },
      { header: 'Status', value: (r) => label(MANIFEST_STATUS_LABEL, r.status) },
      { header: 'Dispatched at', value: (r) => r.dispatchedAt },
      { header: 'Received at', value: (r) => r.receivedAt },
      { header: 'Estimated weight (kg)', value: (r) => r.estimatedWeightKg },
      { header: 'Net weight (kg)', value: (r) => r.netWeightKg },
      { header: 'Weighbridge ticket', value: (r) => r.ticketNo },
      { header: 'Status note', value: (r) => r.statusNote },
      { header: 'Evidence links', value: (r) => r.evidenceUrls },
    ],
  ),

  risk: define(
    'risk:read',
    ({ siteId, sp }) => getAssessments(siteId, parseRiskFilters(sp)),
    [
      { header: 'Reference', value: (r) => r.referenceNo },
      { header: 'Version', value: (r) => r.version },
      { header: 'Title', value: (r) => r.title },
      { header: 'Type', value: (r) => label(ASSESSMENT_TYPE_LABEL, r.type) },
      { header: 'Area', value: (r) => r.area },
      { header: 'Status', value: (r) => label(ASSESSMENT_STATUS_LABEL, r.status) },
      { header: 'Hazards', value: (r) => r.hazardCount },
      { header: 'Peak initial risk', value: (r) => level(r.peakInitial) },
      { header: 'Peak residual risk', value: (r) => level(r.peakResidual) },
      { header: 'Next review', value: (r) => r.nextReviewDate },
      { header: 'Review overdue', value: (r) => r.reviewOverdue },
    ],
  ),

  inspections: define(
    'inspection:read',
    async ({ siteId, sp }) => {
      const filters = parseInspectionFilters(sp);
      const first = await getInspections(siteId, { ...filters, page: 1 });
      const rows = [...first.rows];
      for (let p = 2; p <= Math.min(first.pageCount, MAX_PAGES); p++) {
        rows.push(...(await getInspections(siteId, { ...filters, page: p })).rows);
      }
      return rows;
    },
    [
      { header: 'Reference', value: (r) => r.referenceNo },
      { header: 'Checklist', value: (r) => r.checklistTitle },
      { header: 'Standard', value: (r) => label(STANDARD_LABEL, r.standard) },
      { header: 'Inspector', value: (r) => r.inspectorName },
      { header: 'Scheduled date', value: (r) => r.scheduledDate },
      { header: 'Completed date', value: (r) => r.completedDate },
      { header: 'Score (%)', value: (r) => r.scorePercentage },
      { header: 'Status', value: (r) => label(INSPECTION_STATUS_LABEL, r.status) },
      { header: 'Overdue', value: (r) => r.overdue },
      { header: 'Questions answered', value: (r) => r.answered },
      { header: 'Total questions', value: (r) => r.totalQuestions },
      { header: 'Open NCRs', value: (r) => r.openNcrs },
    ],
  ),

  ncrs: define(
    'inspection:read',
    ({ siteId }) => getNcrRegister(siteId),
    [
      { header: 'Reference', value: (r) => r.referenceNo },
      { header: 'Severity', value: (r) => label(NCR_SEVERITY_LABEL, r.severity) },
      { header: 'Status', value: (r) => label(NCR_STATUS_LABEL, r.status) },
      { header: 'Summary', value: (r) => r.summary },
      { header: 'Inspection', value: (r) => r.inspectionRef },
      { header: 'Linked action', value: (r) => r.capaRef },
      { header: 'Raised', value: (r) => r.createdAt },
    ],
  ),
} satisfies Record<string, ExportDef>;

export type ExportKey = keyof typeof EXPORTS;
export const isExportKey = (k: string): k is ExportKey => Object.hasOwn(EXPORTS, k);
