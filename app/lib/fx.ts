export type FxQuote = {
  usdToAud: number;
  asOf: string;
  source: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function positiveRate(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parseOpenErQuote(data: unknown): FxQuote | null {
  const d = asRecord(data);
  if (!d || d.result !== "success") return null;
  const rates = asRecord(d.rates);
  if (!rates) return null;
  const usdToAud = positiveRate(rates.AUD);
  if (!usdToAud) return null;
  const asOf =
    typeof d.time_last_update_utc === "string" ? d.time_last_update_utc : "";
  return { usdToAud, asOf, source: "ExchangeRate-API" };
}

export function parseFrankfurterQuote(data: unknown): FxQuote | null {
  const d = asRecord(data);
  if (!d) return null;
  const rates = asRecord(d.rates);
  if (!rates) return null;
  const usdToAud = positiveRate(rates.AUD);
  if (!usdToAud) return null;
  const asOf = typeof d.date === "string" ? d.date : "";
  return { usdToAud, asOf, source: "Frankfurter (ECB)" };
}

async function fetchJson(url: string, ms = 3000): Promise<unknown> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`fx ${res.status}`);
  return res.json();
}

export async function getUsdAudRate(): Promise<FxQuote | null> {
  const [primary, fallback] = await Promise.allSettled([
    fetchJson("https://open.er-api.com/v6/latest/USD").then(parseOpenErQuote),
    fetchJson(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD",
    ).then(parseFrankfurterQuote),
  ]);

  if (primary.status === "fulfilled" && primary.value) return primary.value;
  if (fallback.status === "fulfilled" && fallback.value) return fallback.value;
  return null;
}
