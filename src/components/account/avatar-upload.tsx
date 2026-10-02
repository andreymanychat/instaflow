"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";
import { updateAvatar } from "@/server/actions/account-actions";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

type Props = { userId: string; name: string; email: string; avatarUrl: string | null };

export function AvatarUpload({ userId, name, email, avatarUrl }: Props) {
  const [url, setUrl] = useState(avatarUrl);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const upload = (file: File) => {
    if (!TYPES.includes(file.type)) return toast.error("Use uma imagem PNG, JPG ou WebP.");
    if (file.size > MAX_BYTES) return toast.error("A imagem deve ter no máximo 2 MB.");

    startTransition(async () => {
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      // A política do Storage só permite gravar dentro da pasta com o id do próprio usuário
      const path = `${userId}/avatar.${ext}`;
      const { error } = await createClient().storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        toast.error("Falha no envio da imagem.");
        return;
      }
      const result = await updateAvatar(path);
      if (!result.ok) toast.error(result.error);
      else {
        setUrl(result.data.url);
        toast.success("Foto atualizada.");
        router.refresh();
      }
    });
  };

  const remove = () =>
    startTransition(async () => {
      const result = await updateAvatar(null);
      if (!result.ok) toast.error(result.error);
      else {
        setUrl(null);
        router.refresh();
      }
    });

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4">
        <Avatar className="size-20">
          {url && <AvatarImage src={url} alt={name} className="object-cover" />}
          <AvatarFallback className="text-xl">{initials(name || email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name || "Sem nome"}</p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={input}
            type="file"
            accept={TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" disabled={pending} onClick={() => input.current?.click()}>
            <Camera className="size-4" /> {url ? "Trocar foto" : "Enviar foto"}
          </Button>
          {url && (
            <Button variant="ghost" size="icon" aria-label="Remover foto" disabled={pending} onClick={remove}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
