import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { toTable } from '@/lib/export/csv';
import { tableToXlsx } from '@/lib/export/xlsx';

type Row = { name: string; qty: number | null; when: Date | null; ok: boolean; links: string[] };
const cols = [
  { header: 'Name', value: (r: Row) => r.name },
  { header: 'Qty', value: (r: Row) => r.qty },
  { header: 'When', value: (r: Row) => r.when },
  { header: 'OK', value: (r: Row) => r.ok },
  { header: 'Links', value: (r: Row) => r.links },
];
const rows: Row[] = [
  { name: '=HYPERLINK("http://evil","x")', qty: -5, when: new Date('2026-10-16T00:00:00Z'), ok: true, links: ['https://a.test', 'https://b.test'] },
  { name: 'Électricité', qty: null, when: new Date('2026-10-16T08:30:00Z'), ok: false, links: [] },
];

async function load() {
  const buf = await tableToXlsx(toTable(cols, rows), 'incidents');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb.getWorksheet('incidents')!;
}

describe('xlsx export', () => {
  it('writes a header row, frozen and filterable, plus one row per record', async () => {
    const ws = await load();
    expect(ws.rowCount).toBe(3);
    expect(ws.getRow(1).values).toEqual([undefined, 'Name', 'Qty', 'When', 'OK', 'Links']);
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(ws.autoFilter).toBeTruthy();
  });
  it('stores formula-looking text as text, never as a formula', async () => {
    const cell = (await load()).getCell('A2');
    expect(cell.type).toBe(ExcelJS.ValueType.String);
    expect(cell.value).toBe('=HYPERLINK("http://evil","x")');
    expect(cell.formula).toBeUndefined();
  });
  it('keeps numbers numeric and dates as dates', async () => {
    const ws = await load();
    expect(ws.getCell('B2').value).toBe(-5);
    expect((ws.getCell('C2').value as Date).toISOString()).toBe('2026-10-16T00:00:00.000Z');
    expect(ws.getCell('C2').numFmt).toBe('yyyy-mm-dd');
    expect(ws.getCell('C3').numFmt).toBe('yyyy-mm-dd hh:mm');
  });
  it('writes booleans as Yes/No, blanks for null, and keeps accents and link lists', async () => {
    const ws = await load();
    expect(ws.getCell('D2').value).toBe('Yes');
    expect(ws.getCell('D3').value).toBe('No');
    expect(ws.getCell('B3').value ?? '').toBe('');
    expect(ws.getCell('A3').value).toBe('Électricité');
    expect(ws.getCell('E2').value).toBe('https://a.test\nhttps://b.test');
  });
  it('produces a real .xlsx (zip) file', async () => {
    const buf = new Uint8Array(await tableToXlsx(toTable(cols, rows), 'x'));
    expect(String.fromCharCode(buf[0], buf[1])).toBe('PK');
  });
  it('cleans illegal sheet-name characters and length', async () => {
    const buf = await tableToXlsx(toTable(cols, rows), 'a/b?c*[d]:'.repeat(5));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const name = wb.worksheets[0].name;
    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).not.toMatch(/[\\/?*[\]:]/);
  });
});
