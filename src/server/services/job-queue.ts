import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage, log } from "@/server/services/logger";
import type { Json } from "@/types/database";

/**
 * Fila persistente no Postgres. Serverless não pode "dormir" por minutos,
 * então delays longos viram jobs com `run_at` e são executados pelo
 * endpoint /api/cron/process-jobs, acionado a cada minuto pelo pg_cron.
 */

export type JobType = "resume_run";

export type JobPayloads = {
  resume_run: { runId: string; nodeId: string };
};

type JobHandler<T extends JobType> = (payload: JobPayloads[T]) => Promise<void>;
type HandlerRegistry = { [K in JobType]: JobHandler<K> };

export async function enqueueJob<T extends JobType>(params: {
  type: T;
  payload: JobPayloads[T];
  runAt: Date;
  organizationId: string | null;
}) {
  const { error } = await createAdminClient()
    .from("scheduled_jobs")
    .insert({
      type: params.type,
      payload: params.payload as unknown as Json,
      run_at: params.runAt.toISOString(),
      organization_id: params.organizationId,
    });
  if (error) throw error;
}

export async function processDueJobs(handlers: HandlerRegistry, options: { batchSize?: number; deadlineMs?: number } = {}) {
  const admin = createAdminClient();
  const deadline = Date.now() + (options.deadlineMs ?? 45_000);
  const stats = { processed: 0, failed: 0 };

  while (Date.now() < deadline) {
    const { data: jobs, error } = await admin.rpc("claim_due_jobs", { batch_size: options.batchSize ?? 20 });
    if (error) throw error;
    if (!jobs || jobs.length === 0) break;

    await Promise.all(
      jobs.map(async (job) => {
        try {
          const handler = handlers[job.type as JobType] as JobHandler<JobType> | undefined;
          if (!handler) throw new Error(`Tipo de job desconhecido: ${job.type}`);
          await handler(job.payload as unknown as JobPayloads[JobType]);
          await admin.from("scheduled_jobs").update({ status: "done", locked_at: null }).eq("id", job.id);
          stats.processed++;
        } catch (err) {
          stats.failed++;
          const exhausted = job.attempts >= job.max_attempts;
          const backoffMs = 60_000 * 2 ** (job.attempts - 1);
          await admin
            .from("scheduled_jobs")
            .update({
              status: exhausted ? "failed" : "pending",
              locked_at: null,
              last_error: errorMessage(err),
              run_at: new Date(Date.now() + backoffMs).toISOString(),
            })
            .eq("id", job.id);
          await log({
            organizationId: job.organization_id,
            level: exhausted ? "error" : "warn",
            source: "jobs",
            event: exhausted ? "job_failed" : "job_retry",
            message: `Job ${job.type} falhou (tentativa ${job.attempts}/${job.max_attempts}): ${errorMessage(err)}`,
            metadata: { job_id: job.id },
          });
        }
      }),
    );
  }
  return stats;
}
