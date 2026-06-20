/** True when two businesses share the same specific industry (e.g. Painting). */
export function isSameIndustry(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  const left = norm(a);
  const right = norm(b);
  return Boolean(left && right && left === right);
}
