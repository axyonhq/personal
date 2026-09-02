import { decideDate, loadPuzzleState, unlockHint, viewFor } from "@/app/lib/discovery-store";
import type { DateDecision } from "@/app/lib/date-puzzle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ERROR_STATUS: Record<string, number> = {
  unknown_hint: 400,
  unknown_date: 400,
  not_accepted: 403,
  already_unlocked: 409,
  no_credit: 409,
  already_decided: 409,
};

function fail(error: unknown, fallback = "store_failed") {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : fallback;
  const code = name && ERROR_STATUS[name] ? name : message || fallback;
  const status = ERROR_STATUS[code] ?? 500;
  console.error("discovery_api_failed", error);
  return Response.json({ ok: false, error: code }, { status });
}

export async function GET() {
  try {
    const state = await loadPuzzleState();
    return Response.json({ ok: true, ...viewFor(state) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  let body: { action?: string; dateId?: string; decision?: string; hintId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    if (body.action === "decide") {
      const decision = body.decision === "rejected" ? "rejected" : body.decision === "accepted" ? "accepted" : null;
      if (!body.dateId || !decision) {
        return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
      }
      const state = await decideDate(body.dateId, decision as DateDecision);
      return Response.json({ ok: true, ...viewFor(state) });
    }

    if (body.action === "unlock") {
      if (!body.hintId) {
        return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
      }
      const state = await unlockHint(body.hintId);
      return Response.json({ ok: true, ...viewFor(state) });
    }

    return Response.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch (error) {
    return fail(error);
  }
}
