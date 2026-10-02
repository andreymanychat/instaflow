"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Bot,
  ChevronsUpDown,
  CreditCard,
  Filter,
  Inbox,
  LayoutDashboard,
  LogOut,
  Plus,
  ScrollText,
  Settings,
  Users,
  Workflow,
  Check,
  Gift,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogoMark } from "@/components/brand/logo";
import { ThemeSubMenu } from "@/components/theme/theme-toggle";
import { switchOrganization } from "@/server/actions/organization-actions";
import { signOut } from "@/server/actions/auth-actions";
import { initials } from "@/lib/utils";

const NAV = [
  {
    label: "Principal",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inbox", label: "Caixa de entrada", icon: Inbox, badge: "unread" as const },
      { href: "/automations", label: "Automações", icon: Workflow },
    ],
  },
  {
    label: "Audiência",
    items: [
      { href: "/contacts", label: "Contatos e tags", icon: Users },
      { href: "/segments", label: "Segmentos", icon: Filter },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/ai", label: "Inteligência artificial", icon: Bot },
      { href: "/logs", label: "Logs", icon: ScrollText },
      { href: "/settings", label: "Configurações", icon: Settings },
      { href: "/billing", label: "Assinatura", icon: CreditCard },
    ],
  },
];

type Props = {
  organization: { id: string; name: string; planName: string };
  organizations: { id: string; name: string }[];
  user: { email: string; name: string; avatarUrl: string | null };
  unreadConversations: number;
};

export function AppSidebar({ organization, organizations, user, unreadConversations }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const changeOrg = (id: string) =>
    startTransition(async () => {
      const result = await switchOrganization(id);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" disabled={pending} className="data-[state=open]:bg-sidebar-accent">
                  <LogoMark />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{organization.name}</span>
                    <span className="truncate text-xs text-muted-foreground">Plano {organization.planName}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="start">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Organizações</DropdownMenuLabel>
                {organizations.map((org) => (
                  <DropdownMenuItem key={org.id} onClick={() => org.id !== organization.id && changeOrg(org.id)}>
                    <span className="truncate">{org.name}</span>
                    {org.id === organization.id && <Check className="ml-auto size-4" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/onboarding?new=1">
                    <Plus className="size-4" /> Nova organização
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {"badge" in item && unreadConversations > 0 && (
                      <SidebarMenuBadge className="bg-primary text-primary-foreground">{unreadConversations}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="size-8 rounded-lg">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                    <AvatarFallback className="rounded-lg">{initials(user.name || user.email)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name || "Minha conta"}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" side="top" align="start">
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <UserRound className="size-4" /> Minha conta
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account/wallet">
                    <Wallet className="size-4" /> Carteira e cartões
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account/referrals">
                    <Gift className="size-4" /> Indique e ganhe
                  </Link>
                </DropdownMenuItem>
                <ThemeSubMenu />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => startTransition(() => signOut())}>
                  <LogOut className="size-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
