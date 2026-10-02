"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, safeAction, zodError } from "@/lib/action-result";
import { getOrgContext } from "@/server/auth/session";
import { checkLimit } from "@/server/services/plan-service";
import { AUTOMATION_TEMPLATES, type AutomationTemplateId } from "@/lib/automation-templates";
import type { Json } from "@/types/database";

const NODE_TYPES = ["trigger", "message", "comment_reply", "delay", "condition", "add_tag", "remove_tag", "ai_reply"] as const;

const flowSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        type: z.enum(NODE_TYPES),
        position: z.object({ x: z.number(), y: z.number() }),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .max(150, "Fluxo muito grande (máx. 150 passos).")
    .refine((nodes) => nodes.filter((n) => n.type === "trigger").length === 1, "O fluxo precisa ter exatamente um gatilho."),
  edges: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        source: z.string(),
        target: z.string(),
        sourceHandle: z.string().nullish(),
        targetHandle: z.string().nullish(),
      }),
    )
    .max(400),
});

const triggerConfigSchema = z.object({
  keywords: z.array(z.string().trim().min(1).max(100)).max(50),
  match: z.enum(["contains", "exact", "starts_with", "any"]),
  mediaIds: z.array(z.string().max(64)).max(100),
  onlyFirstComment: z.boolean(),
});

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(100),
  instagramAccountId: z.uuid().nullable(),
  triggerType: z.enum(["comment", "dm_keyword", "story_reply", "default_reply"]),
  triggerConfig: triggerConfigSchema,
  priority: z.number().int().min(-100).max(100),
});

export async function createAutomation(templateId: AutomationTemplateId) {
  return safeAction(async () => {
    const { supabase, organization, user } = await getOrgContext();
    const template = AUTOMATION_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return fail("Modelo inválido.");

    const { data, error } = await supabase
      .from("automations")
      .insert({
        organization_id: organization.id,
        name: template.id === "blank" ? "Nova automação" : template.name,
        trigger_type: template.triggerType,
        trigger_config: template.triggerConfig as unknown as Json,
        flow: template.flow as unknown as Json,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return fail(error.message);

    revalidatePath("/automations");
    return ok({ id: data.id });
  });
}

export async function saveAutomation(automationId: string, input: { details: z.input<typeof detailsSchema>; flow: unknown }) {
  return safeAction(async () => {
    const { supabase, organization } = await getOrgContext();
    const details = detailsSchema.safeParse(input.details);
    if (!details.success) return zodError(details.error);
    const flow = flowSchema.safeParse(input.flow);
    if (!flow.success) return zodError(flow.error);

    const { error } = await supabase
      .from("automations")
      .update({
        name: details.data.name,
        instagram_account_id: details.data.instagramAccountId,
        trigger_type: details.data.triggerType,
        trigger_config: details.data.triggerConfig as unknown as Json,
        priority: details.data.priority,
        flow: flow.data as unknown as Json,
      })
      .eq("id", automationId)
      .eq("organization_id", organization.id);
    if (error) return fail(error.message);

    revalidatePath("/automations");
    revalidatePath(`/automations/${automationId}`);
    return ok();
  });
}

export async function setAutomationStatus(automationId: string, status: "active" | "paused" | "draft") {
  return safeAction(async () => {
    const { supabase, organization } = await getOrgContext();

    if (status === "active") {
      const quota = await checkLimit(organization.id, "active_automations");
      if (!quota.allowed) return fail(`Seu plano permite ${quota.limit} automação(ões) ativa(s). Pause outra ou faça upgrade em Assinatura.`);

      const { data: automation } = await supabase
        .from("automations")
        .select("trigger_type, trigger_config, flow")
        .eq("id", automationId)
        .eq("organization_id", organization.id)
        .single();
      if (!automation) return fail("Automação não encontrada.");

      const config = automation.trigger_config as { keywords?: string[]; match?: string };
      const needsKeywords = ["comment", "dm_keyword"].includes(automation.trigger_type) && config.match !== "any";
      if (needsKeywords && !config.keywords?.length) return fail("Defina pelo menos uma palavra-chave antes de ativar.");

      const flow = automation.flow as { edges?: { source: string }[] };
      if (!flow.edges?.some((e) => e.source === "trigger")) return fail("Conecte o gatilho a pelo menos um passo.");
    }

    const { error } = await supabase
      .from("automations")
      .update({ status })
      .eq("id", automationId)
      .eq("organization_id", organization.id);
    if (error) return fail(error.message);

    revalidatePath("/automations");
    revalidatePath(`/automations/${automationId}`);
    return ok();
  });
}

export async function duplicateAutomation(automationId: string) {
  return safeAction(async () => {
    const { supabase, organization, user } = await getOrgContext();
    const { data: source } = await supabase
      .from("automations")
      .select("*")
      .eq("id", automationId)
      .eq("organization_id", organization.id)
      .single();
    if (!source) return fail("Automação não encontrada.");

    const { data, error } = await supabase
      .from("automations")
      .insert({
        organization_id: organization.id,
        instagram_account_id: source.instagram_account_id,
        name: `${source.name} (cópia)`,
        trigger_type: source.trigger_type,
        trigger_config: source.trigger_config,
        flow: source.flow,
        priority: source.priority,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return fail(error.message);
    revalidatePath("/automations");
    return ok({ id: data.id });
  });
}

export async function deleteAutomation(automationId: string) {
  return safeAction(async () => {
    const { supabase, organization } = await getOrgContext();
    const { error } = await supabase.from("automations").delete().eq("id", automationId).eq("organization_id", organization.id);
    if (error) return fail(error.message);
    revalidatePath("/automations");
    return ok();
  });
}
