import { z } from 'zod';
import { DisposalMethod, WasteType } from '@prisma/client';
import { blankToUndefined, evidenceRefList, id, optText } from './helpers';

export const MAX_TRUCK_KG = 200_000; // 200 t gross: above this is almost certainly a typo

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Enter a date and time');
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Weighbridge readings: kg with up to 3 decimals. */
const kg = (label: string, min: number) =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ invalid_type_error: `Enter the ${label} in kg` })
      .finite(`Enter the ${label} in kg`)
      .min(min, min > 0 ? `The ${label} must be above 0` : `The ${label} cannot be negative`)
      .max(MAX_TRUCK_KG, `The ${label} cannot exceed ${MAX_TRUCK_KG.toLocaleString('en-GB')} kg`)
      .transform(round3),
  );

/** Optional kg reading: blank means "not provided". */
const optKg = (label: string) =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ invalid_type_error: `Enter the ${label} in kg` })
      .finite(`Enter the ${label} in kg`)
      .min(0.001, `The ${label} must be above 0`)
      .max(MAX_TRUCK_KG, `The ${label} cannot exceed ${MAX_TRUCK_KG.toLocaleString('en-GB')} kg`)
      .transform(round3)
      .optional(),
  );

/** `manifestCode` is deliberately absent: the server generates it. */
export const createWasteManifestSchema = z.object({
  siteId: id('Missing site'),
  wasteType: z.nativeEnum(WasteType, { errorMap: () => ({ message: 'Choose a waste type' }) }),
  description: z.string().trim().min(5, 'Describe the waste in at least 5 characters').max(500),
  transporterName: z.string().trim().min(2, 'Enter the transporter').max(200),
  destinationFacility: z.string().trim().min(2, 'Enter the destination facility').max(200),
  estimatedWeightKg: optKg('estimated weight'),
  disposalMethod: z.preprocess(blankToUndefined, z.nativeEnum(DisposalMethod).default('LANDFILL')),
  wasteCode: optText(30),
  transporterLicenseNo: optText(60),
  vehicleRegistration: optText(30),
  driverName: optText(100),
  notes: optText(2000),
  /** Defaults to now; allows back-dating when logging a load after the fact. */
  dispatchedAt: z.preprocess(blankToUndefined, localDateTime.optional()),
});
export type CreateWasteManifestInput = z.infer<typeof createWasteManifestSchema>;

export const processDischargeSchema = z
  .object({
    manifestId: id('Missing manifest'),
    weighbridgeTicketNo: z
      .string()
      .trim()
      .min(3, 'Enter the weighbridge ticket number')
      .max(50)
      .regex(/^[A-Za-z0-9][A-Za-z0-9\-\/_.]*$/, 'Use letters, numbers and - / _ . only')
      .transform((s) => s.toUpperCase()), // "wb-1" and "WB-1" are the same ticket
    grossWeightKg: kg('gross weight', 0.001),
    tareWeightKg: kg('tare weight', 0),
    dischargeDate: localDateTime,
    /** Defaults to the signed-in user. */
    operatorId: z.preprocess(blankToUndefined, z.string().uuid('Choose a valid operator').optional()),
    notes: optText(2000),
    evidenceUrls: evidenceRefList(10),
  })
  .refine((d) => d.grossWeightKg > d.tareWeightKg, {
    path: ['grossWeightKg'],
    message: 'Gross weight must be greater than tare weight',
  });
export type ProcessDischargeInput = z.infer<typeof processDischargeSchema>;

const tons = (label: string, min: number) =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ invalid_type_error: `Enter the ${label} in tons` })
      .finite(`Enter the ${label} in tons`)
      .min(min, min > 0 ? `The ${label} must be above 0` : `The ${label} cannot be negative`)
      .max(1_000_000_000, 'That value is too large')
      .transform(round3),
  );

export const updateCapacitySchema = z.object({
  siteId: id('Missing site'),
  totalCapacityTons: tons('total capacity', 0.001),
  currentVolumeTons: tons('current volume', 0),
  /** Required (checked in the action) when an existing volume is being changed. */
  reason: optText(500),
});
export type UpdateCapacityInput = z.infer<typeof updateCapacitySchema>;

export const updateManifestStatusSchema = z
  .object({
    manifestId: id('Missing manifest'),
    toStatus: z.enum(['IN_TRANSIT', 'REJECTED', 'CANCELLED'], { errorMap: () => ({ message: 'Choose a status' }) }),
    note: optText(1000),
  })
  .refine((d) => d.toStatus === 'IN_TRANSIT' || (d.note && d.note.length >= 5), {
    path: ['note'],
    message: 'Explain why (at least 5 characters)',
  });
