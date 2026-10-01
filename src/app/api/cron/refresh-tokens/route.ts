import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/server/auth/cron";
import { refreshExpiringTokens } from "@/server/services/instagram-account-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) return new NextResponse("Unauthorized", { status: 401 });
  const result = await refreshExpiringTokens();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
