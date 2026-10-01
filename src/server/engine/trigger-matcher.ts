import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchesKeywords } from "@/server/engine/text";
import { DEFAULT_TRIGGER_CONFIG, type TriggerConfig } from "@/types/flow";
import type { Enums, Tables } from "@/types/database";
import type { InstagramAccount } from "@/server/services/instagram-account-service";

type Automation = Tables<"automations">;

export function readTriggerConfig(automation: Pick<Automation, "trigger_config">): TriggerConfig {
  return { ...DEFAULT_TRIGGER_CONFIG, ...((automation.trigger_config ?? {}) as Partial<TriggerConfig>) };
}

async function activeAutomations(account: InstagramAccount, triggerType: Enums<"trigger_type">) {
  const { data } = await createAdminClient()
    .from("automations")
    .select("*")
    .eq("organization_id", account.organization_id)
    .eq("trigger_type", triggerType)
    .eq("status", "active")
    .or(`instagram_account_id.is.null,instagram_account_id.eq.${account.id}`)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  return data ?? [];
}

/**
 * Retorna a primeira automação ativa cujo gatilho casa com o evento.
 * Automações com palavras-chave específicas têm precedência sobre "qualquer mensagem".
 */
export async function findMatchingAutomation(
  account: InstagramAccount,
  triggerType: Enums<"trigger_type">,
  event: { text: string; mediaId?: string },
): Promise<Automation | null> {
  const candidates = await activeAutomations(account, triggerType);

  const matching = candidates.filter((automation) => {
    const config = readTriggerConfig(automation);
    if (triggerType === "comment" && config.mediaIds.length > 0 && !config.mediaIds.includes(event.mediaId ?? "")) {
      return false;
    }
    if (triggerType === "default_reply") return true;
    return matchesKeywords(event.text, config.keywords, config.match);
  });

  const specific = matching.find((a) => readTriggerConfig(a).match !== "any");
  return specific ?? matching[0] ?? null;
}

/** Evita que a resposta padrão dispare em toda mensagem: no máximo 1x a cada 24h por contato. */
export async function ranRecently(automationId: string, contactId: string, hours = 24) {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { count } = await createAdminClient()
    .from("automation_runs")
    .select("id", { count: "exact", head: true })
    .eq("automation_id", automationId)
    .eq("contact_id", contactId)
    .gte("started_at", since);
  return (count ?? 0) > 0;
}
