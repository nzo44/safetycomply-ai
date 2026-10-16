import { describe, expect, it } from 'vitest';
import { WorkflowError } from '@/lib/action-result';
import { safeNext } from '@/lib/auth/redirect';
import { isEvidenceRef, isHttpUrl, parseStorageRef, safeFileBase } from '@/lib/evidence';
import { assertEvidenceForSite } from '@/lib/evidence-guard';
import { signInSchema } from '@/lib/validations/auth';

describe('safeNext (open redirect guard)', () => {
  it('allows ordinary same-site paths', () => {
    expect(safeNext('/incidents?status=OPEN')).toBe('/incidents?status=OPEN');
  });
  it('rejects absolute, protocol-relative, backslash and control-character targets', () => {
    for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', '/a\u0000b', 'javascript:alert(1)', 'incidents']) {
      expect(safeNext(bad), bad).toBe('/');
    }
  });
  it('never bounces back into the login flow, and caps length', () => {
    expect(safeNext('/login')).toBe('/');
    expect(safeNext('/callback?x=1')).toBe('/');
    expect(safeNext(`/${'a'.repeat(600)}`)).toBe('/');
    expect(safeNext(undefined, '/home')).toBe('/home');
  });
});

describe('evidence references', () => {
  it('accepts only http(s) links and well-formed storage paths', () => {
    expect(isHttpUrl('https://example.com/a.pdf')).toBe(true);
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x', 'https://', 'http://a b']) {
      expect(isEvidenceRef(bad), bad).toBe(false);
    }
    expect(isEvidenceRef('evidence/site_main/0b9c6e1e-1111-4222-8333-444455556666-report.pdf')).toBe(true);
  });
  it('rejects path traversal, other buckets and wrong depth', () => {
    for (const bad of ['evidence/site/../other/x.pdf', 'evidence/site/a..b.pdf', 'other/site/x.pdf', 'evidence/x.pdf', 'evidence/a/b/c.pdf', 'evidence/site/.hidden']) {
      expect(parseStorageRef(bad), bad).toBeNull();
    }
  });
  it('refuses files that belong to another site', () => {
    const ref = 'evidence/site_a/0b9c6e1e-1111-4222-8333-444455556666-x.pdf';
    expect(() => assertEvidenceForSite([ref], 'site_a')).not.toThrow();
    expect(() => assertEvidenceForSite([ref], 'site_b')).toThrow(WorkflowError);
    expect(() => assertEvidenceForSite(['https://example.com/x'], 'site_b')).not.toThrow();
  });
  it('cleans file names, dropping accents without leaving stray dashes', () => {
    expect(safeFileBase('Été 2026.pdf')).toBe('ete-2026');
    for (const hostile of ['../../etc/passwd', '..\\..\\win.ini', 'a/b/c.pdf', '.hidden', '<script>.pdf']) {
      expect(safeFileBase(hostile), hostile).toMatch(/^[a-z0-9][a-z0-9._-]*$/); // no slashes, no leading dot, no '..'
      expect(safeFileBase(hostile), hostile).not.toContain('..');
    }
    expect(safeFileBase('***.pdf')).toBe('file');
  });
});

describe('sign-in form', () => {
  it('normalises the email and requires a password', () => {
    const ok = signInSchema.safeParse({ email: '  Me@Example.COM ', password: 'x' });
    expect(ok.success && ok.data.email).toBe('me@example.com');
    expect(signInSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
    expect(signInSchema.safeParse({ email: 'me@example.com', password: '' }).success).toBe(false);
  });
});
