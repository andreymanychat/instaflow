"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, UserRound, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/account", label: "Perfil", icon: UserRound },
  { href: "/account/wallet", label: "Carteira e cartões", icon: Wallet },
  { href: "/account/referrals", label: "Indique e ganhe", icon: Gift },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:w-52 lg:flex-col">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
            pathname === item.href && "bg-muted font-medium",
          )}
        >
          <item.icon className="size-4" /> {item.label}
        </Link>
      ))}
    </nav>
  );
}
