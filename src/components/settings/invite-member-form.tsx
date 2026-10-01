"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyField } from "@/components/shared/copy-field";
import { inviteMember } from "@/server/actions/organization-actions";

export function InviteMemberForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [link, setLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-3">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await inviteMember({ email, role });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setLink(result.data.inviteUrl);
            setEmail("");
            toast.success("Convite criado. Copie o link e envie para a pessoa.");
            router.refresh();
          });
        }}
      >
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" className="flex-1" />
        <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
          <SelectTrigger className="sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Membro</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={pending}>Gerar convite</Button>
      </form>
      {link && <CopyField label="Link do convite" value={link} />}
    </div>
  );
}
