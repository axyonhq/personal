import { userAgent } from "next/server";
import { fanoutNotify, NTFY_TOPIC, shouldSkipDuplicate } from "@/app/lib/notify";
import { resolveVisitor } from "@/app/lib/resolve-visitor";
import { formatVisitor, parseVisitKind, visitSubject, visitTags } from "@/app/lib/visitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const kind = parseVisitKind(raw.kind);
  const { isBot } = userAgent(request);
  if (isBot) {
    return Response.json({ ok: true, skipped: "bot" });
  }

  const visitor = await resolveVisitor(request, {
    gps: raw.gps,
    client: raw.client,
  });

  if (kind === "gps" && visitor.geo.source !== "gps") {
    return Response.json({ ok: true, skipped: "no_gps" });
  }

  const dedupeKey = `${kind}:${visitor.ip || "unknown"}:${visitor.geo.place || ""}`;
  if (shouldSkipDuplicate(dedupeKey)) {
    return Response.json({ ok: true, skipped: "duplicate" });
  }

  const headline = kind === "gps" ? "GPS LOCK — GIRLFRIEND APPLICATION" : "SOMEONE OPENED THE GIRLFRIEND APPLICATION";
  const text = `${headline}\n\n${formatVisitor(visitor)}`;
  const errors = await fanoutNotify({
    subject: visitSubject(kind, visitor),
    text,
    tags: visitTags(kind, visitor.geo),
    emailFields: {
      ip: visitor.ip || "",
      location: visitor.geo.place || "",
      kind,
    },
  });

  return Response.json({
    ok: errors.length === 0,
    errors,
    ntfy: `https://ntfy.sh/${NTFY_TOPIC}`,
  });
}
