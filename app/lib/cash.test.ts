import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  convertForToggle,
  formatInputAmount,
  parseMoney,
  roundMoney,
  summarize,
  toAud,
  toUsd,
} from "./cash";

describe("parseMoney", () => {
  it("parses currency-like strings and rejects junk", () => {
    assert.equal(parseMoney("1,250.50"), 1250.5);
    assert.equal(parseMoney("$80"), 80);
    assert.equal(parseMoney("A$1,200.00"), 1200);
    assert.equal(parseMoney(""), 0);
    assert.equal(parseMoney("abc"), 0);
    assert.equal(parseMoney("-10"), 0);
  });
});

describe("roundMoney", () => {
  it("rounds to cents", () => {
    assert.equal(roundMoney(1.005), 1.01);
    assert.equal(roundMoney(10.1), 10.1);
  });
});

describe("fx conversion", () => {
  it("converts AUD to USD using AUD per USD", () => {
    assert.equal(toUsd(152, "AUD", 1.52), 100);
    assert.equal(toUsd(100, "USD", 1.52), 100);
    assert.equal(toUsd(50, "AUD", null), 0);
  });

  it("converts USD to AUD", () => {
    assert.equal(toAud(100, 1.52), 152);
    assert.equal(toAud(100, null), 0);
  });

  it("keeps the USD value constant when toggling currency", () => {
    assert.equal(convertForToggle(152, "AUD", "USD", 1.52), 100);
    assert.equal(convertForToggle(100, "USD", "AUD", 1.52), 152);
    assert.equal(roundMoney(convertForToggle(100, "USD", "AUD", 1.4)), 140);
    assert.equal(convertForToggle(80, "USD", "AUD", null), 80);
  });
});

describe("formatInputAmount", () => {
  it("writes two-decimal strings and blanks zero", () => {
    assert.equal(formatInputAmount(140), "140.00");
    assert.equal(formatInputAmount(0), "");
  });
});

describe("summarize", () => {
  it("allocates mixed currency buckets against USD inflow", () => {
    const s = summarize({
      inflowUsd: 1000,
      usdToAud: 1.5,
      buckets: [
        { amount: 200, currency: "USD" },
        { amount: 450, currency: "AUD" },
      ],
    });
    assert.equal(s.allocatedUsd, 500);
    assert.equal(s.remainingUsd, 500);
    assert.equal(s.allocatedAud, 750);
    assert.equal(s.remainingAud, 750);
    assert.equal(s.inflowAud, 1500);
    assert.equal(s.overAllocated, false);
    assert.equal(s.fullyRouted, false);
    assert.equal(s.routedPct, 50);
    assert.equal(s.buckets[0]?.usd, 200);
    assert.equal(s.buckets[1]?.usd, 300);
    assert.equal(s.buckets[1]?.aud, 450);
  });

  it("flags over-allocation and a full route", () => {
    const over = summarize({
      inflowUsd: 100,
      usdToAud: 1.5,
      buckets: [{ amount: 150, currency: "USD" }],
    });
    assert.equal(over.overAllocated, true);
    assert.equal(over.remainingUsd, -50);

    const full = summarize({
      inflowUsd: 250,
      usdToAud: 2,
      buckets: [{ amount: 250, currency: "USD" }],
    });
    assert.equal(full.fullyRouted, true);
    assert.equal(full.remainingUsd, 0);
    assert.equal(full.routedPct, 100);
  });

  it("does not convert AUD buckets until a rate exists", () => {
    const s = summarize({
      inflowUsd: 400,
      usdToAud: null,
      buckets: [{ amount: 200, currency: "AUD" }],
    });
    assert.equal(s.allocatedUsd, 0);
    assert.equal(s.remainingUsd, 400);
    assert.equal(s.buckets[0]?.needsRate, true);
  });
});
