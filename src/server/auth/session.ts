import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/types/database";

export const ACTIVE_ORG_COOKIE = "active_org";

export type OrgContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email: string | null };
  organization: Tables<"organizations">;
  role: Enums<"member_role">;
  memberships: { organization: Pick<Tables<"organizations">, "id" | "name" | "plan_id">; role: Enums<"member_role"> }[];
};

/** Usuário autenticado (validado no servidor do Supabase). Memoizado por requisição. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Resolve a organização ativa (cookie) validando que o usuário é membro.
 * Sem organização -> onboarding. Memoizado por requisição.
 */
export const getOrgContext = cache(async (): Promise<OrgContext> => {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(id, name, plan_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const memberships = (rows ?? [])
    .filter((r) => r.organization)
    .map((r) => ({ role: r.role, organization: r.organization! }));

  if (memberships.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const active = memberships.find((m) => m.organization.id === preferred) ?? memberships[0];

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", active.organization.id)
    .single();
  if (!organization) redirect("/onboarding");

  return {
    supabase,
    user: { id: user.id, email: user.email ?? null },
    organization,
    role: active.role,
    memberships,
  };
});

export function canManage(role: Enums<"member_role">) {
  return role === "owner" || role === "admin";
}

export async function requireAdmin() {
  const ctx = await getOrgContext();
  if (!canManage(ctx.role)) throw new Error("Apenas administradores podem realizar esta ação.");
  return ctx;
}
