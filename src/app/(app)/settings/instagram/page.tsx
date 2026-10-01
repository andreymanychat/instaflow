import type { Metadata } from "next";
import { canManage, getOrgContext } from "@/server/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InstagramAccountCard } from "@/components/settings/instagram-account-card";
import { OAuthResultToast } from "@/components/settings/oauth-result-toast";

export const metadata: Metadata = { title: "Instagram" };

export default async function InstagramSettingsPage({ searchParams }: PageProps<"/settings/instagram">) {
  const { supabase, organization, role } = await getOrgContext();
  const { connected, error } = await searchParams;
  const { data: accounts } = await supabase
    .from("instagram_accounts_public")
    .select("*")
    .eq("organization_id", organization.id)
    .order("created_at");

  return (
    <div className="space-y-6">
      <OAuthResultToast connected={typeof connected === "string" ? connected : null} error={typeof error === "string" ? error : null} />
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Contas do Instagram</CardTitle>
            <CardDescription>
              Conecte contas profissionais (Business ou Creator) pelo login oficial do Instagram. Nenhuma senha é armazenada.
            </CardDescription>
          </div>
          {canManage(role) && (
            <Button asChild>
              {/* Link comum (não <Link>): a rota faz redirect para o domínio do Instagram */}
              <a href="/api/oauth/connect">Conectar Instagram</a>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!accounts?.length && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma conta conectada. Enquanto o app da Meta estiver em modo de teste, a conta precisa ser adicionada como “Testador do Instagram”.
            </p>
          )}
          {accounts?.map((account) => (
            <InstagramAccountCard key={account.id} account={account} canManage={canManage(role)} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requisitos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>A conta precisa ser profissional (Configurações do Instagram → Tipo de conta e ferramentas).</li>
            <li>Em “Mensagens e respostas a stories” → “Ferramentas conectadas”, permita o acesso às mensagens.</li>
            <li>O token dura 60 dias e é renovado automaticamente todos os dias pelo agendador.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
