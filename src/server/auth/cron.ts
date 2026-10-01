import "server-only";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";

/** Endpoints de cron aceitam apenas `Authorization: Bearer <CRON_SECRET>` (pg_cron ou Vercel Cron). */
export function isAuthorizedCron(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${env().CRON_SECRET}`);
}
