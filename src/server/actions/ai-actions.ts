"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, safeAction, zodError } from "@/lib/action-result";
import { getOrgContext, requireAdmin } from "@/server/auth/session";
import { generateAiReply } from "@/server/services/ai-service";

const promptSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(80),
  systemPrompt: z.string().trim().min(20, "Descreva melhor o comportamento (mín. 20 caracteres).").max(8000),
  model: z.string().trim().min(2).max(60),
  temperature: z.number().min(0).max(2),
  maxOutputTokens: z.number().int().min(50).max(4000),
  historyLimit: z.number().int().min(0).max(50),
});

export type PromptInput = z.input<typeof promptSchema>;

export async function savePrompt(promptId: string | null, input: PromptInput) {
  return safeAction(async () => {
    const { supabase, organization } = await requireAdmin();
    const parsed = promptSchema.safeParse(input);
    if (!parsed.success) return zodError(parsed.error);

    const row = {
      name: parsed.data.name,
      system_prompt: parsed.data.systemPrompt,
      model: parsed.data.model,
      temperature: parsed.data.temperature,
      max_output_tokens: parsed.data.maxOutputTokens,
      history_limit: parsed.data.historyLimit,
    };

    if (promptId) {
      const { error } = await supabase.from("ai_prompts").update(row).eq("id", promptId).eq("organization_id", organization.id);
      if (error) return fail(error.message);
      revalidatePath("/ai");
      return ok({ id: promptId });
    }

    const { data, error } = await supabase
      .from("ai_prompts")
      .insert({ ...row, organization_id: organization.id })
      .select("id")
      .single();
    if (error) return fail(error.message);

    // O primeiro prompt criado vira o padrão da organização
    if (!organization.default_ai_prompt_id) {
      await supabase.from("organizations").update({ default_ai_prompt_id: data.id }).eq("id", organization.id);
    }
    revalidatePath("/ai");
    return ok({ id: data.id });
  });
}

export async function deletePrompt(promptId: string) {
  return safeAction(async () => {
    const { supabase, organization } = await requireAdmin();
    await supabase.from("ai_prompts").delete().eq("id", promptId).eq("organization_id", organization.id);
    revalidatePath("/ai");
    return ok();
  });
}

/** Playground: conversa simulada, sem enviar nada ao Instagram. */
export async function testPrompt(promptId: string, history: { role: "user" | "assistant"; content: string }[]) {
  return safeAction(async () => {
    const { organization } = await getOrgContext();
    const parsed = z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }))
      .min(1)
      .max(30)
      .safeParse(history);
    if (!parsed.success) return zodError(parsed.error);

    const result = await generateAiReply({
      organizationId: organization.id,
      conversationId: null,
      promptId,
      overrideHistory: parsed.data,
    });
    if (!result.ok) return fail(result.error);
    return ok({ text: result.text });
  });
}
