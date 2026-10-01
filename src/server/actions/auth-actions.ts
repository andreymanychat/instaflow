"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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
  if (error) return fail(error.message);

  // Com confirmação de email desativada o Supabase já devolve a sessão.
  if (data.session) redirect(next);
  return ok({ needsConfirmation: true });
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
