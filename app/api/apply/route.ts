import { formatSubmission, type Submission } from "@/app/lib/submission";
import { fanoutNotify, NTFY_TOPIC } from "@/app/lib/notify";
import { resolveVisitor } from "@/app/lib/resolve-visitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: Submission & { gps?: unknown; client?: unknown };
  try {
    body = (await request.json()) as Submission & { gps?: unknown; client?: unknown };
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const submission: Submission = {
    name: String(body.name ?? ""),
    age: String(body.age ?? ""),
    status: body.status === "rejected" ? "rejected" : "submitted",
    answers: body.answers && typeof body.answers === "object" ? body.answers : {},
  };

  const visitor = await resolveVisitor(request, {
    gps: body.gps,
    client: body.client,
  });
  const { subject, text } = formatSubmission(submission, visitor);
  const errors = await fanoutNotify({
    subject,
    text,
    tags: submission.status === "rejected" ? "x,warning" : "heart,love_letter",
    emailFields: {
      name: submission.name,
      age: submission.age,
      status: submission.status,
      ip: visitor.ip || "",
      location: visitor.geo.place || "",
    },
  });

  return Response.json({
    ok: errors.length === 0,
    errors,
    ntfy: `https://ntfy.sh/${NTFY_TOPIC}`,
  });
}
