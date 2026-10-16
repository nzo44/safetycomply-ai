export type Column<T> = { header: string; value: (row: T) => unknown };

/** Excel and Sheets run cells that start with these characters as formulas ("CSV injection"). */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s: string;
  if (v instanceof Date) s = Number.isNaN(v.getTime()) ? '' : v.toISOString();
  else if (Array.isArray(v)) s = v.join(' | ');
  else if (typeof v === 'boolean') s = v ? 'Yes' : 'No';
  else s = String(v);

  // Only text can be a formula. Real numbers such as -5 stay numbers.
  if (typeof v === 'string' && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with CRLF line ends and a UTF-8 byte order mark so Excel reads accents correctly. */
export function toCsv<T>(columns: Column<T>[], rows: T[]): string {
  const head = columns.map((c) => csvCell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(','));
  return `﻿${[head, ...body].join('\r\n')}\r\n`;
}

/** "IN_PROGRESS" becomes "In progress". For enums that have no label map. */
export function humanize(v: string | null | undefined): string {
  if (!v) return '';
  const s = v.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
