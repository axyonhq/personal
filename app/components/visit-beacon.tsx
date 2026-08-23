"use client";

import { useEffect } from "react";
import { startVisitTracking } from "@/app/lib/visit-client";

export function VisitBeacon() {
  useEffect(() => {
    startVisitTracking();
  }, []);

  return null;
}
