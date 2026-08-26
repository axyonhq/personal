import { getUsdAudRate } from "@/app/lib/fx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const quote = await getUsdAudRate();
  if (!quote) {
    return Response.json({ ok: false, error: "rate_unavailable" }, { status: 502 });
  }
  return Response.json({ ok: true, ...quote });
}
