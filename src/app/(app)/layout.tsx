import { cookies } from "next/headers";
import { getOrgContext } from "@/server/auth/session";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const PLAN_NAMES: Record<string, string> = { free: "Free", pro: "Pro", business: "Business" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext();
  const { data: profile } = await ctx.supabase.from("profiles").select("full_name, avatar_url").eq("id", ctx.user.id).single();
  const { count: unread } = await ctx.supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organization.id)
    .gt("unread_count", 0);

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        organization={{ id: ctx.organization.id, name: ctx.organization.name, planName: PLAN_NAMES[ctx.organization.plan_id] ?? ctx.organization.plan_id }}
        organizations={ctx.memberships.map((m) => ({ id: m.organization.id, name: m.organization.name }))}
        user={{ email: ctx.user.email ?? "", name: profile?.full_name ?? "", avatarUrl: profile?.avatar_url ?? null }}
        unreadConversations={unread ?? 0}
      />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  );
}
