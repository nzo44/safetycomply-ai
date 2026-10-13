/**
 * Only same-origin paths are allowed after sign-in. Rejects absolute URLs, protocol-relative
 * URLs ("//evil.com") and backslash tricks, so the `next` parameter can't become an open redirect.
 */
export function safeNext(raw: string | null | undefined, fallback = '/') {
  if (!raw || raw.length > 500) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f]/.test(raw)) return fallback;
  if (raw.startsWith('/login') || raw.startsWith('/callback')) return fallback;
  return raw;
}
