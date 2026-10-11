import type { DisposalMethod, ManifestStatus, WasteType } from '@prisma/client';
import type { UtilizationLevel } from '@/lib/waste/capacity';

/** Plain numbers and dates only: Prisma Decimal can't cross the server -> client boundary. */
export interface WasteManifestRow {
  id: string;
  manifestCode: string;
  wasteType: WasteType;
  description: string;
  transporterName: string;
  destinationFacility: string;
  disposalMethod: DisposalMethod;
  status: ManifestStatus;
  dispatchedAt: Date;
  receivedAt: Date | null;
  estimatedWeightKg: number | null;
  netWeightKg: number | null;
  ticketNo: string | null;
  statusNote: string | null;   // reason for reject or cancel
  evidenceUrls: string[];      // from the weighbridge ticket
}

export interface WasteAnalytics {
  periodStart: Date; // start of the current month in the site's timezone
  monthlyTons: number;
  byType: { wasteType: WasteType; tons: number; loads: number; sharePct: number }[];
  hazardousRatioPct: number | null; // null when nothing was discharged this month
  pendingTransit: number;
  landfill: null | {
    totalTons: number;
    currentTons: number;
    remainingTons: number;
    utilizationPct: number;
    remainingPct: number;
    level: UtilizationLevel;
    projectedFillDate: Date | null;
    daysToFull: number | null;
    avgDailyIntakeTons: number | null;
  };
}
