"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Media = { id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string; permalink: string };

/** Grade com as publicações recentes para restringir o gatilho de comentário a posts específicos. */
export function MediaPicker({ accountId, selected, onChange }: { accountId: string | null; selected: string[]; onChange: (ids: string[]) => void }) {
  const [media, setMedia] = useState<Media[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/instagram/media${accountId ? `?accountId=${accountId}` : ""}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setMedia(body.media ?? []);
        setError(body.error ?? null);
      })
      .catch(() => !cancelled && setError("Não foi possível carregar as publicações."));
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (!media && !error) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando publicações...
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!media?.length) return <p className="text-sm text-muted-foreground">Nenhuma publicação encontrada (conecte uma conta do Instagram).</p>;

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {media.map((item) => {
        const isSelected = selected.includes(item.id);
        const src = item.thumbnail_url ?? item.media_url;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            title={item.caption ?? ""}
            className={cn("relative aspect-square overflow-hidden rounded-md border-2 bg-muted", isSelected ? "border-primary" : "border-transparent")}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element -- URLs assinadas do CDN da Meta mudam; next/image exigiria remotePatterns amplos
              <img src={src} alt="" className="size-full object-cover" loading="lazy" />
            ) : (
              <span className="p-1 text-[10px]">{item.media_type}</span>
            )}
            {isSelected && (
              <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                <Check className="size-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
