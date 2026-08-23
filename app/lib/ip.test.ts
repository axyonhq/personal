import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractClientIp,
  firstPublicIp,
  ipKind,
  isPublicIp,
  isValidIp,
  normalizeIp,
} from "./ip";

describe("normalizeIp", () => {
  it("strips IPv4 ports, quotes, and mapped IPv6", () => {
    assert.equal(normalizeIp("203.0.113.10:51234"), "203.0.113.10");
    assert.equal(normalizeIp('"203.0.113.10"'), "203.0.113.10");
    assert.equal(normalizeIp("[2001:db8::1]"), "2001:db8::1");
    assert.equal(normalizeIp("::ffff:203.0.113.10"), "203.0.113.10");
    assert.equal(normalizeIp("for=203.0.113.10"), "203.0.113.10");
  });

  it("rejects junk", () => {
    assert.equal(normalizeIp("not-an-ip"), undefined);
    assert.equal(normalizeIp(""), undefined);
  });
});

describe("isPublicIp", () => {
  it("filters private and loopback ranges", () => {
    assert.equal(isPublicIp("10.0.0.2"), false);
    assert.equal(isPublicIp("192.168.1.8"), false);
    assert.equal(isPublicIp("127.0.0.1"), false);
    assert.equal(isPublicIp("172.16.5.1"), false);
    assert.equal(isPublicIp("169.254.1.1"), false);
    assert.equal(isPublicIp("203.0.113.9"), true);
    assert.equal(isPublicIp("::1"), false);
    assert.equal(isPublicIp("2001:db8::1"), true);
  });
});

describe("firstPublicIp", () => {
  it("prefers the leftmost public address", () => {
    assert.equal(firstPublicIp("203.0.113.9, 10.0.0.2, 192.168.1.8"), "203.0.113.9");
    assert.equal(firstPublicIp("10.0.0.2, 198.51.100.4"), "198.51.100.4");
  });
});

describe("extractClientIp", () => {
  it("reads Cloudflare / Vercel / forwarded headers", () => {
    assert.equal(
      extractClientIp(new Headers({ "cf-connecting-ip": "203.0.113.50" })),
      "203.0.113.50",
    );
    assert.equal(
      extractClientIp(
        new Headers({
          "x-forwarded-for": "10.1.1.1, 203.0.113.77, 172.16.0.2",
        }),
      ),
      "203.0.113.77",
    );
    assert.equal(
      extractClientIp(new Headers({ "x-real-ip": "2001:db8::ab" })),
      "2001:db8::ab",
    );
  });
});

describe("ipKind", () => {
  it("labels v4 and v6", () => {
    assert.equal(ipKind("1.2.3.4"), "IPv4");
    assert.equal(ipKind("2001:db8::1"), "IPv6");
    assert.equal(ipKind(undefined), "unknown");
    assert.equal(isValidIp("8.8.8.8"), true);
  });
});
