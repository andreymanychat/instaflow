"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  tags: { id: string; name: string; color: string }[];
  segments: { id: string; name: string }[];
};

export function ContactFilters({ tags, segments }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params}`);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <form
        className="relative flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          update("q", new FormData(e.currentTarget).get("q")?.toString() || null);
        }}
      >
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input name="q" defaultValue={searchParams.get("q") ?? ""} placeholder="Buscar por nome ou @usuário" className="pl-8" />
      </form>
      <Select value={searchParams.get("tag") ?? "all"} onValueChange={(v) => update("tag", v === "all" ? null : v)}>
        <SelectTrigger className="sm:w-48">
          <SelectValue placeholder="Tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as tags</SelectItem>
          {tags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>
              <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} /> {tag.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("segment") ?? "all"} onValueChange={(v) => update("segment", v === "all" ? null : v)}>
        <SelectTrigger className="sm:w-48">
          <SelectValue placeholder="Segmento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os contatos</SelectItem>
          {segments.map((segment) => (
            <SelectItem key={segment.id} value={segment.id}>{segment.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
