import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/logo";
import { CreateOrganizationForm } from "@/components/onboarding/create-organization-form";

export const metadata: Metadata = { title: "Criar organização" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser();
  const { new: isNew } = await searchParams;

  const supabase = await createClient();
  const { count } = await supabase
    .from("organization_members")
    .select("organization_id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) > 0 && !isNew) redirect("/dashboard");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/40 p-6">
      <Logo />
      <div className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Crie sua organização</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A organização agrupa suas contas do Instagram, automações e equipe. Você pode convidar pessoas depois.
        </p>
        <CreateOrganizationForm />
      </div>
    </div>
  );
}
