import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFrankfurterQuote, parseOpenErQuote } from "./fx";

describe("parseOpenErQuote", () => {
  it("reads a successful USD book", () => {
    const quote = parseOpenErQuote({
      result: "success",
      time_last_update_utc: "Wed, 26 Aug 2026 00:02:31 +0000",
      rates: { AUD: 1.39695 },
    });
    assert.deepEqual(quote, {
      usdToAud: 1.39695,
      asOf: "Wed, 26 Aug 2026 00:02:31 +0000",
      source: "ExchangeRate-API",
    });
  });

  it("rejects missing or invalid rates", () => {
    assert.equal(parseOpenErQuote({ result: "error" }), null);
    assert.equal(
      parseOpenErQuote({ result: "success", rates: { AUD: 0 } }),
      null,
    );
    assert.equal(parseOpenErQuote(null), null);
  });
});

describe("parseFrankfurterQuote", () => {
  it("reads an ECB USD to AUD quote", () => {
    const quote = parseFrankfurterQuote({
      amount: 1,
      base: "USD",
      date: "2026-08-25",
      rates: { AUD: 1.398 },
    });
    assert.deepEqual(quote, {
      usdToAud: 1.398,
      asOf: "2026-08-25",
      source: "Frankfurter (ECB)",
    });
  });
});
