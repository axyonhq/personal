import type { ClientHints, GpsReading, VisitKind } from "@/app/lib/visitor";

const OPEN_KEY = "gf-visit-open";
const GPS_KEY = "gf-visit-gps";
const GPS_DENIED_KEY = "gf-visit-gps-denied";

let lastGps: GpsReading | null = null;
let gpsWatchId: number | null = null;

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
  }
}

function stopWatch() {
  if (gpsWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
}

async function sendBestGps() {
  if (!lastGps || storageGet(GPS_KEY)) return;
  storageSet(GPS_KEY);
  stopWatch();
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

function startGpsWatch() {
  if (!navigator.geolocation || storageGet(GPS_KEY) || storageGet(GPS_DENIED_KEY)) return;
  if (gpsWatchId != null) return;

  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  };

  try {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        rememberGps(readFix(position));
        if ((lastGps?.accuracy ?? Infinity) <= 25) {
          void sendBestGps();
        }
      },
      onGpsError,
      options,
    );

    gpsWatchId = navigator.geolocation.watchPosition(
      (position) => {
        rememberGps(readFix(position));
        if ((lastGps?.accuracy ?? Infinity) <= 20) {
          void sendBestGps();
        }
      },
      onGpsError,
      options,
    );
  } catch {
    return;
  }

  window.setTimeout(() => {
    void sendBestGps();
  }, 12000);
}

export function startVisitTracking() {
  if (!storageGet(OPEN_KEY)) {
    storageSet(OPEN_KEY);
    void postVisit("open").catch(() => {});
  }

  startGpsWatch();

  const retry = () => startGpsWatch();
  window.addEventListener("pointerdown", retry, { once: true, passive: true });
  window.addEventListener("keydown", retry, { once: true });
}
