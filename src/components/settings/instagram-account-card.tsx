"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ContactAvatar } from "@/components/shared/contact-avatar";
import { disconnectInstagramAccount, resubscribeWebhooks } from "@/server/actions/instagram-actions";
import { formatDate } from "@/lib/utils";
import type { Database } from "@/types/database";

type Account = Database["public"]["Views"]["instagram_accounts_public"]["Row"];

const STATUS_LABEL: Record<Account["status"], string> = {
  active: "Ativa",
  expired: "Token expirado — reconecte",
  revoked: "Acesso removido no Instagram — reconecte",
  error: "Erro",
};

export function InstagramAccountCard({ account, canManage }: { account: Account; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const healthy = account.status === "active" && account.webhook_subscribed;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
      <ContactAvatar contact={{ username: account.username, name: account.name, profile_pic_url: account.profile_picture_url }} className="size-12" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">@{account.username}</p>
        <p className="text-sm text-muted-foreground">
          {account.name}
          {account.followers_count !== null && ` · ${account.followers_count.toLocaleString("pt-BR")} seguidores`}
        </p>
        <p className={`mt-1 flex items-center gap-1 text-xs ${healthy ? "text-emerald-600" : "text-amber-600"}`}>
          {healthy ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          {account.status !== "active" ? STATUS_LABEL[account.status] : account.webhook_subscribed ? "Recebendo eventos" : "Webhooks não assinados"}
          {account.token_expires_at && account.status === "active" && ` · token até ${formatDate(account.token_expires_at)}`}
        </p>
        {account.last_error && <p className="mt-1 text-xs text-destructive">{account.last_error}</p>}
      </div>
      {canManage && (
        <div className="flex gap-2">
          {account.status === "active" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await resubscribeWebhooks(account.id);
                  if (result.ok) toast.success("Conta sincronizada.");
                  else toast.error(result.error);
                  router.refresh();
                })
              }
            >
              <RefreshCw className="size-4" /> Sincronizar
            </Button>
          ) : (
            <Button asChild size="sm">
              <a href="/api/oauth/connect">Reconectar</a>
            </Button>
          )}
          <ConfirmDialog
            title={`Desconectar @${account.username}?`}
            description="Contatos, conversas e histórico desta conta serão apagados e as automações param de responder."
            confirmLabel="Desconectar"
            onConfirm={() =>
              startTransition(async () => {
                const result = await disconnectInstagramAccount(account.id);
                if (result.ok) toast.success("Conta desconectada.");
                else toast.error(result.error);
                router.refresh();
              })
            }
          >
            <Button variant="ghost" size="sm" disabled={pending}>
              <Unplug className="size-4" /> Desconectar
            </Button>
          </ConfirmDialog>
        </div>
      )}
    </div>
  );
}
