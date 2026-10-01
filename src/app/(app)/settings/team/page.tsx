import type { Metadata } from "next";
import { canManage, getOrgContext } from "@/server/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteMemberForm } from "@/components/settings/invite-member-form";
import { MemberRow } from "@/components/settings/member-row";
import { RevokeInviteButton } from "@/components/settings/revoke-invite-button";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Equipe" };

export default async function TeamPage() {
  const { supabase, organization, role, user } = await getOrgContext();
  const isAdmin = canManage(role);

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, role, created_at, profile:profiles(full_name, email, avatar_url)")
      .eq("organization_id", organization.id)
      .order("created_at"),
    isAdmin
      ? supabase
          .from("organization_invitations")
          .select("id, email, role, token, expires_at")
          .eq("organization_id", organization.id)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
      : Promise.resolve({ data: [] as { id: string; email: string; role: string; token: string; expires_at: string }[] }),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Membros</CardTitle>
          <CardDescription>Todos os membros acessam a caixa de entrada e automações. Admins gerenciam contas, equipe e IA.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {members?.map((member) => (
            <MemberRow
              key={member.user_id}
              member={{
                userId: member.user_id,
                role: member.role,
                name: member.profile?.full_name ?? "",
                email: member.profile?.email ?? "",
                avatarUrl: member.profile?.avatar_url ?? null,
              }}
              isSelf={member.user_id === user.id}
              canManage={isAdmin}
            />
          ))}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Convidar pessoas</CardTitle>
            <CardDescription>Gere um link de convite e envie para a pessoa. Ele expira em 7 dias.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InviteMemberForm />
            {(invitations?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Convites pendentes</p>
                {invitations!.map((invite) => (
                  <div key={invite.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <span className="flex-1 truncate">{invite.email}</span>
                    <span className="text-xs capitalize text-muted-foreground">{invite.role}</span>
                    <span className="text-xs text-muted-foreground">expira {formatDate(invite.expires_at)}</span>
                    <RevokeInviteButton id={invite.id} inviteUrl={`${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.token}`} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
