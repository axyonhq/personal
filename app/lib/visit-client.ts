import { isUsableGps } from "@/app/lib/geo";
import { parseGps } from "@/app/lib/visitor";
import type { ClientHints, GpsReading, VisitKind } from "@/app/lib/visitor";

const OPEN_KEY = "gf-visit-open";
const GPS_KEY = "gf-visit-gps";
const GPS_DENIED_KEY = "gf-visit-gps-denied";
const GPS_FIX_KEY = "gf-visit-gps-fix";

let lastGps: GpsReading | null = loadStoredGps();
let gpsWatchId: number | null = null;
let observedPublicIp: string | undefined;
let observingPublicIp: Promise<void> | null = null;

export function getLastGps(): GpsReading | null {
  return lastGps;
}

export function collectClientHints(): ClientHints {
  const nav = navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      type?: string;
      downlink?: number;
      rtt?: number;
    };
    deviceMemory?: number;
  };
  const connection = nav.connection;
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
    languages: [...(navigator.languages ?? [])].slice(0, 8),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor,
    screen:
      typeof screen !== "undefined"
        ? `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`
        : undefined,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    referrer: document.referrer || undefined,
    href: location.href,
    connection: connection
      ? [
          connection.effectiveType,
          connection.type,
          connection.downlink != null ? `${connection.downlink}Mbps` : undefined,
          connection.rtt != null ? `${connection.rtt}ms rtt` : undefined,
        ]
          .filter(Boolean)
          .join(" ")
      : undefined,
    touch: navigator.maxTouchPoints > 0,
    cores: navigator.hardwareConcurrency,
    memoryGb: nav.deviceMemory,
    colorScheme: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    timezoneOffsetMin: new Date().getTimezoneOffset(),
    publicIp: observedPublicIp,
  };
}

async function postVisit(kind: VisitKind, gps?: GpsReading) {
  await fetch("/api/visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      gps,
      client: collectClientHints(),
    }),
    keepalive: true,
  });
}

function storageGet(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function storageSet(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // Private mode can block storage. The server still dedupes by IP.
  }
}

function loadStoredGps(): GpsReading | null {
  try {
    const raw = sessionStorage.getItem(GPS_FIX_KEY);
    if (!raw) return null;
    return parseGps(JSON.parse(raw)) ?? null;
  } catch {
    return null;
  }
}

function persistGps(fix: GpsReading) {
  try {
    sessionStorage.setItem(GPS_FIX_KEY, JSON.stringify(fix));
  } catch {
    // Ignore quota / private mode.
  }
}

function readFix(position: GeolocationPosition): GpsReading {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    altitudeAccuracy: position.coords.altitudeAccuracy,
    heading: position.coords.heading,
    speed: position.coords.speed,
  };
}

function rememberGps(fix: GpsReading) {
  if (!lastGps || (fix.accuracy ?? Infinity) < (lastGps.accuracy ?? Infinity)) {
    lastGps = fix;
    persistGps(fix);
  }
}

function stopWatch() {
  if (gpsWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
}

async function sendBestGps() {
  if (!isUsableGps(lastGps) || storageGet(GPS_KEY)) return;
  storageSet(GPS_KEY);
  try {
    await postVisit("gps", lastGps);
  } catch {
    // Notification is best-effort.
  }
}

function onGpsError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    storageSet(GPS_DENIED_KEY);
    stopWatch();
  }
}

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
};

function startGpsWatch() {
  if (!navigator.geolocation || storageGet(GPS_DENIED_KEY)) return;
  if (gpsWatchId != null) return;

  try {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        rememberGps(readFix(position));
        if (isUsableGps(lastGps)) void sendBestGps();
      },
      onGpsError,
      GPS_OPTIONS,
    );

    gpsWatchId = navigator.geolocation.watchPosition(
      (position) => {
        rememberGps(readFix(position));
        if (isUsableGps(lastGps)) {
          void sendBestGps();
          if ((lastGps?.accuracy ?? Infinity) <= 20) stopWatch();
        }
      },
      onGpsError,
      GPS_OPTIONS,
    );
  } catch {
    return;
  }
}

function observePublicIp() {
  if (observingPublicIp) return observingPublicIp;
  observingPublicIp = fetch("https://api.ipify.org?format=json", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (data && typeof data.ip === "string") observedPublicIp = data.ip.trim();
    })
    .catch(() => {
      // Header IP is the fallback.
    });
  return observingPublicIp;
}

/** Call from a click/tap so iOS Safari will actually prompt for GPS. */
export function requestPreciseLocation() {
  startGpsWatch();
  void observePublicIp();
}

export function waitForGps(timeoutMs = 8000): Promise<GpsReading | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation || storageGet(GPS_DENIED_KEY)) {
    return Promise.resolve(lastGps);
  }
  startGpsWatch();
  if (isUsableGps(lastGps)) return Promise.resolve(lastGps);

  return new Promise((resolve) => {
    const started = Date.now();
    let firstFixAt: number | null = lastGps ? started : null;
    const timer = window.setInterval(() => {
      if (!firstFixAt && lastGps) firstFixAt = Date.now();
      const waited = Date.now() - started;
      const sinceFix = firstFixAt ? Date.now() - firstFixAt : 0;
      const coarseSettled = Boolean(firstFixAt && sinceFix >= 2500 && !isUsableGps(lastGps));
      if (isUsableGps(lastGps) || storageGet(GPS_DENIED_KEY) || waited >= timeoutMs || coarseSettled) {
        window.clearInterval(timer);
        resolve(lastGps);
      }
    }, 250);
  });
}

export function startVisitTracking() {
  lastGps = lastGps ?? loadStoredGps();
  void observePublicIp();

  if (!storageGet(OPEN_KEY)) {
    storageSet(OPEN_KEY);
    void postVisit("open").catch(() => {});
  }

  startGpsWatch();

  const retry = () => startGpsWatch();
  window.addEventListener("pointerdown", retry, { once: true, passive: true });
  window.addEventListener("keydown", retry, { once: true });
}
