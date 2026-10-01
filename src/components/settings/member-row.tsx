"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { removeMember, updateMemberRole } from "@/server/actions/organization-actions";
import { initials } from "@/lib/utils";

const ROLE_LABEL = { owner: "Proprietário", admin: "Admin", member: "Membro" } as const;

type Member = { userId: string; role: "owner" | "admin" | "member"; name: string; email: string; avatarUrl: string | null };

export function MemberRow({ member, isSelf, canManage }: { member: Member; isSelf: boolean; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const editable = canManage && !isSelf && member.role !== "owner";

  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <Avatar className="size-9">
        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
        <AvatarFallback>{initials(member.name || member.email)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.name || member.email} {isSelf && <span className="text-muted-foreground">(você)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </div>
      {editable ? (
        <>
          <Select
            value={member.role}
            disabled={pending}
            onValueChange={(role) =>
              startTransition(async () => {
                const result = await updateMemberRole(member.userId, role as "admin" | "member");
                if (!result.ok) toast.error(result.error);
                router.refresh();
              })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Membro</SelectItem>
            </SelectContent>
          </Select>
          <ConfirmDialog
            title="Remover membro?"
            description={`${member.email} perderá o acesso a esta organização.`}
            confirmLabel="Remover"
            onConfirm={() =>
              startTransition(async () => {
                const result = await removeMember(member.userId);
                if (!result.ok) toast.error(result.error);
                router.refresh();
              })
            }
          >
            <Button variant="ghost" size="sm" disabled={pending}>Remover</Button>
          </ConfirmDialog>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">{ROLE_LABEL[member.role]}</span>
      )}
    </div>
  );
}
