export type SearchParams = Record<string, string | string[] | undefined>;

export const one = (sp: SearchParams, key: string) =>
  Array.isArray(sp[key]) ? sp[key]![0] : (sp[key] as string | undefined);

/** Returns the value only if it is an own key of `allowed` (rejects "constructor", "toString", ...). */
export const pick = <T extends string>(v: string | undefined, allowed: Record<T, unknown>): T | undefined =>
  v && Object.hasOwn(allowed, v) ? (v as T) : undefined;

/** Builds a URL that keeps the current search params and applies `patch` (undefined removes a key). */
export function withParams(sp: SearchParams, patch: Record<string, string | undefined>, base = '/waste') {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) next.set(k, val);
  }
  for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
  const qs = next.toString();
  return qs ? `${base}?${qs}` : base;
}
