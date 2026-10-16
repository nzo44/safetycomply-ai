import ExcelJS from 'exceljs';
import type { Table } from './csv';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const XLSX_CONTENT_TYPE = XLSX_TYPE;

type Cell = string | number | Date;

/** Typed cells: numbers stay numbers, dates stay dates. Text is stored as text, so "=1+1" is never a formula. */
function toCell(v: unknown): Cell {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.join('\n');
  return String(v);
}

const isMidnightUtc = (d: Date) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;

/** Sheet names: max 31 characters, none of \ / ? * [ ] : */
const sheetName = (s: string) => s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Export';

export async function tableToXlsx(table: Table, name: string): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SafetyComply AI';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName(name), { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.addRow(table.headers);
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF2' } };
  head.alignment = { vertical: 'middle' };

  const widths = table.headers.map((h) => h.length);
  for (const row of table.rows) {
    const cells = row.map(toCell);
    const added = ws.addRow(cells);
    cells.forEach((c, i) => {
      const cell = added.getCell(i + 1);
      if (c instanceof Date) {
        cell.numFmt = isMidnightUtc(c) ? 'yyyy-mm-dd' : 'yyyy-mm-dd hh:mm';
        widths[i] = Math.max(widths[i], 16);
      } else {
        const longest = String(c).split('\n').reduce((m, l) => Math.max(m, l.length), 0);
        widths[i] = Math.max(widths[i], Math.min(longest, 60));
        if (typeof c === 'string' && longest > 60) cell.alignment = { wrapText: true, vertical: 'top' };
      }
    });
  }
  ws.columns.forEach((col, i) => { col.width = Math.min(60, Math.max(10, widths[i] + 2)); });
  if (table.headers.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: table.headers.length } };
  }

  const buf = await wb.xlsx.writeBuffer();
  // Copy into a plain ArrayBuffer, which is a valid Response body.
  return new Uint8Array(buf as ArrayBuffer).slice().buffer;
}
