import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next, indicacao } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      {indicacao === "1" && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <Gift className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>Você foi indicado por um assinante do ChatFlow. Crie sua conta grátis e comece agora.</p>
        </div>
      )}
      {indicacao === "expirada" && (
        <p className="rounded-lg border p-3 text-sm text-muted-foreground">
          Este link de indicação expirou (vale por 3 dias), mas você ainda pode criar sua conta normalmente.
        </p>
      )}
      <SignupForm next={typeof next === "string" ? next : undefined} />
    </div>
  );
}
