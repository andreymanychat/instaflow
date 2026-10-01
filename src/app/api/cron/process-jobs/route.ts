import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/server/auth/cron";
import { processDueJobs } from "@/server/services/job-queue";
import { resumeRun } from "@/server/engine/flow-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) return new NextResponse("Unauthorized", { status: 401 });

  const stats = await processDueJobs({
    resume_run: ({ runId, nodeId }) => resumeRun(runId, nodeId),
  });
  return NextResponse.json({ ok: true, ...stats });
}

export const GET = handle;
export const POST = handle;
