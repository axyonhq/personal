import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isVaultUnreachable } from "@/app/lib/discovery-vault";

describe("isVaultUnreachable", () => {
  it("treats undici fetch failures and missing tables as soft vault outages", () => {
    assert.equal(isVaultUnreachable(new Error("fetch failed")), true);
    assert.equal(isVaultUnreachable(new Error("Failed to fetch")), true);
    assert.equal(isVaultUnreachable(new Error("table_missing")), true);
    assert.equal(isVaultUnreachable(new Error("getaddrinfo ENOTFOUND xyz.supabase.co")), true);
    assert.equal(isVaultUnreachable(new Error("write_failed")), true);
  });

  it("does not swallow real puzzle rule errors", () => {
    assert.equal(isVaultUnreachable(new Error("no_credit")), false);
    assert.equal(isVaultUnreachable(new Error("not_accepted")), false);
    assert.equal(isVaultUnreachable(new Error("already_unlocked")), false);
  });
});
