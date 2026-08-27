export type GpsReading = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
};

export type GeoPrecision = "street" | "neighborhood" | "city" | "region" | "country" | "unknown";

export type GeoFix = {
  source: "gps" | "ip";
  precision: GeoPrecision;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  altitude?: number;
  place?: string;
  houseNumber?: string;
  road?: string;
  neighbourhood?: string;
  district?: string;
  city?: string;
  region?: string;
  regionCode?: string;
  postal?: string;
  country?: string;
  countryCode?: string;
  plusCode?: string;
  timezone?: string;
  isp?: string;
  org?: string;
  asn?: string;
  mobile?: boolean;
  proxy?: boolean;
  hosting?: boolean;
  vpn?: boolean;
  tor?: boolean;
  sources: string[];
  alsoReported?: string[];
};

export type PlatformGeo = {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

type Loose = Record<string, unknown>;

function asRecord(value: unknown): Loose | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Loose)
    : undefined;
}

function str(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed && trimmed !== "undefined" && trimmed !== "null") return trimmed;
  }
  return undefined;
}

function num(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function bool(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

function decodeHeader(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value.replace(/\+/g, " ")).trim() || undefined;
  } catch {
    return value.trim() || undefined;
  }
}

export function platformGeoFromHeaders(headers: Headers): PlatformGeo {
  return {
    city: decodeHeader(headers.get("x-vercel-ip-city") ?? headers.get("cf-ipcity")),
    region: decodeHeader(
      headers.get("x-vercel-ip-country-region") ?? headers.get("cf-region") ?? headers.get("cf-region-code"),
    ),
    countryCode: decodeHeader(headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry"))
      ?.toUpperCase(),
    latitude: num(headers.get("x-vercel-ip-latitude")),
    longitude: num(headers.get("x-vercel-ip-longitude")),
    timezone: decodeHeader(headers.get("x-vercel-ip-timezone")),
  };
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 2800): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function fromIpwho(data: unknown): Partial<GeoFix> | undefined {
  const json = asRecord(data);
  if (!json || json.success === false) return undefined;
  const connection = asRecord(json.connection);
  const timezone = asRecord(json.timezone);
  return {
    city: str(json.city),
    region: str(json.region),
    regionCode: str(json.region_code),
    postal: str(json.postal),
    country: str(json.country),
    countryCode: str(json.country_code)?.toUpperCase(),
    latitude: num(json.latitude),
    longitude: num(json.longitude),
    timezone: str(timezone?.id, json.timezone),
    isp: str(connection?.isp),
    org: str(connection?.org),
    asn: connection?.asn != null ? `AS${connection.asn}` : undefined,
    sources: ["ipwho.is"],
  };
}

function fromIpApi(data: unknown): Partial<GeoFix> | undefined {
  const json = asRecord(data);
  if (!json || json.status !== "success") return undefined;
  return {
    city: str(json.city),
    district: str(json.district),
    region: str(json.regionName),
    regionCode: str(json.region),
    postal: str(json.zip),
    country: str(json.country),
    countryCode: str(json.countryCode)?.toUpperCase(),
    latitude: num(json.lat),
    longitude: num(json.lon),
    timezone: str(json.timezone),
    isp: str(json.isp),
    org: str(json.org),
    asn: str(json.as),
    mobile: bool(json.mobile),
    proxy: bool(json.proxy),
    hosting: bool(json.hosting),
    sources: ["ip-api.com"],
  };
}

function fromGeoJs(data: unknown): Partial<GeoFix> | undefined {
  const json = asRecord(data);
  if (!json) return undefined;
  return {
    city: str(json.city),
    region: str(json.region),
    country: str(json.country),
    countryCode: str(json.country_code)?.toUpperCase(),
    latitude: num(json.latitude),
    longitude: num(json.longitude),
    timezone: str(json.timezone),
    org: str(json.organization_name, json.organization),
    asn: json.asn != null ? `AS${json.asn}` : undefined,
    sources: ["geojs.io"],
  };
}

function fromIpapiIs(data: unknown): Partial<GeoFix> | undefined {
  const json = asRecord(data);
  if (!json) return undefined;
  return {
    city: str(json.city),
    region: str(json.state, json.region),
    countryCode: str(json.cc, json.country_code)?.toUpperCase(),
    latitude: num(json.lat, json.latitude),
    longitude: num(json.lon, json.longitude),
    org: str(json.company_name, json.asn_org),
    asn: json.asn_num != null ? `AS${json.asn_num}` : undefined,
    hosting: bool(json.is_datacenter),
    proxy: bool(json.is_proxy),
    vpn: bool(json.is_vpn),
    tor: bool(json.is_tor),
    sources: ["ipapi.is"],
  };
}

function fromPlatform(platform: PlatformGeo): Partial<GeoFix> | undefined {
  if (
    !platform.city &&
    !platform.region &&
    !platform.countryCode &&
    platform.latitude == null
  ) {
    return undefined;
  }
  return {
    city: platform.city,
    region: platform.region,
    countryCode: platform.countryCode,
    country: platform.country,
    latitude: platform.latitude,
    longitude: platform.longitude,
    timezone: platform.timezone,
    sources: ["edge-headers"],
  };
}

export async function lookupIpGeo(ip: string | undefined, platform: PlatformGeo): Promise<Partial<GeoFix>[]> {
  const lookups: Promise<Partial<GeoFix> | undefined>[] = [Promise.resolve(fromPlatform(platform))];

  if (ip) {
    lookups.push(
      fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`).then(fromIpwho),
      fetchJson(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query`,
      ).then(fromIpApi),
      fetchJson(`https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`).then(fromGeoJs),
      fetchJson(`https://api.ipapi.is/?q=${encodeURIComponent(ip)}`).then(fromIpapiIs),
    );
  } else {
    lookups.push(fetchJson("https://ipwho.is/").then(fromIpwho));
  }

  const settled = await Promise.all(lookups);
  return settled.filter((item): item is Partial<GeoFix> => Boolean(item));
}

type ReverseGeo = {
  place?: string;
  houseNumber?: string;
  road?: string;
  neighbourhood?: string;
  district?: string;
  city?: string;
  region?: string;
  regionCode?: string;
  postal?: string;
  country?: string;
  countryCode?: string;
  plusCode?: string;
  sources: string[];
};

function fromNominatim(data: unknown): ReverseGeo | undefined {
  const json = asRecord(data);
  if (!json) return undefined;
  const address = asRecord(json.address);
  return {
    place: str(json.display_name),
    houseNumber: str(address?.house_number),
    road: str(address?.road, address?.pedestrian, address?.footway, address?.path),
    neighbourhood: str(
      address?.neighbourhood,
      address?.suburb,
      address?.quarter,
      address?.city_district,
    ),
    district: str(address?.county, address?.city_district),
    city: str(address?.city, address?.town, address?.village, address?.municipality, address?.hamlet),
    region: str(address?.state, address?.region),
    regionCode: str(address?.["ISO3166-2-lvl4"])?.split("-").at(-1),
    postal: str(address?.postcode),
    country: str(address?.country),
    countryCode: str(address?.country_code)?.toUpperCase(),
    sources: ["nominatim"],
  };
}

function fromBigData(data: unknown): ReverseGeo | undefined {
  const json = asRecord(data);
  if (!json) return undefined;
  const informative = Array.isArray(asRecord(json.localityInfo)?.informative)
    ? (asRecord(json.localityInfo)?.informative as unknown[])
    : [];
  const neighbourhood = informative
    .map((item) => asRecord(item))
    .find((item) => {
      const description = str(item?.description)?.toLowerCase() ?? "";
      return description.includes("neighbour") || description.includes("neighborhood");
    });
  return {
    place: [
      str(json.locality),
      str(json.city),
      str(json.principalSubdivision),
      str(json.postcode),
      str(json.countryName),
    ]
      .filter(Boolean)
      .join(", "),
    neighbourhood: str(neighbourhood?.name),
    city: str(json.city, json.locality),
    region: str(json.principalSubdivision),
    regionCode: str(json.principalSubdivisionCode)?.split("-").at(-1),
    postal: str(json.postcode),
    country: str(json.countryName),
    countryCode: str(json.countryCode)?.toUpperCase(),
    plusCode: str(json.plusCode),
    sources: ["bigdatacloud"],
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeo | undefined> {
  const [nominatim, bigdata] = await Promise.all([
    fetchJson(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&addressdetails=1&zoom=18`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "GirlfriendApplication/1.0 (visit-notify)",
        },
      },
      3500,
    ).then(fromNominatim),
    fetchJson(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      {},
      3500,
    ).then(fromBigData),
  ]);

  if (!nominatim && !bigdata) return undefined;
  return {
    place: nominatim?.place ?? bigdata?.place,
    houseNumber: nominatim?.houseNumber,
    road: nominatim?.road,
    neighbourhood: nominatim?.neighbourhood ?? bigdata?.neighbourhood,
    district: nominatim?.district,
    city: nominatim?.city ?? bigdata?.city,
    region: nominatim?.region ?? bigdata?.region,
    regionCode: nominatim?.regionCode ?? bigdata?.regionCode,
    postal: nominatim?.postal ?? bigdata?.postal,
    country: nominatim?.country ?? bigdata?.country,
    countryCode: nominatim?.countryCode ?? bigdata?.countryCode,
    plusCode: bigdata?.plusCode,
    sources: [...(nominatim?.sources ?? []), ...(bigdata?.sources ?? [])],
  };
}

function prefer<T>(...values: Array<T | undefined>): T | undefined {
  return values.find((value) => value !== undefined && value !== "");
}

function majorityString(values: Array<string | undefined>): string | undefined {
  const counts = new Map<string, { value: string; count: number }>();
  for (const value of values) {
    if (!value) continue;
    const key = value.toLowerCase();
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { value, count: 1 });
  }
  const ranked = [...counts.values()].sort(
    (a, b) => b.count - a.count || b.value.length - a.value.length,
  );
  return ranked[0]?.value;
}

function regionFields(items: Partial<GeoFix>[]): { region?: string; regionCode?: string } {
  const names = items
    .map((item) => item.region)
    .filter((value): value is string => typeof value === "string" && value.length > 2);
  const codes = items
    .map((item) => {
      if (item.regionCode) return item.regionCode;
      if (item.region && /^[A-Z]{2}$/i.test(item.region)) return item.region;
      return undefined;
    })
    .filter((value): value is string => Boolean(value));
  return {
    region: majorityString(names) ?? majorityString(items.map((item) => item.region)),
    regionCode: majorityString(codes)?.toUpperCase(),
  };
}

function sourceLabel(item: Partial<GeoFix>): string {
  return (item.sources ?? []).join("/") || "unknown";
}

function describeSource(item: Partial<GeoFix>): string {
  const place = [item.city, item.region || item.regionCode, item.postal].filter(Boolean).join(", ");
  return place ? `${place} (${sourceLabel(item)})` : sourceLabel(item);
}

function clusterByCity(sources: Partial<GeoFix>[]): {
  winner: Partial<GeoFix>[];
  alsoReported: string[];
} {
  const clusters = new Map<string, Partial<GeoFix>[]>();
  const noCity: Partial<GeoFix>[] = [];
  for (const source of sources) {
    const key = source.city?.trim().toLowerCase();
    if (!key) {
      noCity.push(source);
      continue;
    }
    const list = clusters.get(key) ?? [];
    list.push(source);
    clusters.set(key, list);
  }

  const ranked = [...clusters.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    const richness = (items: Partial<GeoFix>[]) =>
      items.reduce(
        (score, item) =>
          score +
          (item.postal ? 2 : 0) +
          (item.region ? 1 : 0) +
          (item.latitude != null && item.longitude != null ? 1 : 0),
        0,
      );
    return richness(b[1]) - richness(a[1]);
  });

  const winner = ranked[0]?.[1] ?? sources;
  const alsoReported = ranked.slice(1).flatMap(([, items]) => items.map(describeSource));
  return { winner, alsoReported };
}

function clusteredCoords(items: Partial<GeoFix>[], extras: Partial<GeoFix>[] = []): {
  latitude?: number;
  longitude?: number;
} {
  const primary = items.filter(
    (item): item is Partial<GeoFix> & { latitude: number; longitude: number } =>
      item.latitude != null && item.longitude != null,
  );
  if (primary.length === 0) return {};
  const seedLat = median(primary.map((item) => item.latitude));
  const seedLon = median(primary.map((item) => item.longitude));
  if (seedLat == null || seedLon == null) return {};

  const extrasClose = extras.filter(
    (item) =>
      item.latitude != null &&
      item.longitude != null &&
      Math.hypot(item.latitude - seedLat, item.longitude - seedLon) < 1.25,
  );
  const pool = [...primary, ...extrasClose];
  const lat = median(pool.map((item) => item.latitude!).filter((value) => value != null));
  const lon = median(pool.map((item) => item.longitude!).filter((value) => value != null));
  return { latitude: lat, longitude: lon };
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Browser IP/WiFi geolocation often reports 1–50 km accuracy and a city centroid. */
export const USABLE_GPS_METERS = 250;

export function isUsableGps(gps: GpsReading | undefined | null): gps is GpsReading {
  return gps != null && gps.accuracy != null && gps.accuracy > 0 && gps.accuracy <= USABLE_GPS_METERS;
}

export function inferPrecision(fix: Pick<GeoFix, "houseNumber" | "road" | "neighbourhood" | "city" | "region" | "country" | "source" | "accuracyMeters">): GeoPrecision {
  if (fix.source === "gps") {
    const accuracy = fix.accuracyMeters;
    if (accuracy != null && accuracy > 1000) {
      if (fix.city) return "city";
      if (fix.region) return "region";
      if (fix.country) return "country";
      return "unknown";
    }
    if (fix.houseNumber && fix.road && (accuracy == null || accuracy <= 50)) return "street";
    if (fix.road || (accuracy != null && accuracy <= 50)) return "street";
    if (fix.neighbourhood || (accuracy != null && accuracy <= 300)) {
      return "neighborhood";
    }
    if (accuracy != null && accuracy <= 5000) return "city";
  }
  if (fix.source === "ip") {
    if (fix.city) return "city";
    if (fix.region) return "region";
    if (fix.country) return "country";
    return "unknown";
  }
  if (fix.houseNumber && fix.road) return "street";
  if (fix.neighbourhood) return "neighborhood";
  if (fix.city) return "city";
  if (fix.region) return "region";
  if (fix.country) return "country";
  return "unknown";
}

export function buildPlace(fix: Pick<GeoFix, "houseNumber" | "road" | "neighbourhood" | "district" | "city" | "region" | "postal" | "country">): string | undefined {
  const street = [fix.houseNumber, fix.road].filter(Boolean).join(" ").trim();
  const parts = [
    street || undefined,
    fix.neighbourhood,
    fix.city,
    fix.district && fix.district !== fix.city ? fix.district : undefined,
    [fix.region, fix.postal].filter(Boolean).join(" ") || undefined,
    fix.country,
  ].filter((item): item is string => Boolean(item));
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.some((item) => item.toLowerCase() === part.toLowerCase())) unique.push(part);
  }
  return unique.join(", ") || undefined;
}

export function mergeGeo(
  sources: Partial<GeoFix>[],
  gps?: GpsReading,
  reverse?: ReverseGeo,
): GeoFix {
  const preciseGps = isUsableGps(gps) ? gps : undefined;
  const reverseUse = preciseGps ? reverse : undefined;
  const sourceNames = [
    ...sources.flatMap((item) => item.sources ?? []),
    ...(reverseUse?.sources ?? []),
    ...(preciseGps ? ["browser-gps"] : []),
  ];
  const { winner, alsoReported } = clusterByCity(sources);
  const noCity = sources.filter((item) => !item.city);
  const regions = regionFields(winner);
  const coords = clusteredCoords(winner, noCity);

  const base: GeoFix = {
    source: preciseGps ? "gps" : "ip",
    precision: "unknown",
    city: prefer(reverseUse?.city, majorityString(winner.map((item) => item.city))),
    region: prefer(reverseUse?.region, regions.region),
    regionCode: prefer(reverseUse?.regionCode, regions.regionCode),
    postal: prefer(reverseUse?.postal, majorityString(winner.map((item) => item.postal))),
    country: prefer(reverseUse?.country, majorityString(winner.map((item) => item.country))),
    countryCode: prefer(
      reverseUse?.countryCode,
      majorityString(winner.map((item) => item.countryCode)),
    ),
    district: prefer(reverseUse?.district, majorityString(winner.map((item) => item.district))),
    neighbourhood: prefer(
      reverseUse?.neighbourhood,
      majorityString(winner.map((item) => item.neighbourhood)),
    ),
    houseNumber: reverseUse?.houseNumber,
    road: reverseUse?.road,
    plusCode: reverseUse?.plusCode,
    timezone: prefer(
      majorityString(winner.map((item) => item.timezone)),
      majorityString(sources.map((item) => item.timezone)),
    ),
    isp: prefer(...sources.map((item) => item.isp)),
    org: prefer(...sources.map((item) => item.org)),
    asn: prefer(...sources.map((item) => item.asn)),
    mobile: sources.find((item) => item.mobile !== undefined)?.mobile,
    proxy: sources.some((item) => item.proxy) || undefined,
    hosting: sources.some((item) => item.hosting) || undefined,
    vpn: sources.some((item) => item.vpn) || undefined,
    tor: sources.some((item) => item.tor) || undefined,
    sources: [...new Set(sourceNames)],
    alsoReported: alsoReported.length ? alsoReported : undefined,
  };

  if (preciseGps) {
    base.latitude = preciseGps.latitude;
    base.longitude = preciseGps.longitude;
    base.accuracyMeters = preciseGps.accuracy;
    if (preciseGps.altitude != null) base.altitude = preciseGps.altitude;
    base.place = reverseUse?.place ?? buildPlace(base);
    base.alsoReported = undefined;
  } else {
    base.latitude = coords.latitude;
    base.longitude = coords.longitude;
    base.place = buildPlace(base);
  }

  base.precision = inferPrecision(base);
  return base;
}

export function mapsLinks(lat: number, lon: number, zoom = 18): {
  google: string;
  apple: string;
  osm: string;
} {
  const q = `${lat},${lon}`;
  return {
    google: `https://www.google.com/maps?q=${q}&z=${zoom}`,
    apple: `https://maps.apple.com/?ll=${q}&q=${encodeURIComponent("Applicant")}&z=${zoom}`,
    osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`,
  };
}

export async function resolveGeo(options: {
  ip?: string;
  headers: Headers;
  gps?: GpsReading;
}): Promise<GeoFix> {
  const platform = platformGeoFromHeaders(options.headers);
  const ipSources = await lookupIpGeo(options.ip, platform);
  const gps = isUsableGps(options.gps) ? options.gps : undefined;
  const reverse = gps ? await reverseGeocode(gps.latitude, gps.longitude) : undefined;
  return mergeGeo(ipSources, gps, reverse);
}
