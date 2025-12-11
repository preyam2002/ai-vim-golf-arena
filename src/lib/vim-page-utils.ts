export function buildCountPrefix(prefix: string, key: string): string {
  if (!/^[0-9]$/.test(key)) return prefix;
  if (prefix === "" && key === "0") return "";
  return `${prefix}${key}`;
}

export function consumeCount(prefix: string, fallback = 1): number {
  if (!prefix) return fallback;
  const parsed = Number(prefix);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function cycleIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return -1;
  const next = (current + delta + length) % length;
  return next;
}




