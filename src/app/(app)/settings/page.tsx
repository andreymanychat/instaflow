import type { Metadata } from "next";
import { canManage, getOrgContext } from "@/server/auth/session";
import { OrganizationForm } from "@/components/settings/organization-form";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const { organization, role } = await getOrgContext();
  return (
    <OrganizationForm
      canEdit={canManage(role)}
      initial={{ name: organization.name, humanTakeoverMinutes: organization.human_takeover_minutes }}
      webhookUrl={`${process.env.NEXT_PUBLIC_APP_URL}/api/webhook`}
    />
  );
}
