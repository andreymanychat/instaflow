"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AtSign, Building2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings", label: "Geral", icon: Building2 },
  { href: "/settings/instagram", label: "Instagram", icon: AtSign },
  { href: "/settings/team", label: "Equipe", icon: Users },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:w-48 lg:flex-col">
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
