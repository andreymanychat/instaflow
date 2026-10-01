import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrgContext } from "@/server/auth/session";
import { AutomationEditor } from "@/components/automations/editor/automation-editor";
import { DEFAULT_TRIGGER_CONFIG, type FlowDefinition, type TriggerConfig } from "@/types/flow";

export const metadata: Metadata = { title: "Editor de automação" };

export default async function AutomationEditorPage({ params }: PageProps<"/automations/[id]">) {
  const { id } = await params;
  const { supabase, organization } = await getOrgContext();

  const [{ data: automation }, { data: tags }, { data: prompts }, { data: accounts }] = await Promise.all([
    supabase.from("automations").select("*").eq("id", id).eq("organization_id", organization.id).maybeSingle(),
    supabase.from("tags").select("id, name, color").eq("organization_id", organization.id).order("name"),
    supabase.from("ai_prompts").select("id, name").eq("organization_id", organization.id).order("name"),
    supabase.from("instagram_accounts_public").select("id, username").eq("organization_id", organization.id),
  ]);
  if (!automation) notFound();

  const flow = (automation.flow ?? { nodes: [], edges: [] }) as unknown as FlowDefinition;
  const triggerConfig = { ...DEFAULT_TRIGGER_CONFIG, ...(automation.trigger_config as Partial<TriggerConfig>) };

  return (
    <AutomationEditor
      automationId={automation.id}
      status={automation.status}
      initialFlow={flow}
      initialDetails={{
        name: automation.name,
        instagramAccountId: automation.instagram_account_id,
        triggerType: automation.trigger_type,
        triggerConfig,
        priority: automation.priority,
      }}
      lookups={{ tags: tags ?? [], prompts: prompts ?? [], accounts: accounts ?? [] }}
    />
  );
}
