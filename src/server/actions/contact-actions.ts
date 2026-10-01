"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, safeAction, zodError } from "@/lib/action-result";
import { getOrgContext } from "@/server/auth/session";
import type { Json } from "@/types/database";

const tagSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da tag.").max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
});

export async function createTag(input: z.input<typeof tagSchema>) {
  return safeAction(async () => {
    const { supabase, organization } = await getOrgContext();
    const parsed = tagSchema.safeParse(input);
    if (!parsed.success) return zodError(parsed.error);

    const { data, error } = await supabase
      .from("tags")
      .insert({ organization_id: organization.id, ...parsed.data })
      .select("*")
      .single();
    if (error) return fail(error.code === "23505" ? "Já existe uma tag com esse nome." : error.message);
    revalidatePath("/contacts");
    return ok(data);
  });
}

export async function updateTag(tagId: string, input: z.input<typeof tagSchema>) {
  return safeAction(async () => {
    const { supabase, organization } = await getOrgContext();
    const parsed = tagSchema.safeParse(input);
    if (!parsed.success) return zodError(parsed.error);
    const { error } = await supabase.from("tags").update(parsed.data).eq("id", tagId).eq("organization_id", organization.id);
    if (error) return fail(error.message);
    revalidatePath("/contacts");
    return ok();
  });
}

export async function deleteTag(tagId: string) {
  return safeAction(async () => {
    const { supabase, organization } = await getOrgContext();
    await supabase.from("tags").delete().eq("id", tagId).eq("organization_id", organization.id);
    revalidatePath("/contacts");
    return ok();
  });
}

export async function setContactTag(contactId: string, tagId: string, assigned: boolean) {
  return safeAction(async () => {
    const { supabase, organization } = await getOrgContext();
    // RLS garante a organização da linha, mas os IDs referenciados também precisam ser da mesma organização
    const [{ count: contactOk }, { count: tagOk }] = await Promise.all([
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("id", contactId).eq("organization_id", organization.id),
      supabase.from("tags").select("id", { count: "exact", head: true }).eq("id", tagId).eq("organization_id", organization.id),
    ]);
    if (!contactOk || !tagOk) return fail("Contato ou tag inválidos.");

    if (assigned) {
      const { error } = await supabase
        .from("contact_tags")
        .upsert({ contact_id: contactId, tag_id: tagId, organization_id: organization.id }, { onConflict: "contact_id,tag_id" });
      if (error) return fail(error.message);
    } else {
      await supabase.from("contact_tags").delete().eq("contact_id", contactId).eq("tag_id", tagId);
    }
    revalidatePath("/contacts");
    revalidatePath("/inbox");
    return ok();
  });
}

const segmentRuleSchema = z.object({
  id: z.string(),
  field: z.enum(["tag", "is_follower", "last_interaction", "instagram_account", "username"]),
  operator: z.enum(["has", "not_has", "is_true", "is_false", "within_days", "older_than_days", "equals", "contains"]),
  value: z.string().max(100),
});

const segmentSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(80),
  description: z.string().max(300).optional(),
  filters: z.object({ match: z.enum(["all", "any"]), rules: z.array(segmentRuleSchema).max(20) }),
});

export type SegmentInput = z.input<typeof segmentSchema>;

function validateRuleValues(filters: z.infer<typeof segmentSchema>["filters"]) {
  for (const rule of filters.rules) {
    if (["tag", "instagram_account"].includes(rule.field) && !z.uuid().safeParse(rule.value).success) {
      return "Selecione um valor válido em todas as regras.";
    }
    if (rule.field === "last_interaction" && !/^\d{1,4}$/.test(rule.value)) return "Informe o número de dias.";
  }
  return null;
}

export async function saveSegment(segmentId: string | null, input: SegmentInput) {
  return safeAction(async () => {
    const { supabase, organization } = await getOrgContext();
    const parsed = segmentSchema.safeParse(input);
    if (!parsed.success) return zodError(parsed.error);
    const invalid = validateRuleValues(parsed.data.filters);
    if (invalid) return fail(invalid);

    const row = {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      filters: parsed.data.filters as unknown as Json,
    };
    const { error } = segmentId
      ? await supabase.from("segments").update(row).eq("id", segmentId).eq("organization_id", organization.id)
      : await supabase.from("segments").insert({ ...row, organization_id: organization.id });
    if (error) return fail(error.message);
    revalidatePath("/segments");
    return ok();
  });
}

export async function deleteSegment(segmentId: string) {
  return safeAction(async () => {
    const { supabase, organization } = await getOrgContext();
    await supabase.from("segments").delete().eq("id", segmentId).eq("organization_id", organization.id);
    revalidatePath("/segments");
    return ok();
  });
}

export async function previewSegmentCount(filters: SegmentInput["filters"]) {
  return safeAction(async () => {
    const { supabase, organization } = await getOrgContext();
    const parsed = segmentSchema.shape.filters.safeParse(filters);
    if (!parsed.success) return zodError(parsed.error);
    if (validateRuleValues(parsed.data)) return ok({ count: 0 });

    const { count, error } = await supabase.rpc(
      "contacts_in_segment",
      { org: organization.id, filters: parsed.data as unknown as Json },
      { count: "exact", head: true },
    );
    if (error) return fail(error.message);
    return ok({ count: count ?? 0 });
  });
}
