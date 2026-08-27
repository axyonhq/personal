const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

const IP_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-real-ip",
  "x-vercel-forwarded-for",
  "fly-client-ip",
  "x-client-ip",
  "fastly-client-ip",
  "x-cluster-client-ip",
  "forwarded",
  "x-forwarded-for",
] as const;

export function normalizeIp(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  let value = raw.trim();
  if (!value) return undefined;

  if (value.toLowerCase().startsWith("for=")) {
    value = value.slice(4).trim();
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (value.startsWith("[") && value.includes("]")) {
    value = value.slice(1, value.indexOf("]"));
  }

  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) value = mapped[1];

  const ipv4WithPort = value.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) value = ipv4WithPort[1];

  value = value.trim();
  return isValidIp(value) ? value : undefined;
}

export function isValidIp(value: string): boolean {
  return IPV4.test(value) || isIpv6(value);
}

export function isIpv6(value: string): boolean {
  if (!value.includes(":")) return false;
  if (value.startsWith("[") || value.endsWith("]")) return false;
  if ((value.match(/::/g) || []).length > 1) return false;
  const parts = value.split(":");
  if (parts.length < 3 || parts.length > 8) return false;
  return parts.every((part) => part === "" || /^[0-9a-fA-F]{1,4}$/.test(part));
}

export function isPublicIp(ip: string): boolean {
  if (IPV4.test(ip)) return isPublicIpv4(ip);
  if (isIpv6(ip)) return isPublicIpv6(ip);
  return false;
}

function isPublicIpv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIpv6(ip: string): boolean {
  const lowered = ip.toLowerCase();
  if (lowered === "::1" || lowered === "::") return false;
  if (lowered.startsWith("fe80:")) return false;
  if (lowered.startsWith("fc") || lowered.startsWith("fd")) return false;
  if (lowered.startsWith("ff")) return false;
  return true;
}

export function firstPublicIp(list: string): string | undefined {
  const parts = list.split(",").map((part) => normalizeIp(part.split(";")[0]));
  return (
    parts.find((ip): ip is string => ip != null && isPublicIp(ip)) ??
    parts.find((ip): ip is string => ip != null)
  );
}

export function extractClientIps(headers: Headers): { ip?: string; candidates: string[] } {
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const name of IP_HEADERS) {
    const raw = headers.get(name);
    if (!raw) continue;
    const parts =
      name === "x-forwarded-for" || name === "forwarded" ? raw.split(",") : [raw];
    for (const part of parts) {
      const ip = normalizeIp(part.split(";")[0]);
      if (!ip || seen.has(ip)) continue;
      seen.add(ip);
      candidates.push(ip);
    }
  }

  const ip = candidates.find((value) => isPublicIp(value)) ?? candidates[0];
  return { ip, candidates };
}

export function extractClientIp(headers: Headers): string | undefined {
  return extractClientIps(headers).ip;
}

export function ipKind(ip: string | undefined): "IPv4" | "IPv6" | "unknown" {
  if (!ip) return "unknown";
  if (IPV4.test(ip)) return "IPv4";
  if (isIpv6(ip)) return "IPv6";
  return "unknown";
}
