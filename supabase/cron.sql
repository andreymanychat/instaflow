-- =============================================================================
-- Agendador (pg_cron + pg_net) — executar UMA VEZ no SQL Editor do Supabase
-- depois do primeiro deploy na Vercel.
--
-- Por que não Vercel Cron? No plano Hobby a Vercel só permite cron diário.
-- O Supabase (grátis) permite pg_cron a cada minuto, então é ele quem "acorda"
-- o nosso endpoint para processar delays, retomadas de fluxo e refresh de tokens.
--
-- Substitua:
--   https://SEU-PROJETO.vercel.app  -> URL pública do app
--   SEU_CRON_SECRET                 -> mesmo valor da env CRON_SECRET na Vercel
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamentos anteriores (permite rodar o script de novo)
select cron.unschedule(jobname) from cron.job
where jobname in ('instaflow-process-jobs', 'instaflow-refresh-tokens', 'instaflow-cleanup');

-- Processa a fila a cada minuto
select cron.schedule(
  'instaflow-process-jobs',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://SEU-PROJETO.vercel.app/api/cron/process-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer SEU_CRON_SECRET'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- Renova tokens do Instagram (válidos por 60 dias) diariamente às 03:00 UTC
select cron.schedule(
  'instaflow-refresh-tokens',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://SEU-PROJETO.vercel.app/api/cron/refresh-tokens',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer SEU_CRON_SECRET'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- Limpeza de dados operacionais antigos (mantém o banco dentro dos 500MB do plano grátis)
select cron.schedule(
  'instaflow-cleanup',
  '30 4 * * *',
  $$
  delete from public.webhook_events where created_at < now() - interval '14 days';
  delete from public.logs where created_at < now() - interval '30 days';
  delete from public.scheduled_jobs where status in ('done', 'failed') and updated_at < now() - interval '7 days';
  delete from cron.job_run_details where end_time < now() - interval '3 days';
  $$
);
