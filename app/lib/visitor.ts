import { mapsLinks, type GeoFix, type GpsReading } from "./geo";
import { ipKind, normalizeIp } from "./ip";

export type { GpsReading };
export type VisitKind = "open" | "gps";

export type ClientHints = {
  timezone?: string;
  locale?: string;
  languages?: string[];
  userAgent?: string;
  platform?: string;
  vendor?: string;
  screen?: string;
  viewport?: string;
  referrer?: string;
  href?: string;
  connection?: string;
  touch?: boolean;
  cores?: number;
  memoryGb?: number;
  colorScheme?: string;
  timezoneOffsetMin?: number;
  publicIp?: string;
};

export type DeviceInfo = {
  browser?: string;
  os?: string;
  device?: string;
  isBot?: boolean;
};

export type Visitor = {
  ip?: string;
  ipType: "IPv4" | "IPv6" | "unknown";
  ipCandidates?: string[];
  geo: GeoFix;
  client?: ClientHints;
  device?: DeviceInfo;
  when: string;
};

const MAX_TEXT = 240;

function clip(value: unknown, max = MAX_TEXT): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function clipNumber(value: unknown, min: number, max: number): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < min || parsed > max) return undefined;
  return parsed;
}

export function parseGps(input: unknown): GpsReading | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Record<string, unknown>;
  const latitude = clipNumber(raw.latitude, -90, 90);
  const longitude = clipNumber(raw.longitude, -180, 180);
  if (latitude == null || longitude == null) return undefined;
  if (latitude === 0 && longitude === 0) return undefined;
  const accuracy = clipNumber(raw.accuracy, 0, 5_000_000);
  const altitude = clipNumber(raw.altitude, -2000, 20000);
  return {
    latitude,
    longitude,
    accuracy,
    altitude: altitude ?? null,
    altitudeAccuracy: clipNumber(raw.altitudeAccuracy, 0, 5_000_000) ?? null,
    heading: clipNumber(raw.heading, 0, 360) ?? null,
    speed: clipNumber(raw.speed, 0, 400) ?? null,
  };
}

export function parseClientHints(input: unknown): ClientHints | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Record<string, unknown>;
  const languages = Array.isArray(raw.languages)
    ? raw.languages
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.slice(0, 32))
        .slice(0, 8)
    : undefined;
  return {
    timezone: clip(raw.timezone, 80),
    locale: clip(raw.locale, 40),
    languages,
    userAgent: clip(raw.userAgent, 400),
    platform: clip(raw.platform, 80),
    vendor: clip(raw.vendor, 80),
    screen: clip(raw.screen, 40),
    viewport: clip(raw.viewport, 40),
    referrer: clip(raw.referrer, 400),
    href: clip(raw.href, 400),
    connection: clip(raw.connection, 80),
    touch: typeof raw.touch === "boolean" ? raw.touch : undefined,
    cores: clipNumber(raw.cores, 1, 256),
    memoryGb: clipNumber(raw.memoryGb, 0.25, 128),
    colorScheme: clip(raw.colorScheme, 16),
    timezoneOffsetMin: clipNumber(raw.timezoneOffsetMin, -840, 840),
    publicIp: normalizeIp(typeof raw.publicIp === "string" ? raw.publicIp : undefined),
  };
}

export function parseVisitKind(value: unknown): VisitKind {
  return value === "gps" ? "gps" : "open";
}

function flagLine(geo: GeoFix): string | undefined {
  const flags = [
    geo.vpn ? "VPN" : undefined,
    geo.proxy ? "proxy" : undefined,
    geo.tor ? "Tor" : undefined,
    geo.hosting ? "datacenter/hosting" : undefined,
    geo.mobile ? "mobile network" : undefined,
  ].filter(Boolean);
  return flags.length ? flags.join(", ") : undefined;
}

function precisionLabel(geo: GeoFix): string {
  if (geo.source === "gps") {
    const accuracy =
      geo.accuracyMeters != null ? ` ±${formatMeters(geo.accuracyMeters)}` : "";
    switch (geo.precision) {
      case "street":
        return `GPS street-level${accuracy}`;
      case "neighborhood":
        return `GPS neighborhood-level${accuracy}`;
      case "city":
        return `GPS city-level${accuracy}`;
      default:
        return `GPS${accuracy}`;
    }
  }
  switch (geo.precision) {
    case "city":
      return "IP geolocation (city-level, typically 1–50 km)";
    case "region":
      return "IP geolocation (region-level)";
    case "country":
      return "IP geolocation (country-level)";
    default:
      return "IP geolocation (approximate)";
  }
}

export function formatMeters(meters: number): string {
  if (meters < 10) return `${meters.toFixed(1)} m`;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
}

export function shortLocation(geo: GeoFix): string {
  if (geo.houseNumber && geo.road && geo.city) {
    return `${geo.houseNumber} ${geo.road}, ${geo.city}`;
  }
  if (geo.road && geo.city) return `${geo.road}, ${geo.city}`;
  if (geo.city && (geo.regionCode || geo.region)) {
    return `${geo.city}, ${geo.regionCode || geo.region}`;
  }
  if (geo.city && geo.countryCode) return `${geo.city}, ${geo.countryCode}`;
  if (geo.region && geo.countryCode) return `${geo.region}, ${geo.countryCode}`;
  return geo.country || geo.place || "unknown location";
}

export function formatVisitor(visitor: Visitor): string {
  const { geo, client, device } = visitor;
  const lines: string[] = [];
  lines.push(`IP: ${visitor.ip || "unknown"} (${visitor.ipType})`);
  if (visitor.ip) lines.push(`IP lookup: https://ipinfo.io/${encodeURIComponent(visitor.ip)}`);
  const extras = (visitor.ipCandidates ?? []).filter((ip) => ip !== visitor.ip);
  if (extras.length) lines.push(`Other IPs on request: ${extras.join(", ")}`);
  if (client?.publicIp && client.publicIp !== visitor.ip) {
    lines.push(`Browser-observed IP: ${client.publicIp}`);
  }
  lines.push(`Location: ${geo.place || shortLocation(geo)}`);
  lines.push(`Precision: ${precisionLabel(geo)}`);
  if (geo.source !== "gps") {
    lines.push(
      "Note: this pin is the ISP city centroid (often downtown), not a street address. A public IP cannot resolve a house.",
    );
  }
  if (geo.plusCode) lines.push(`Plus code: ${geo.plusCode}`);
  if (geo.latitude != null && geo.longitude != null) {
    const acc = geo.accuracyMeters != null ? ` (±${formatMeters(geo.accuracyMeters)})` : "";
    const alt = geo.altitude != null ? ` · alt ${Math.round(geo.altitude)} m` : "";
    lines.push(`Coords: ${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)}${acc}${alt}`);
    const zoom = geo.source === "gps" && (geo.accuracyMeters ?? 100) <= 75 ? 19 : 12;
    const maps = mapsLinks(geo.latitude, geo.longitude, zoom);
    lines.push(`Google Maps: ${maps.google}`);
    lines.push(`Apple Maps: ${maps.apple}`);
    lines.push(`OpenStreetMap: ${maps.osm}`);
  }
  const network = [geo.isp, geo.org && geo.org !== geo.isp ? geo.org : undefined, geo.asn]
    .filter(Boolean)
    .join(" · ");
  if (network) lines.push(`Network: ${network}`);
  const flags = flagLine(geo);
  if (flags) lines.push(`Flags: ${flags}`);
  const timezone = geo.timezone || client?.timezone;
  if (timezone) {
    const offset =
      client?.timezoneOffsetMin != null
        ? ` (UTC${formatOffset(-client.timezoneOffsetMin)})`
        : "";
    lines.push(`Timezone: ${timezone}${offset}`);
  }
  const deviceLine = [
    device?.device,
    device?.os,
    device?.browser,
    client?.platform,
    client?.screen,
    client?.viewport ? `viewport ${client.viewport}` : undefined,
    client?.touch ? "touch" : undefined,
    client?.cores != null ? `${client.cores} cores` : undefined,
    client?.memoryGb != null ? `${client.memoryGb} GB RAM` : undefined,
    client?.connection,
  ]
    .filter(Boolean)
    .join(" · ");
  if (deviceLine) lines.push(`Device: ${deviceLine}`);
  if (client?.locale || client?.languages?.length) {
    lines.push(`Locale: ${[client.locale, ...(client.languages ?? [])].filter(Boolean).join(", ")}`);
  }
  if (client?.referrer) lines.push(`Referrer: ${client.referrer}`);
  else lines.push("Referrer: (direct / unknown)");
  if (client?.href) lines.push(`URL: ${client.href}`);
  if (geo.alsoReported?.length) lines.push(`Also reported: ${geo.alsoReported.join("; ")}`);
  if (geo.sources.length) lines.push(`Sources: ${geo.sources.join(", ")}`);
  lines.push(`When: ${visitor.when}`);
  return lines.join("\n");
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const mins = String(abs % 60).padStart(2, "0");
  return `${sign}${hours}:${mins}`;
}

export function visitSubject(kind: VisitKind, visitor: Visitor): string {
  const loc = shortLocation(visitor.geo);
  if (kind === "gps") {
    const accuracy =
      visitor.geo.accuracyMeters != null ? ` ±${formatMeters(visitor.geo.accuracyMeters)}` : "";
    return `GF app GPS: ${loc}${accuracy}`.slice(0, 180);
  }
  return `GF app OPENED: ${loc} · ${visitor.ip || "no-ip"}`.slice(0, 180);
}

export function visitTags(kind: VisitKind, geo: GeoFix): string {
  if (kind === "gps") return "satellite_antenna,round_pushpin";
  if (geo.vpn || geo.proxy || geo.tor) return "eyes,warning";
  return "eyes,round_pushpin";
}

export function buildVisitor(input: {
  ip?: string;
  ipCandidates?: string[];
  geo: GeoFix;
  client?: ClientHints;
  device?: DeviceInfo;
  when?: string;
}): Visitor {
  const candidates = [...new Set((input.ipCandidates ?? []).filter(Boolean))];
  return {
    ip: input.ip,
    ipType: ipKind(input.ip),
    ipCandidates: candidates.length ? candidates : undefined,
    geo: input.geo,
    client: input.client,
    device: input.device,
    when: input.when ?? new Date().toISOString(),
  };
}
