"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, safeAction, zodError } from "@/lib/action-result";
import { UFS, isValidCep, isValidDocument, isValidPhone, onlyDigits } from "@/lib/br";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/server/auth/session";
import { syncAsaasCustomer } from "@/server/billing/billing-service";
import { REFERRAL_LINK_DAYS } from "@/server/billing/pricing";
import * as ig from "@/server/integrations/instagram/client";
import * as asaas from "@/server/integrations/asaas/client";
import { getAccessToken } from "@/server/services/instagram-account-service";
import { errorMessage, log } from "@/server/services/logger";

const optional = z
  .string()
  .trim()
  .max(120)
  .transform((v) => v || null);

const profileSchema = z
  .object({
    fullName: z.string().trim().min(3, "Informe o nome completo.").max(120),
    personType: z.enum(["pf", "pj"]),
    document: z.string().transform(onlyDigits),
    companyName: optional,
    phone: z.string().transform(onlyDigits).refine(isValidPhone, "Telefone inválido (inclua o DDD)."),
    postalCode: z.string().transform(onlyDigits).refine(isValidCep, "CEP inválido."),
    street: z.string().trim().min(2, "Informe o endereço.").max(160),
    addressNumber: z.string().trim().min(1, "Informe o número.").max(20),
    complement: optional,
    district: z.string().trim().min(2, "Informe o bairro.").max(100),
    city: z.string().trim().min(2, "Informe a cidade.").max(100),
    state: z.enum(UFS, "Selecione a UF."),
  })
  .superRefine((data, ctx) => {
    if (!isValidDocument(data.document, data.personType)) {
      ctx.addIssue({ code: "custom", path: ["document"], message: data.personType === "pf" ? "CPF inválido." : "CNPJ inválido." });
    }
    if (data.personType === "pj" && !data.companyName) {
      ctx.addIssue({ code: "custom", path: ["companyName"], message: "Informe a razão social." });
    }
  });

export type ProfileInput = z.input<typeof profileSchema>;

export async function updateProfile(input: ProfileInput) {
  return safeAction(async () => {
    const user = await requireUser();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return zodError(parsed.error);
    const d = parsed.data;

    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: d.fullName,
        person_type: d.personType,
        document: d.document,
        company_name: d.personType === "pj" ? d.companyName : null,
        phone: d.phone,
        postal_code: d.postalCode,
        street: d.street,
        address_number: d.addressNumber,
        complement: d.complement,
        district: d.district,
        city: d.city,
        state: d.state,
      })
      .eq("id", user.id);
    if (error) return fail("Não foi possível salvar o perfil.");

    await syncAsaasCustomer(user.id);
    revalidatePath("/", "layout");
    return ok();
  });
}

/** A foto é enviada pelo navegador direto ao Storage (pasta do próprio usuário); aqui só gravamos a URL. */
export async function updateAvatar(path: string | null) {
  return safeAction(async () => {
    const user = await requireUser();
    const supabase = await createClient();
    let url: string | null = null;
    if (path) {
      if (!path.startsWith(`${user.id}/`) || path.includes("..")) return fail("Arquivo inválido.");
      url = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    } else {
      await removeAvatarFiles(user.id);
    }
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    if (error) return fail("Não foi possível atualizar a foto.");
    revalidatePath("/", "layout");
    return ok({ url });
  });
}

async function removeAvatarFiles(userId: string) {
  const storage = createAdminClient().storage.from("avatars");
  const { data: files } = await storage.list(userId);
  if (files?.length) await storage.remove(files.map((f) => `${userId}/${f.name}`));
}

/** Link de indicação válido por 3 dias. Só quem tem plano pago ganha o crédito, então só eles geram links. */
export async function createReferralLink() {
  return safeAction(async () => {
    const user = await requireUser();
    const db = createAdminClient();
    const { count } = await db
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("billing_owner_id", user.id)
      .neq("plan_id", "free")
      .gt("current_period_end", new Date().toISOString());
    if (!count) return fail("O Indique e ganhe é exclusivo para assinantes dos planos Pro e Business.");

    const expiresAt = new Date(Date.now() + REFERRAL_LINK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db
      .from("referral_links")
      .insert({ user_id: user.id, expires_at: expiresAt })
      .select("code, expires_at")
      .single();
    if (error) return fail("Não foi possível gerar o link.");
    revalidatePath("/account/referrals");
    return ok(data);
  });
}

/**
 * Exclui a conta e tudo o que foi criado por ela:
 * organizações em que o usuário é o único dono (com contatos, conversas, automações etc.),
 * cartões, carteira, pagamentos, indicações, foto e o login.
 * Organizações com outros donos continuam existindo; o usuário apenas sai delas.
 */
export async function deleteAccount(confirmEmail: string) {
  const user = await requireUser();
  if (!user.email || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return fail("Digite exatamente o seu email para confirmar.");
  }
  const db = createAdminClient();

  try {
    const { data: owned } = await db.from("organization_members").select("organization_id").eq("user_id", user.id).eq("role", "owner");
    const toDelete: string[] = [];
    for (const { organization_id } of owned ?? []) {
      const { count } = await db
        .from("organization_members")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", organization_id)
        .eq("role", "owner")
        .neq("user_id", user.id);
      if (!count) toDelete.push(organization_id);
    }

    if (toDelete.length) {
      // Para de receber eventos da Meta antes de apagar as contas conectadas
      const { data: accounts } = await db.from("instagram_accounts").select("*").in("organization_id", toDelete);
      for (const account of accounts ?? []) {
        try {
          await ig.unsubscribeFromWebhooks(getAccessToken(account));
        } catch {
          // Token já inválido: a Meta deixa de entregar eventos de qualquer forma
        }
      }
      const { error } = await db.from("organizations").delete().in("id", toDelete);
      if (error) throw error;
    }

    const { data: profile } = await db.from("profiles").select("asaas_customer_id").eq("id", user.id).maybeSingle();
    if (profile?.asaas_customer_id) {
      // Remove o cliente no Asaas (cancela cobranças pendentes). Histórico fiscal fica no Asaas.
      await asaas.deleteCustomer(profile.asaas_customer_id).catch(() => undefined);
    }

    await removeAvatarFiles(user.id);
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw error;

    await log({
      level: "warn",
      source: "account",
      event: "account_deleted",
      message: `Conta excluída pelo próprio usuário (${toDelete.length} organização(ões) removida(s)).`,
    });
  } catch (error) {
    await log({ level: "error", source: "account", event: "account_delete_failed", message: errorMessage(error) });
    return fail("Não foi possível excluir a conta agora. Tente novamente ou fale com o suporte.");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?conta=excluida");
}
