import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPlace, inferPrecision, mapsLinks, mergeGeo, type GeoFix } from "./geo";
import {
  buildVisitor,
  formatMeters,
  formatVisitor,
  parseClientHints,
  parseGps,
  parseVisitKind,
  shortLocation,
  visitSubject,
} from "./visitor";

const ipFix: Partial<GeoFix> = {
  city: "Austin",
  region: "Texas",
  regionCode: "TX",
  postal: "78701",
  country: "United States",
  countryCode: "US",
  latitude: 30.2672,
  longitude: -97.7431,
  isp: "AT&T",
  org: "AT&T Mobility",
  asn: "AS7018",
  sources: ["ipwho.is"],
};

describe("parseGps", () => {
  it("accepts a precise reading and rejects junk / 0,0", () => {
    const gps = parseGps({
      latitude: 30.2672179,
      longitude: -97.7428744,
      accuracy: 12.4,
      altitude: 149,
    });
    assert.deepEqual(gps, {
      latitude: 30.2672179,
      longitude: -97.7428744,
      accuracy: 12.4,
      altitude: 149,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    });
    assert.equal(parseGps({ latitude: 0, longitude: 0 }), undefined);
    assert.equal(parseGps({ latitude: 200, longitude: 10 }), undefined);
    assert.equal(parseGps(null), undefined);
  });
});

describe("parseClientHints", () => {
  it("clips oversized fields", () => {
    const hints = parseClientHints({
      timezone: "America/Chicago",
      locale: "en-US",
      languages: ["en-US", "es", 12],
      userAgent: "x".repeat(1000),
      touch: true,
      cores: 8,
    });
    assert.equal(hints?.timezone, "America/Chicago");
    assert.equal(hints?.userAgent?.length, 400);
    assert.deepEqual(hints?.languages, ["en-US", "es"]);
    assert.equal(parseVisitKind("gps"), "gps");
    assert.equal(parseVisitKind("nope"), "open");
  });
});

describe("mergeGeo", () => {
  it("lets GPS + reverse geocode win for street-level place", () => {
    const merged = mergeGeo(
      [ipFix],
      { latitude: 30.267218, longitude: -97.742874, accuracy: 12 },
      {
        place: "Charles Schwab, 501 Congress Avenue, Downtown, Austin, Travis County, Texas, 78701, United States",
        houseNumber: "501",
        road: "Congress Avenue",
        neighbourhood: "Downtown",
        city: "Austin",
        district: "Travis County",
        region: "Texas",
        regionCode: "TX",
        postal: "78701",
        country: "United States",
        countryCode: "US",
        plusCode: "86247784+VQ",
        sources: ["nominatim", "bigdatacloud"],
      },
    );
    assert.equal(merged.source, "gps");
    assert.equal(merged.precision, "street");
    assert.equal(merged.houseNumber, "501");
    assert.equal(merged.road, "Congress Avenue");
    assert.equal(merged.plusCode, "86247784+VQ");
    assert.equal(merged.latitude, 30.267218);
    assert.match(merged.place ?? "", /501 Congress Avenue/);
  });

  it("uses majority city from IP sources when GPS is absent", () => {
    const merged = mergeGeo([
      ipFix,
      { city: "Austin", region: "Texas", countryCode: "US", latitude: 30.26, longitude: -97.74, sources: ["ip-api.com"] },
      { city: "Houston", region: "Texas", countryCode: "US", latitude: 29.76, longitude: -95.36, sources: ["geojs.io"] },
    ]);
    assert.equal(merged.source, "ip");
    assert.equal(merged.city, "Austin");
    assert.equal(merged.precision, "city");
    assert.ok(merged.place?.includes("Austin"));
  });
});

describe("formatVisitor", () => {
  it("includes IP, maps links, and a readable subject", () => {
    const visitor = buildVisitor({
      ip: "203.0.113.42",
      geo: {
        ...mergeGeo([ipFix]),
        place: buildPlace({
          city: "Austin",
          region: "Texas",
          postal: "78701",
          country: "United States",
        }),
      },
      client: { timezone: "America/Chicago", locale: "en-US", referrer: "https://instagram.com/" },
      device: { browser: "Safari 17", os: "iOS 17", device: "Apple iPhone mobile" },
      when: "2026-08-23T15:00:00.000Z",
    });
    const text = formatVisitor(visitor);
    assert.match(text, /IP: 203\.0\.113\.42 \(IPv4\)/);
    assert.match(text, /Austin/);
    assert.match(text, /Google Maps: https:\/\/www\.google\.com\/maps/);
    assert.match(text, /Referrer: https:\/\/instagram\.com\//);
    assert.equal(shortLocation(visitor.geo), "Austin, TX");
    assert.equal(visitSubject("open", visitor), "GF app OPENED: Austin, TX · 203.0.113.42");
    assert.equal(inferPrecision({ source: "ip", city: "Austin" }), "city");
    assert.equal(formatMeters(12.4), "12 m");
    const maps = mapsLinks(30.26, -97.74, 19);
    assert.match(maps.apple, /maps\.apple\.com/);
    assert.match(maps.osm, /openstreetmap/);
  });
});
