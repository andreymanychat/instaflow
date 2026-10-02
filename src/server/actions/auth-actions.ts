"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REFERRAL_COOKIE } from "@/server/billing/referral-cookie";
import { fail, ok, zodError, type ActionResult } from "@/lib/action-result";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const credentialsSchema = z.object({
  email: z.email("Email inválido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});

const safeNext = (next: unknown) => (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");

export async function signIn(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return fail(error.message === "Email not confirmed" ? "Confirme seu email antes de entrar." : "Email ou senha incorretos.");
  }
  redirect(safeNext(formData.get("next")));
}

export async function signUp(
  _: ActionResult<{ needsConfirmation: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const schema = credentialsSchema.extend({
    fullName: z.string().trim().min(2, "Informe seu nome."),
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodError(parsed.error);

  const supabase = await createClient();
  const next = safeNext(formData.get("next") || "/onboarding");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return fail(signUpErrorMessage(error.message));

  // identities vazio = email já cadastrado (o Supabase devolve um usuário fictício para não revelar isso)
  if (data.user && data.user.identities?.length) await recordReferral(data.user.id);

  // Com confirmação de email desativada o Supabase já devolve a sessão.
  if (data.session) redirect(next);
  return ok({ needsConfirmation: true });
}

/** Mensagens do Supabase Auth em português (o padrão vem em inglês). */
function signUpErrorMessage(message: string) {
  const m = message.toLowerCase();
  if (m.includes("is invalid")) return "Este email não é aceito. Use um email válido que você acessa.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Este email já tem conta. Faça login.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (m.includes("password")) return "Senha fraca: use pelo menos 8 caracteres, misturando letras e números.";
  if (m.includes("sending") && m.includes("email")) return "Não conseguimos enviar o email de confirmação agora. Tente novamente em instantes.";
  return "Não foi possível criar a conta agora. Tente novamente.";
}

/** Vincula o novo usuário a quem o indicou (cookie do link /r/<código>, válido por 3 dias). */
async function recordReferral(newUserId: string) {
  const cookieStore = await cookies();
  const code = cookieStore.get(REFERRAL_COOKIE)?.value;
  if (!code) return;
  cookieStore.delete(REFERRAL_COOKIE);

  const db = createAdminClient();
  const { data: link } = await db.from("referral_links").select("id, user_id, expires_at").eq("code", code).maybeSingle();
  if (!link || new Date(link.expires_at) <= new Date() || link.user_id === newUserId) return;
  await db.from("referrals").insert({ referrer_id: link.user_id, referred_id: newUserId, link_id: link.id });
}

export async function requestPasswordReset(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = z.object({ email: z.email("Email inválido.") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodError(parsed.error);

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl()}/auth/callback?next=/reset-password`,
  });
  // Resposta idêntica exista ou não o email (evita enumeração de usuários)
  return ok();
}

export async function updatePassword(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({ password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.message);
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
