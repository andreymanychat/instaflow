import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/server/auth/cron";
import { processRenewals } from "@/server/billing/billing-service";
import { isBillingConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Renovações: chamado de hora em hora pelo pg_cron (supabase/cron.sql). */
async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) return new NextResponse("Unauthorized", { status: 401 });
  if (!isBillingConfigured()) return NextResponse.json({ ok: true, skipped: "ASAAS_API_KEY ausente" });
  const summary = await processRenewals();
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
