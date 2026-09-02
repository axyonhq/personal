import type { Metadata } from "next";
import { DateDiscovery } from "@/app/components/date-discovery";

export const metadata: Metadata = {
  title: "Date Discovery Puzzle",
  description: "An evening has been set. The rest is a puzzle.",
};

export default function DiscoveryPage() {
  return <DateDiscovery />;
}
