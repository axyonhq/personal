import { userAgent, type NextRequest } from "next/server";
import { resolveGeo } from "@/app/lib/geo";
import { extractClientIps, isPublicIp } from "@/app/lib/ip";
import {
  buildVisitor,
  parseClientHints,
  parseGps,
  type Visitor,
} from "@/app/lib/visitor";

export async function resolveVisitor(
  request: Request | NextRequest,
  input: { gps?: unknown; client?: unknown } = {},
): Promise<Visitor> {
  const gps = parseGps(input.gps);
  const client = parseClientHints(input.client);
  const extracted = extractClientIps(request.headers);
  const observed = client?.publicIp && isPublicIp(client.publicIp) ? client.publicIp : undefined;
  const headerPublic = extracted.ip && isPublicIp(extracted.ip) ? extracted.ip : undefined;
  const ip = headerPublic ?? observed ?? extracted.ip;
  const ipCandidates = [
    ...extracted.candidates,
    ...(observed && observed !== ip ? [observed] : []),
  ];
  const geo = await resolveGeo({ ip, headers: request.headers, gps });
  const parsed = userAgent(request);
  const deviceName = [parsed.device.vendor, parsed.device.model, parsed.device.type]
    .filter(Boolean)
    .join(" ");

  return buildVisitor({
    ip,
    ipCandidates,
    geo,
    client,
    device: {
      browser: [parsed.browser.name, parsed.browser.version].filter(Boolean).join(" ") || undefined,
      os: [parsed.os.name, parsed.os.version].filter(Boolean).join(" ") || undefined,
      device: deviceName || undefined,
      isBot: parsed.isBot,
    },
  });
}
