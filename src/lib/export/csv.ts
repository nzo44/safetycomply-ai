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

/** Rows already turned into plain cell values, ready for any output format. */
export type Table = { headers: string[]; rows: unknown[][] };

export function toTable<T>(columns: Column<T>[], rows: T[]): Table {
  return { headers: columns.map((c) => c.header), rows: rows.map((r) => columns.map((c) => c.value(r))) };
}

/** RFC 4180 CSV with CRLF line ends and a UTF-8 byte order mark so Excel reads accents correctly. */
export function tableToCsv(t: Table): string {
  const head = t.headers.map(csvCell).join(',');
  const body = t.rows.map((r) => r.map(csvCell).join(','));
  return `\uFEFF${[head, ...body].join('\r\n')}\r\n`;
}

export const toCsv = <T>(columns: Column<T>[], rows: T[]): string => tableToCsv(toTable(columns, rows));

/** "IN_PROGRESS" becomes "In progress". For enums that have no label map. */
export function humanize(v: string | null | undefined): string {
  if (!v) return '';
  const s = v.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
