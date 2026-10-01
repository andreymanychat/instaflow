import Link from "next/link";
import { getUser } from "@/server/auth/session";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { AcceptInviteButton } from "@/components/onboarding/accept-invite-button";

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const user = await getUser();
  const next = encodeURIComponent(`/invite/${token}`);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/40 p-6">
      <Logo />
      <div className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Você foi convidado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Aceite o convite para acessar a organização. O convite só funciona com o email para o qual foi enviado.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {user ? (
            <AcceptInviteButton token={token} email={user.email ?? ""} />
          ) : (
            <>
              <Button asChild>
                <Link href={`/signup?next=${next}`}>Criar conta e aceitar</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/login?next=${next}`}>Já tenho conta</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
