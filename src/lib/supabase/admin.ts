import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Cliente com service_role: IGNORA RLS.
 * Uso exclusivo em código de servidor que não tem sessão de usuário
 * (webhooks da Meta, cron, callbacks OAuth). Toda query deve filtrar
 * explicitamente por organization_id.
 */
export function createAdminClient() {
  if (!adminClient) {
    adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return adminClient;
}
