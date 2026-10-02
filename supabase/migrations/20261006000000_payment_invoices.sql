-- Nota fiscal de serviço (NFS-e) emitida pelo Asaas para cada cobrança paga
alter table public.payments
  add column if not exists invoice_id text unique,
  add column if not exists invoice_status text check (invoice_status in ('scheduling', 'scheduled', 'authorized', 'error', 'canceled')),
  add column if not exists invoice_error text;
