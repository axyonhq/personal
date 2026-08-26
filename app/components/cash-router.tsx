"use client";

import { useMemo, useState } from "react";
import {
  convertForToggle,
  formatInputAmount,
  formatMoney,
  parseMoney,
  summarize,
  type Currency,
} from "@/app/lib/cash";
import type { FxQuote } from "@/app/lib/fx";

type Bucket = {
  id: string;
  name: string;
  amount: string;
  currency: Currency;
};

const SLICE = ["#2ec8ff", "#0a8cff", "#6ae0ff", "#3d6bff", "#00e0c6", "#4aa3ff"];

function newBucket(): Bucket {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id, name: "", amount: "", currency: "USD" };
}

function shortAsOf(value: string): string {
  if (!value) return "live";
  const day = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (day) return day;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function CashRouter({ initialRate }: { initialRate: FxQuote | null }) {
  const [inflow, setInflow] = useState("");
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [rate, setRate] = useState<FxQuote | null>(initialRate);
  const [rateError, setRateError] = useState(
    initialRate ? "" : "Live rate unavailable",
  );
  const [refreshing, setRefreshing] = useState(false);

  const usdToAud = rate?.usdToAud ?? null;
  const inflowUsd = parseMoney(inflow);
  const summary = useMemo(
    () =>
      summarize({
        inflowUsd,
        usdToAud,
        buckets: buckets.map((bucket) => ({
          amount: parseMoney(bucket.amount),
          currency: bucket.currency,
        })),
      }),
    [buckets, inflowUsd, usdToAud],
  );

  function patchBucket(id: string, next: Partial<Bucket>) {
    setBuckets((prev) =>
      prev.map((bucket) => (bucket.id === id ? { ...bucket, ...next } : bucket)),
    );
  }

  function toggleCurrency(bucket: Bucket, next: Currency) {
    if (bucket.currency === next) return;
    const converted = convertForToggle(
      parseMoney(bucket.amount),
      bucket.currency,
      next,
      usdToAud,
    );
    patchBucket(bucket.id, {
      currency: next,
      amount: formatInputAmount(converted),
    });
  }

  async function refreshRate() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/fx", { cache: "no-store" });
      const data = (await res.json()) as FxQuote & { ok?: boolean };
      if (!res.ok || !data.usdToAud) {
        setRateError("Live rate unavailable");
        return;
      }
      setRate({
        usdToAud: data.usdToAud,
        asOf: data.asOf,
        source: data.source,
      });
      setRateError("");
    } catch {
      setRateError("Live rate unavailable");
    } finally {
      setRefreshing(false);
    }
  }

  function reset() {
    setInflow("");
    setBuckets([]);
  }

  const state = summary.overAllocated
    ? "over"
    : summary.fullyRouted
      ? "full"
      : "open";
  const remainingLabel = summary.overAllocated
    ? `Over by ${formatMoney(Math.abs(summary.remainingUsd), "USD")}`
    : summary.fullyRouted
      ? "Fully routed"
      : `${formatMoney(summary.remainingUsd, "USD")} unrouted`;

  return (
    <div className="cr-shell">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="cr-kicker">Allocation desk</p>
          <h1 className="cr-title">Cash Router</h1>
          <p className="cr-note">
            Input incoming USD, add buckets, and allocate in USD or AUD. Figures
            stay on this page only — nothing is saved.
          </p>
        </div>
        <div className="cr-rate">
          {usdToAud ? (
            <>
              <p className="cr-rate-value">
                1 USD = {usdToAud.toFixed(4)} AUD
              </p>
              <p className="cr-rate-meta">
                {rate?.source} · {shortAsOf(rate?.asOf ?? "")}
              </p>
            </>
          ) : (
            <p className="cr-rate-value" style={{ color: "var(--cr-warn)" }}>
              {rateError || "Fetching rate"}
            </p>
          )}
          <button
            type="button"
            className="cr-refresh"
            onClick={() => void refreshRate()}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing" : "Refresh rate"}
          </button>
        </div>
      </header>

      <div className="cr-grid">
        <section className="cr-card">
          <p className="cr-label">Cash in</p>
          <label className="cr-inflow">
            <span className="cr-inflow-ccy">USD</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={inflow}
              onChange={(e) => setInflow(e.target.value)}
              aria-label="Total cash incoming in USD"
            />
          </label>
          <div className="cr-meter" aria-hidden="true">
            {summary.overAllocated ? (
              <span style={{ width: "100%", background: "var(--cr-warn)" }} />
            ) : (
              <>
                {summary.buckets.map((line, i) =>
                  line.usd > 0 ? (
                    <span
                      key={buckets[i]?.id ?? i}
                      style={{
                        width: `${Math.max(line.pct, 0)}%`,
                        background: SLICE[i % SLICE.length],
                      }}
                    />
                  ) : null,
                )}
                {summary.remainingUsd > 0 ? (
                  <span
                    style={{
                      width: `${Math.max(0, 100 - summary.routedPct)}%`,
                      background: "#18202c",
                    }}
                  />
                ) : null}
              </>
            )}
          </div>
          <div className="cr-status" data-state={state}>
            <span>
              Routed{" "}
              <strong>
                {formatMoney(summary.allocatedUsd, "USD")} · {summary.routedPct}%
              </strong>
            </span>
            <span>
              <strong>{remainingLabel}</strong>
            </span>
          </div>
          {usdToAud && inflowUsd > 0 ? (
            <p className="mt-3 text-[0.78rem] text-[color:var(--cr-muted)]">
              Inflow equals {formatMoney(summary.inflowAud, "AUD")} at the
              current rate.
            </p>
          ) : null}
        </section>

        <aside className="cr-card">
          <p className="cr-label">Ledger</p>
          {buckets.length === 0 ? (
            <p className="mt-4 text-[0.92rem] text-[color:var(--cr-muted)]">
              Buckets appear here as you add them.
            </p>
          ) : (
            <div className="mt-2">
              {buckets.map((bucket, i) => {
                const line = summary.buckets[i];
                const name = bucket.name.trim() || `Bucket ${String(i + 1).padStart(2, "0")}`;
                return (
                  <div className="cr-ledger-row" key={bucket.id}>
                    <span className="cr-ledger-name">{name}</span>
                    <span className="cr-ledger-amt">
                      {formatMoney(line?.usd ?? 0, "USD")}
                      <small>
                        {line?.needsRate
                          ? "Waiting for FX"
                          : formatMoney(line?.aud ?? 0, "AUD")}
                      </small>
                    </span>
                  </div>
                );
              })}
              <div className="cr-ledger-row cr-total">
                <span className="cr-ledger-name">Unrouted</span>
                <span className="cr-ledger-amt">
                  {formatMoney(summary.remainingUsd, "USD")}
                  <small>{formatMoney(summary.remainingAud, "AUD")}</small>
                </span>
              </div>
            </div>
          )}
        </aside>

        <section className="cr-card cr-buckets">
          <div className="cr-bucket-head">
            <p className="cr-label">Buckets</p>
            <div className="flex gap-2">
              <button type="button" className="cr-btn cr-btn-ghost" onClick={reset}>
                Reset
              </button>
              <button
                type="button"
                className="cr-btn"
                onClick={() => setBuckets((prev) => [...prev, newBucket()])}
              >
                Add bucket
              </button>
            </div>
          </div>

          {buckets.length === 0 ? (
            <div className="cr-empty">
              No buckets yet. Add one and allocate a slice of the inflow.
            </div>
          ) : (
            buckets.map((bucket, i) => {
              const line = summary.buckets[i];
              const other: Currency = bucket.currency === "USD" ? "AUD" : "USD";
              const otherAmt =
                other === "USD" ? (line?.usd ?? 0) : (line?.aud ?? 0);
              return (
                <article className="cr-bucket" key={bucket.id}>
                  <span className="cr-idx">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <input
                    className="cr-field"
                    value={bucket.name}
                    placeholder="Bucket name"
                    autoComplete="off"
                    onChange={(e) => patchBucket(bucket.id, { name: e.target.value })}
                    aria-label={`Bucket ${i + 1} name`}
                  />
                  <input
                    className="cr-field cr-field-amt"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    value={bucket.amount}
                    onChange={(e) =>
                      patchBucket(bucket.id, { amount: e.target.value })
                    }
                    aria-label={`${bucket.name || `Bucket ${i + 1}`} amount`}
                  />
                  <div className="cr-toggle" role="group" aria-label="Currency">
                    {(["USD", "AUD"] as const).map((ccy) => (
                      <button
                        key={ccy}
                        type="button"
                        data-on={bucket.currency === ccy}
                        disabled={ccy === "AUD" && !usdToAud}
                        onClick={() => toggleCurrency(bucket, ccy)}
                      >
                        {ccy}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="cr-icon-btn"
                    onClick={() =>
                      setBuckets((prev) => prev.filter((row) => row.id !== bucket.id))
                    }
                    aria-label={`Remove ${bucket.name || `bucket ${i + 1}`}`}
                  >
                    ×
                  </button>
                  <p className="cr-equiv">
                    {line?.needsRate
                      ? "AUD locked until the live rate loads."
                      : `${formatMoney(otherAmt, other)} · ${line?.pct ?? 0}% of inflow`}
                  </p>
                </article>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
