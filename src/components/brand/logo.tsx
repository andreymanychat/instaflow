import Image from "next/image";
import { cn } from "@/lib/utils";

/** Marca do ChatFlow (o mesmo ícone cadastrado no app da Meta). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex size-8 items-center justify-center rounded-lg bg-zinc-900 p-1 shadow-sm", className)}>
      <Image src="/logo.png" alt="" width={24} height={24} className="size-full object-contain" priority />
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight">ChatFlow</span>
    </span>
  );
}
