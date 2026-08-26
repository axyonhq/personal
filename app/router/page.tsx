import type { Metadata } from "next";
import { CashRouter } from "@/app/components/cash-router";
import { getUsdAudRate } from "@/app/lib/fx";

export const metadata: Metadata = {
  title: "Cash Router",
  description:
    "Route incoming USD across buckets in USD or AUD at the live conversion rate. Session only.",
};

export const dynamic = "force-dynamic";

export default async function RouterPage() {
  const initialRate = await getUsdAudRate();
  return <CashRouter initialRate={initialRate} />;
}
