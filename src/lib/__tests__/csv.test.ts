import { describe, expect, it } from 'vitest';
import { csvCell, humanize, toCsv } from '@/lib/export/csv';

describe('csvCell', () => {
  it('leaves plain values alone and blanks null/undefined', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it('neutralises spreadsheet formulas in text', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('\tx')).toBe("'\tx");
    expect(csvCell('=HYPERLINK("http://e","x")')).toBe(`"'=HYPERLINK(""http://e"",""x"")"`);
  });
  it('keeps real numbers numeric, including negatives and zero', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(0)).toBe('0');
  });
  it('formats booleans, dates and arrays', () => {
    expect(csvCell(true)).toBe('Yes');
    expect(csvCell(false)).toBe('No');
    expect(csvCell(new Date('2026-10-16T08:00:00Z'))).toBe('2026-10-16T08:00:00.000Z');
    expect(csvCell(new Date('nope'))).toBe('');
    expect(csvCell(['https://a.test/x', 'https://b.test/y'])).toBe('https://a.test/x | https://b.test/y');
  });
});

describe('toCsv', () => {
  const cols = [{ header: 'Name', value: (r: { n: string }) => r.n }, { header: 'N', value: () => 1 }];
  it('writes a BOM, CRLF line ends and keeps accents', () => {
    const out = toCsv(cols, [{ n: 'Électricité, été' }, { n: 'x' }]);
    expect(out.startsWith('﻿Name,N\r\n')).toBe(true);
    expect(out).toContain('"Électricité, été",1\r\n');
    expect(out.endsWith('x,1\r\n')).toBe(true);
  });
  it('writes only the header for no rows', () => {
    expect(toCsv(cols, [])).toBe('﻿Name,N\r\n');
  });
});

describe('humanize', () => {
  it('turns enum names into sentences', () => {
    expect(humanize('IN_PROGRESS')).toBe('In progress');
    expect(humanize(null)).toBe('');
  });
});
