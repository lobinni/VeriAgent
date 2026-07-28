export const short = (addr?: string, lead = 6, tail = 4) =>
  !addr ? "" : addr.length <= lead + tail ? addr : `${addr.slice(0, lead)}…${addr.slice(-tail)}`;

export function genFromWei(wei: string | bigint): string {
  const v = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function timeAgo(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export const verdictColor = (v: string) =>
  v === "pass" ? "var(--pass)" :
  v === "warn" ? "var(--warn)" :
  "var(--fail)";
