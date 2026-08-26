export type Currency = "USD" | "AUD";

export type BucketInput = {
  amount: number;
  currency: Currency;
};

export type BucketLine = {
  usd: number;
  aud: number;
  pct: number;
  needsRate: boolean;
};

export type AllocationSummary = {
  allocatedUsd: number;
  remainingUsd: number;
  allocatedAud: number;
  remainingAud: number;
  inflowAud: number;
  routedPct: number;
  overAllocated: boolean;
  fullyRouted: boolean;
  buckets: BucketLine[];
};

export function parseMoney(raw: string): number {
  const text = String(raw ?? "").trim();
  if (!text || text.startsWith("-")) return 0;
  const cleaned = text.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatInputAmount(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "";
  return roundMoney(n).toFixed(2);
}

export function formatMoney(n: number, currency: Currency): string {
  return new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function toUsd(
  amount: number,
  currency: Currency,
  usdToAud: number | null,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (currency === "USD") return amount;
  if (!usdToAud || usdToAud <= 0) return 0;
  return amount / usdToAud;
}

export function toAud(amountUsd: number, usdToAud: number | null): number {
  if (!Number.isFinite(amountUsd) || amountUsd === 0) return 0;
  if (!usdToAud || usdToAud <= 0) return 0;
  return amountUsd * usdToAud;
}

export function convertForToggle(
  amount: number,
  from: Currency,
  to: Currency,
  usdToAud: number | null,
): number {
  if (from === to) return amount;
  if (!usdToAud || usdToAud <= 0) return amount;
  const usd = toUsd(amount, from, usdToAud);
  return to === "USD" ? usd : toAud(usd, usdToAud);
}

export function summarize(args: {
  inflowUsd: number;
  usdToAud: number | null;
  buckets: BucketInput[];
}): AllocationSummary {
  const inflowUsd = Math.max(0, roundMoney(args.inflowUsd));
  const rate =
    args.usdToAud && args.usdToAud > 0 ? args.usdToAud : null;

  const buckets = args.buckets.map((bucket): BucketLine => {
    const needsRate = bucket.currency === "AUD" && !rate;
    const usd = roundMoney(toUsd(bucket.amount, bucket.currency, rate));
    const aud = roundMoney(toAud(usd, rate));
    const pct =
      inflowUsd > 0 ? roundMoney((usd / inflowUsd) * 100) : 0;
    return { usd, aud, pct, needsRate };
  });

  const allocatedUsd = roundMoney(
    buckets.reduce((sum, line) => sum + line.usd, 0),
  );
  const remainingUsd = roundMoney(inflowUsd - allocatedUsd);
  const inflowAud = roundMoney(toAud(inflowUsd, rate));
  const allocatedAud = roundMoney(toAud(allocatedUsd, rate));
  const remainingAud = roundMoney(toAud(remainingUsd, rate));
  const routedPct =
    inflowUsd > 0
      ? roundMoney(Math.min(100, (allocatedUsd / inflowUsd) * 100))
      : 0;

  return {
    allocatedUsd,
    remainingUsd,
    allocatedAud,
    remainingAud,
    inflowAud,
    routedPct,
    overAllocated: remainingUsd < 0,
    fullyRouted: inflowUsd > 0 && remainingUsd === 0,
    buckets,
  };
}
