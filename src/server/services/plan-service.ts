import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlanLimits = {
  instagram_accounts: number;
  contacts: number;
  active_automations: number;
  ai_replies_per_month: number;
  members: number;
  advanced_segmentation: boolean;
};

export type LimitKey = Exclude<keyof PlanLimits, "advanced_segmentation">;

/** Limites do Free: usados se o plano não puder ser lido. */
const FALLBACK_LIMITS: PlanLimits = {
  instagram_accounts: 1,
  contacts: 500,
  active_automations: 1,
  ai_replies_per_month: 20,
  members: 1,
  advanced_segmentation: false,
};

export async function getPlanLimits(organizationId: string): Promise<PlanLimits> {
  const { data, error } = await createAdminClient()
    .from("organizations")
    // FK explícita: organizations tem duas ligações com plans (plan_id e pending_plan_id)
    .select("plan:plans!organizations_plan_id_fkey(limits)")
    .eq("id", organizationId)
    .single();
  // Falha aqui não pode passar em silêncio: cairia nos limites do Free para um cliente pagante
  if (error) console.error("getPlanLimits falhou", organizationId, error.message);
  const limits = (data?.plan as { limits?: Partial<PlanLimits> } | null)?.limits;
  return { ...FALLBACK_LIMITS, ...(limits ?? {}) };
}

async function currentUsage(organizationId: string, key: LimitKey): Promise<number> {
  const admin = createAdminClient();
  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;

  switch (key) {
    case "instagram_accounts":
      return count(admin.from("instagram_accounts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId));
    case "contacts":
      return count(admin.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId));
    case "active_automations":
      return count(
        admin.from("automations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
      );
    case "members":
      return count(admin.from("organization_members").select("user_id", { count: "exact", head: true }).eq("organization_id", organizationId));
    case "ai_replies_per_month": {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      return count(
        admin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("source", "ai")
          .gte("created_at", monthStart.toISOString()),
      );
    }
  }
}

/** Retorna se a organização ainda pode consumir mais uma unidade do recurso. -1 = ilimitado. */
export async function checkLimit(organizationId: string, key: LimitKey) {
  const limits = await getPlanLimits(organizationId);
  const limit = limits[key];
  if (limit < 0) return { allowed: true, limit, usage: 0 };
  const usage = await currentUsage(organizationId, key);
  return { allowed: usage < limit, limit, usage };
}
