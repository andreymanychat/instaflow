"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, safeAction, zodError, type ActionResult } from "@/lib/action-result";
import { ACTIVE_ORG_COOKIE, getOrgContext, requireAdmin, requireUser } from "@/server/auth/session";
import { checkLimit } from "@/server/services/plan-service";

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function createOrganization(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = z
    .object({ name: z.string().trim().min(2, "Nome muito curto.").max(80, "Nome muito longo.") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodError(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", { org_name: parsed.data.name });
  if (error || !data) return fail(error?.message ?? "Não foi possível criar a organização.");

  (await cookies()).set(ACTIVE_ORG_COOKIE, data.id, cookieOptions);
  redirect("/dashboard");
}

export async function switchOrganization(organizationId: string) {
  const { memberships } = await getOrgContext();
  if (!memberships.some((m) => m.organization.id === organizationId)) return fail("Organização inválida.");
  (await cookies()).set(ACTIVE_ORG_COOKIE, organizationId, cookieOptions);
  revalidatePath("/", "layout");
  return ok();
}

export async function updateOrganization(input: { name: string; humanTakeoverMinutes: number }) {
  return safeAction(async () => {
    const { supabase, organization } = await requireAdmin();
    const parsed = z
      .object({
        name: z.string().trim().min(2).max(80),
        humanTakeoverMinutes: z.number().int().min(0).max(10080),
      })
      .safeParse(input);
    if (!parsed.success) return zodError(parsed.error);

    const { error } = await supabase
      .from("organizations")
      .update({ name: parsed.data.name, human_takeover_minutes: parsed.data.humanTakeoverMinutes })
      .eq("id", organization.id);
    if (error) return fail(error.message);
    revalidatePath("/", "layout");
    return ok();
  });
}

export async function inviteMember(input: { email: string; role: "admin" | "member" }) {
  return safeAction(async () => {
    const { supabase, organization, user } = await requireAdmin();
    const parsed = z.object({ email: z.email("Email inválido."), role: z.enum(["admin", "member"]) }).safeParse(input);
    if (!parsed.success) return zodError(parsed.error);

    const quota = await checkLimit(organization.id, "members");
    if (!quota.allowed) return fail(`Seu plano permite até ${quota.limit} membro(s) na equipe. Faça upgrade em Assinatura.`);

    const { data, error } = await supabase
      .from("organization_invitations")
      .insert({ organization_id: organization.id, email: parsed.data.email.toLowerCase(), role: parsed.data.role, invited_by: user.id })
      .select("token")
      .single();
    if (error) return fail(error.message);

    revalidatePath("/settings/team");
    // Sem provedor de email transacional: o admin compartilha o link manualmente.
    return ok({ inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${data.token}` });
  });
}

export async function revokeInvitation(invitationId: string) {
  return safeAction(async () => {
    const { supabase, organization } = await requireAdmin();
    await supabase.from("organization_invitations").delete().eq("id", invitationId).eq("organization_id", organization.id);
    revalidatePath("/settings/team");
    return ok();
  });
}

export async function updateMemberRole(userId: string, role: "admin" | "member") {
  return safeAction(async () => {
    const { supabase, organization, user } = await requireAdmin();
    if (userId === user.id) return fail("Você não pode alterar o próprio papel.");
    const { data: target } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization.id)
      .eq("user_id", userId)
      .single();
    if (target?.role === "owner") return fail("O papel do proprietário não pode ser alterado.");

    const { error } = await supabase
      .from("organization_members")
      .update({ role })
      .eq("organization_id", organization.id)
      .eq("user_id", userId);
    if (error) return fail(error.message);
    revalidatePath("/settings/team");
    return ok();
  });
}

export async function removeMember(userId: string) {
  return safeAction(async () => {
    const { supabase, organization } = await requireAdmin();
    const { data: target } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization.id)
      .eq("user_id", userId)
      .single();
    if (target?.role === "owner") return fail("O proprietário não pode ser removido.");

    await supabase.from("organization_members").delete().eq("organization_id", organization.id).eq("user_id", userId);
    revalidatePath("/settings/team");
    return ok();
  });
}

export async function acceptInvitation(token: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: organizationId, error } = await supabase.rpc("accept_invitation", { invite_token: token });
  if (error || !organizationId) return fail(error?.message ?? "Convite inválido.");
  (await cookies()).set(ACTIVE_ORG_COOKIE, organizationId, cookieOptions);
  redirect("/dashboard");
}

export async function updateAiSettings(input: { autoReplyEnabled: boolean; defaultPromptId: string | null }) {
  return safeAction(async () => {
    const { supabase, organization } = await requireAdmin();
    const { error } = await supabase
      .from("organizations")
      .update({ ai_auto_reply_enabled: input.autoReplyEnabled, default_ai_prompt_id: input.defaultPromptId })
      .eq("id", organization.id);
    if (error) return fail(error.message);
    revalidatePath("/ai");
    return ok();
  });
}
